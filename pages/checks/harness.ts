/**
 * Shared machinery for every browser check: the results ledger, the small `Devtools` client that
 * drives Chromium over the DevTools Protocol, and the key-press/poll helpers more than one package
 * file needs.
 *
 * This module exists so there is exactly one of each: one results array, one `Devtools` class, one
 * `pressKey`. `pages/verify.ts` owns the browser's startup and teardown and calls into one file per
 * workspace package under `pages/checks/`; every one of those files imports what it needs from here
 * rather than redefining it.
 *
 * The ledger is a {@link Run}: it holds the checks *and* what became of every package block the run
 * committed to, because those two facts have to be printed on the same line to be read together.
 * `harness.test.ts` drives a `Run` directly with fake blocks, which is why the isolation and the
 * summary line are methods on an object a test can create rather than free functions over
 * module-level state.
 *
 * **A standing hazard for any check that reloads or renavigates the one page every block shares**:
 * `pages/src/app.tsx`'s route effect re-runs on every load and smoothly scrolls toward whatever
 * card the address currently deep-links to, which an earlier block's own routing may have left
 * pointed anywhere — `system/`'s `authFormNoScriptChecks` waits that scroll out before it returns,
 * for exactly this reason. A future check that needs a fresh, unhydrated load has a cleaner option
 * this one does not take: open a second tab for it (`connect` takes a port, not a fixed target) and
 * leave the shared page, and its address, untouched by the reload entirely.
 */

import { join } from "node:path"

/** One assertion's outcome. */
export interface CheckRecord {
  /** What was asserted, in the present tense. */
  name: string
  /** Whether it held. */
  ok: boolean
  /** Evidence printed next to the name. */
  detail: string
}

/**
 * How one committed package block ended.
 *
 * `NeverRan` is the state a block is committed in, not a state something sets afterwards: a run
 * names its blocks before it tries to run any of them, so a phase that falls over before reaching
 * them reports every one of them as never run. That is what separates a browser phase that died
 * during startup from one that was left out with `--static`, where no block is ever committed.
 */
export enum BlockOutcome {
  /** Committed to, and not reached. */
  NeverRan = 1,
  /** Started and threw part-way, so the rest of its checks never ran. */
  StoppedPartWay = 2,
  /** Ran to the end of its file. */
  Completed = 3,
}

/** One workspace package's browser checks, named so a throw inside can be reported against it. */
export interface CheckBlock<Context> {
  /** The package directory the checks belong to, e.g. `ui`. */
  name: string
  /** Runs that package's checks. */
  run: (context: Context) => Promise<void>
}

/**
 * Render a thrown value for the detail column; a non-`Error` throw is as readable as any other.
 * Exported so `pages/launch.ts` and `pages/verify.ts` share this instead of each defining a copy.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * One verify run's ledger: every check it recorded, and what became of every package block it
 * committed to.
 *
 * Both halves matter to the last line. Counting checks alone cannot tell a complete run from one
 * that lost a block, because a lost block takes its checks out of the denominator as well as the
 * numerator — `43/46` and `60/60` look equally healthy. Holding the committed block names next to
 * the checks is what lets {@link summaryLine} say which blocks are missing from the totals.
 */
export class Run {
  #checks: CheckRecord[] = []
  #blocks = new Map<string, BlockOutcome>()
  #current?: string

  /** Every check recorded so far, in the order they were recorded. */
  get checks(): readonly CheckRecord[] {
    return this.#checks
  }

  /** The last check recorded, or `undefined` before the first one. */
  get lastCheck(): CheckRecord | undefined {
    return this.#checks.at(-1)
  }

  /**
   * The last check that genuinely passed, or `undefined` if none has.
   *
   * Different from {@link lastCheck}: the entry `runBlocks` itself records for a block that threw —
   * `"the ${block.name} checks ran to completion"`, `ok: false` — is a check *record* like any
   * other, so `lastCheck` can return it. Naming that as "the last completed check" in a later
   * block's own failure detail would be naming a previous block's failure marker as if it were a
   * check that had passed — found in review. This getter skips every failed entry, including
   * another block's own marker, to find the last one that actually held.
   */
  get lastPassedCheck(): CheckRecord | undefined {
    return this.#checks.findLast((entry) => entry.ok)
  }

  /** Every committed block, in commit order, with how it ended. */
  get blocks(): ReadonlyMap<string, BlockOutcome> {
    return this.#blocks
  }

  /**
   * The package block currently inside {@link runBlocks}, or `undefined` between blocks and
   * outside a run entirely.
   *
   * This is what lets a run that hangs *inside* one block's checks — rather than dying outright —
   * name that block in a report: {@link Run.lastCheck} alone would only say what finished just
   * before it, not what never got the chance to.
   */
  get currentBlock(): string | undefined {
    return this.#current
  }

  /**
   * Record one assertion.
   *
   * @param name What was asserted, in the present tense.
   * @param ok Whether it held.
   * @param detail Evidence printed next to the name.
   */
  record(name: string, ok: boolean, detail = ""): void {
    this.#checks.push({ name, ok, detail })
  }

  /**
   * Commit this run to a list of package blocks before any of them is attempted.
   *
   * Committing early is the whole point: a run that dies during browser startup has still said
   * which blocks it meant to run, so the last line can name them instead of reporting a short but
   * apparently complete set of checks.
   *
   * @param names Package names, in run order. Committing a name twice leaves its outcome alone.
   */
  commit(names: readonly string[]): void {
    for (const name of names) {
      if (!this.#blocks.has(name)) this.#blocks.set(name, BlockOutcome.NeverRan)
    }
  }

  /**
   * Run every block, isolated from the others.
   *
   * A throw inside one block is recorded as exactly one failed check naming that package, and the
   * next block still runs. Without this, a single throw ended the phase and took every later
   * package's checks with it — silently, because the report's denominator shrank along with its
   * numerator.
   *
   * `recover` runs **only** after a block threw, never between two blocks that finished. A reset
   * that ran unconditionally would hide a real failure: a block that leaves a dialog open because
   * the dialog genuinely refuses to close should break the next block loudly, not be tidied up.
   *
   * @param blocks The blocks to run, in order.
   * @param context Passed to each block's `run`.
   * @param recover Best-effort cleanup after a throw; its own failure is ignored.
   */
  async runBlocks<Context>(
    blocks: readonly CheckBlock<Context>[],
    context: Context,
    recover?: (context: Context) => Promise<void>,
  ): Promise<void> {
    this.commit(blocks.map((block) => block.name))

    for (const block of blocks) {
      this.#current = block.name
      try {
        await block.run(context)
        this.#blocks.set(block.name, BlockOutcome.Completed)
      } catch (error) {
        this.#blocks.set(block.name, BlockOutcome.StoppedPartWay)
        // Naming the last check that did complete is what tells a reader "the browser died right
        // after X" apart from "X itself is broken" — a `DevtoolsClosedError` propagating out of a
        // check function reads the same as any other throw without this, and a review of this PR
        // found exactly that: a dead browser reported as a failure of whichever component happened
        // to be mid-check when it died. `lastPassedCheck`, not `lastCheck`: an earlier version named
        // `lastCheck` here, which a second review caught naming a *previous* block's own failure
        // marker ("the theme checks ran to completion", itself recorded with `ok: false`) as though
        // it were a check that had passed.
        const last = this.lastPassedCheck?.name
        const reason = describeError(error)
        this.record(
          `the ${block.name} checks ran to completion`,
          false,
          last ? `${reason} (last completed check: ${last})` : reason,
        )
        if (recover) await recover(context).catch(() => {})
      } finally {
        this.#current = undefined
      }
    }
  }

  /** How many recorded checks failed. */
  failures(): number {
    return this.#checks.filter((entry) => !entry.ok).length
  }

  /**
   * Build the last line of the report.
   *
   * Three shapes, and a reader has to be able to tell them apart without knowing what the totals
   * ought to be: every committed block finished, no block was committed at all (`--static`), or
   * something is missing. The third leads with `INCOMPLETE` so that the counts can never be read
   * as a whole run — they are the counts of whatever did run.
   *
   * @returns One line, no trailing newline.
   */
  summaryLine(): string {
    const counted = `${this.#checks.length - this.failures()}/${this.#checks.length} checks passed`
    if (this.#blocks.size === 0) return `${counted} — no package blocks were part of this run`

    const named = (outcome: BlockOutcome) =>
      [...this.#blocks].filter(([, state]) => state === outcome).map(([name]) => name)
    const stopped = named(BlockOutcome.StoppedPartWay)
    const never = named(BlockOutcome.NeverRan)

    if (stopped.length === 0 && never.length === 0) {
      return `${counted} — all ${this.#blocks.size} package blocks ran to completion`
    }

    const clauses: string[] = []
    if (stopped.length > 0) clauses.push(`${stopped.join(", ")} stopped part-way`)
    if (never.length > 0) clauses.push(`${never.join(", ")} never ran`)

    return `INCOMPLETE — ${counted}, but ${clauses.join(" and ")}; ` +
      `the totals count only the checks that ran`
  }

  /**
   * Every line of the report, in print order: one per check, a blank line, then the summary.
   *
   * Separated from printing so the summary can be asserted without a process exit.
   */
  reportLines(): string[] {
    const lines = this.#checks.map(({ name, ok, detail }) =>
      `${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`
    )

    return [...lines, "", this.summaryLine()]
  }
}

/** The ledger the script itself writes to; `harness.test.ts` builds its own instead. */
const currentRun = new Run()

/**
 * Record one assertion.
 *
 * @param name What was asserted, in the present tense.
 * @param ok Whether it held.
 * @param detail Evidence printed next to the name.
 */
export function check(name: string, ok: boolean, detail = ""): void {
  currentRun.record(name, ok, detail)
}

/**
 * Commit the run to a list of package blocks before attempting any of them.
 *
 * @param names Package names, in run order.
 */
export function commitBlocks(names: readonly string[]): void {
  currentRun.commit(names)
}

/**
 * The name of the last check recorded so far that genuinely passed, or `undefined` if none has —
 * see {@link Run.lastPassedCheck}. Never a block's own failure marker, even when that marker is the
 * most recently recorded entry.
 */
export function lastCheckName(): string | undefined {
  return currentRun.lastPassedCheck?.name
}

/** The package block currently running, or `undefined` between blocks — see {@link Run.currentBlock}. */
export function currentBlockName(): string | undefined {
  return currentRun.currentBlock
}

/**
 * Run every package block isolated from the others — see {@link Run.runBlocks}.
 *
 * @param blocks The blocks to run, in order.
 * @param context Passed to each block's `run`.
 * @param recover Best-effort cleanup after a throw.
 */
export function runBlocks<Context>(
  blocks: readonly CheckBlock<Context>[],
  context: Context,
  recover?: (context: Context) => Promise<void>,
): Promise<void> {
  return currentRun.runBlocks(blocks, context, recover)
}

/** Print the outcome and exit non-zero when anything failed. */
export function report(): never {
  for (const line of currentRun.reportLines()) console.log(line)
  Deno.exit(currentRun.failures() === 0 ? 0 : 1)
}

/** One key press, described the way the DevTools Protocol wants it. */
interface KeyPress {
  /** `KeyboardEvent.key`. */
  key: string
  /** `KeyboardEvent.code` — the physical key, which is what a `code`-based handler reads. */
  code: string
  /** Virtual key code; Chromium wants it in both the Windows and the native field. */
  keyCode: number
}

/**
 * Every key this library's components listen for, described once. `Space`'s `key` is a single
 * space character, not an empty string — an earlier run of this kind sent an empty one, which
 * Chromium accepts and no listener recognises.
 *
 * A table entry no check uses yet is not dead code the way an unused constant would be: it is
 * vocabulary a keyboard check reaches for once its component is covered, the same way a dictionary
 * carries a word before anyone quotes it.
 */
const KEYS = {
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Enter: { key: "Enter", code: "Enter", keyCode: 13 },
  Space: { key: " ", code: "Space", keyCode: 32 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  Home: { key: "Home", code: "Home", keyCode: 36 },
  End: { key: "End", code: "End", keyCode: 35 },
  PageUp: { key: "PageUp", code: "PageUp", keyCode: 33 },
  PageDown: { key: "PageDown", code: "PageDown", keyCode: 34 },
} as const satisfies Record<string, KeyPress>

/** A key {@link pressKey} knows how to send. */
export type KeyName = keyof typeof KEYS

/**
 * Press one key the way a person does — through the browser's own input pipeline.
 *
 * `Input.dispatchKeyEvent` is the point of this helper, and the obvious alternative is not
 * equivalent: `dispatchEvent(new KeyboardEvent(...))` inside the page produces an **untrusted**
 * event, and the browser skips its own default key handling for those. A synthetic Escape would
 * prove only that a listener was registered, never that pressing Escape does anything.
 *
 * `press` takes a key **name**, looked up in {@link KEYS}, rather than a description a caller
 * builds itself: the keyboard checks still to be written — arrow keys and Tab in Dropdown, arrow
 * keys/Home/End/Page Up/Page Down in Calendar, Enter/Space on an image that behaves like a button —
 * land in three different package files, and a name typed against one shared table is what keeps
 * `Tab` or `ArrowDown` from being described twice in two of them. A lane adding a keyboard check
 * reaches for a name here; it never has reason to edit this file. The table also makes pressing a
 * key nobody described a type error rather than a silent no-op.
 *
 * @param devtools The connected session; the key goes to whatever the page has focused.
 * @param name The key to send — one of {@link KEYS}.
 */
export async function pressKey(devtools: Devtools, name: KeyName): Promise<void> {
  const press = KEYS[name]
  for (const type of ["keyDown", "keyUp"]) {
    await devtools.send("Input.dispatchKeyEvent", {
      type,
      key: press.key,
      code: press.code,
      windowsVirtualKeyCode: press.keyCode,
      nativeVirtualKeyCode: press.keyCode,
    })
  }
}

/**
 * Thrown by every pending and future `Devtools` call once its socket has gone away — see
 * {@link Devtools}'s `onclose`/`onerror` handling. A distinct class rather than a plain `Error` is
 * what lets {@link poll} tell "the browser is dead" apart from an ordinary transient failure (an
 * element not there yet, a page exception from code still initialising) without matching on message
 * text.
 */
export class DevtoolsClosedError extends Error {}

/**
 * Poll `predicate` until it is true or the budget runs out.
 *
 * A predicate that throws is normally treated as "not ready yet" and retried — most callers use
 * `evaluate` on an element that may not exist for the first few hundred milliseconds. A
 * {@link DevtoolsClosedError} is not that: the browser is gone, so retrying only burns the rest of
 * the timeout before returning `false`, which a caller then reports as its own condition never
 * having become true — a dead browser blamed on whatever component the caller was checking (found
 * in review: a kill mid-run once printed `FAIL Toastr's own timer dismisses a toast`, not a word
 * about the browser). Rethrowing immediately instead lets that failure surface as what it is.
 */
export async function poll(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true
    } catch (error) {
      if (error instanceof DevtoolsClosedError) throw error
      // Some other, plausibly transient error; keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return false
}

/**
 * Wait until the page has stopped scrolling.
 *
 * Anything that reads a position or aims a click has to be measured after the page has settled:
 * `focus()` scrolls an element into view when it has to, and a route change can trigger a smooth
 * scroll that is still running when the very next line reads a coordinate or dispatches a press.
 * Moved here from `checks/ui.ts` (`#225`, `#238`) once `checks/pages.ts` needed the same wait for a
 * route's scroll rather than a fixed delay — one helper, not two copies drifting apart.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait for two consecutive reads to agree before giving up.
 */
export async function settledScroll(devtools: Devtools, timeoutMs = 3_000): Promise<void> {
  let previous = Number.NaN
  await poll(async () => {
    const current = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
    const settled = current === previous
    previous = current
    return settled
  }, timeoutMs)
}

/** Wait for Chromium's port file, which appears once the debugging server is up. */
export async function debuggingPort(profile: string, timeoutMs = 20_000): Promise<number> {
  const portFile = join(profile, "DevToolsActivePort")
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const [port] = (await Deno.readTextFile(portFile)).split("\n")
      if (port) return Number(port)
    } catch {
      // Not written yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Chromium never wrote ${portFile}`)
}

/**
 * Open a DevTools session against a fresh tab.
 *
 * @param port Debugging port Chromium bound.
 * @param timeoutMs How long to wait for a DevTools target before giving up.
 * @returns A client for that tab.
 */
export async function connect(port: number, timeoutMs = 10_000): Promise<Devtools> {
  const endpoint = `http://127.0.0.1:${port}`
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      // A debugging endpoint that accepts the TCP connection but never answers the HTTP request
      // hung this call forever before `AbortSignal.timeout` was added here — found in review, with a
      // fake browser that writes the port file and never answers. The `while` loop's own deadline
      // check above never got a turn: it only runs *between* iterations, and this was the one `await`
      // that never returned. Bounding this specific request is what lets the loop keep its promise.
      const response = await fetch(`${endpoint}/json/new?about:blank`, {
        method: "PUT",
        signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
      })
      const target = await response.json() as { webSocketDebuggerUrl?: string }
      if (target.webSocketDebuggerUrl) {
        return await Devtools.connect(
          target.webSocketDebuggerUrl,
          Math.max(deadline - Date.now(), 1),
        )
      }
    } catch {
      // The browser is still starting, or this attempt's request timed out — either way, retry
      // until the deadline above.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`no DevTools target on ${endpoint}`)
}

/** One protocol event, kept for the error report. */
interface ProtocolEvent {
  method: string
  params: Record<string, unknown>
}

/**
 * A small Chrome DevTools Protocol client: request/response plus the events this check reads.
 *
 * Deliberately hand-rolled — a protocol library would be the only dependency in this directory, to
 * send four commands and collect three kinds of event.
 */
export class Devtools {
  /**
   * How long a single `send` waits for its reply before rejecting, unless the caller asks for a
   * different budget. `verify.ts`'s browser phase carries its own overall deadline (`#239`), but
   * that deadline can only fire *between* awaits — a single request the browser never answers (the
   * process died mid-call, or wedged) would otherwise hang the one `await` forever and the phase
   * deadline would never get a turn to run.
   */
  static readonly DEFAULT_CALL_TIMEOUT_MS = 15_000

  #socket: WebSocket
  #nextId = 0
  #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  #events: ProtocolEvent[] = []
  #waiters: Array<
    {
      method: string
      resolve: (params: Record<string, unknown>) => void
      reject: (error: Error) => void
    }
  > = []
  /** Set once the socket has gone away; every pending and future `send` rejects with this. */
  #closed?: DevtoolsClosedError

  private constructor(socket: WebSocket) {
    this.#socket = socket
    socket.onmessage = (message) => this.#handle(JSON.parse(message.data as string))
    // A browser that dies mid-run (killed, crashed) closes this socket without answering whatever
    // was in flight. Left to each call's own timeout, a run with many blocks still to go would pay
    // that timeout over and over — once per call, in every remaining block — before the phase
    // deadline ever got a turn. Failing every pending and future call the moment the socket goes away
    // turns that into one immediate rejection each, so a dead browser is reported in roughly the time
    // one call's round trip would have taken, not the sum of everything still queued behind it.
    socket.onclose = () => this.#fail(new DevtoolsClosedError("the DevTools socket closed"))
    socket.onerror = () =>
      this.#fail(new DevtoolsClosedError("the DevTools socket reported an error"))
  }

  /** Fail every pending request and mark the client closed, once. */
  #fail(error: DevtoolsClosedError): void {
    if (this.#closed) return
    this.#closed = error
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
    for (const waiter of this.#waiters) waiter.reject(error)
    this.#waiters = []
  }

  /**
   * @param url WebSocket URL of the page target.
   * @param timeoutMs How long to wait for the socket to open before giving up.
   * @returns A connected client.
   */
  static async connect(url: string, timeoutMs = 10_000): Promise<Devtools> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Left open, this was a leaked connecting socket every time a launch attempt's DevTools
        // target never opened — found in review.
        socket.close()
        reject(new Error(`the DevTools socket at ${url} did not open within ${timeoutMs}ms`))
      }, timeoutMs)
      socket.onopen = () => {
        clearTimeout(timer)
        resolve()
      }
      socket.onerror = () => {
        clearTimeout(timer)
        reject(new Error(`cannot open the DevTools socket at ${url}`))
      }
    })

    return new Devtools(socket)
  }

  /**
   * Send a command and wait for its result.
   *
   * @param method Protocol method, e.g. `Page.navigate`.
   * @param params Method parameters.
   * @param timeoutMs How long to wait for a reply before rejecting — see
   * {@link Devtools.DEFAULT_CALL_TIMEOUT_MS}.
   * @returns The method's result.
   */
  send<T>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = Devtools.DEFAULT_CALL_TIMEOUT_MS,
  ): Promise<T> {
    if (this.#closed) return Promise.reject(this.#closed)

    const id = ++this.#nextId
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new Error(`${method} did not answer within ${timeoutMs}ms`))
      }, timeoutMs)
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.#socket.send(JSON.stringify({ id, method, params }))
    })
  }

  /**
   * Evaluate an expression in the page and return its value.
   *
   * @param expression JavaScript to run; a promise is awaited.
   * @param timeoutMs How long to wait for a reply before rejecting — see
   * {@link Devtools.DEFAULT_CALL_TIMEOUT_MS}.
   * @returns The JSON value the expression produced.
   */
  async evaluate<T>(expression: string, timeoutMs = Devtools.DEFAULT_CALL_TIMEOUT_MS): Promise<T> {
    const response = await this.send<{
      result: { value?: T }
      exceptionDetails?: { text: string }
    }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, timeoutMs)

    if (response.exceptionDetails) {
      throw new Error(`page exception: ${response.exceptionDetails.text}`)
    }

    return response.result.value as T
  }

  /**
   * Wait for the next protocol event with this method.
   *
   * @param method Event name, e.g. `Page.loadEventFired`.
   * @param timeoutMs How long to wait before giving up.
   */
  async next(method: string, timeoutMs = 15_000): Promise<void> {
    await this.once(method, timeoutMs)
  }

  /**
   * Wait for the next protocol event with this method, and return the params it carried.
   *
   * {@link next} is this with the params dropped, for a caller that only needs to know an event
   * happened. A caller that has to act on what it carried — a `Fetch.requestPaused` event's own
   * `requestId`, say, needed to release the request it names — needs this one instead.
   *
   * @param method Event name, e.g. `Fetch.requestPaused`.
   * @param timeoutMs How long to wait before giving up.
   */
  async once<T = Record<string, unknown>>(method: string, timeoutMs = 15_000): Promise<T> {
    if (this.#closed) throw this.#closed

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${method}`)),
        timeoutMs,
      )
      this.#waiters.push({
        method,
        resolve: (params) => {
          clearTimeout(timer)
          resolve(params as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
    })
  }

  /**
   * Wait for the next protocol event with this method, and return its params.
   *
   * `next` exists for a caller that only needs to know an event happened (a load, a navigation);
   * this is for one that needs what the event actually carried — `Network.requestWillBeSent`'s
   * `request.method` and `request.postData`, for a check that has to prove a plain HTML submit
   * really was a POST rather than assume it from the markup alone.
   *
   * @param method Event name, e.g. `Network.requestWillBeSent`.
   * @param timeoutMs How long to wait before giving up.
   * @returns The event's `params`, cast to `T` — nothing here validates the shape.
   */
  async waitForEvent<T>(method: string, timeoutMs = 15_000): Promise<T> {
    if (this.#closed) throw this.#closed

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${method}`)),
        timeoutMs,
      )
      this.#waiters.push({
        method,
        resolve: (params) => {
          clearTimeout(timer)
          resolve(params as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
    })
  }

  /** Everything the browser complained about during the session. */
  problems(): string[] {
    const problems: string[] = []

    for (const { method, params } of this.#events) {
      if (method === "Runtime.exceptionThrown") {
        const details = params.exceptionDetails as {
          text?: string
          exception?: { description?: string }
        }
        problems.push(`exception: ${details.exception?.description ?? details.text}`)
      }

      if (method === "Log.entryAdded") {
        const entry = params.entry as { level: string; text: string }
        if (entry.level === "error") problems.push(`console: ${entry.text}`)
      }

      if (method === "Runtime.consoleAPICalled") {
        const entry = params as unknown as { type: string; args: Array<{ value?: unknown }> }
        if (entry.type === "error") {
          problems.push(`console.error: ${entry.args.map((arg) => String(arg.value)).join(" ")}`)
        }
      }

      if (method === "Network.loadingFailed") {
        const failure = params as unknown as { errorText: string; canceled?: boolean }
        if (!failure.canceled) problems.push(`request failed: ${failure.errorText}`)
      }
    }

    return [...new Set(problems)]
  }

  /** Route one protocol message to its waiter, or record it as an event. */
  #handle(
    message: {
      id?: number
      method?: string
      params?: Record<string, unknown>
      result?: unknown
      error?: { message: string }
    },
  ): void {
    if (message.id !== undefined) {
      const pending = this.#pending.get(message.id)
      this.#pending.delete(message.id)
      if (!pending) return
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
      return
    }

    if (!message.method) return
    const params = message.params ?? {}
    this.#events.push({ method: message.method, params })

    const waiting = this.#waiters.filter((waiter) => waiter.method === message.method)
    this.#waiters = this.#waiters.filter((waiter) => waiter.method !== message.method)
    for (const waiter of waiting) waiter.resolve(params)
  }
}
