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

/** Render a thrown value for the detail column; a non-`Error` throw is as readable as any other. */
function describeError(error: unknown): string {
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

  /** Every check recorded so far, in the order they were recorded. */
  get checks(): readonly CheckRecord[] {
    return this.#checks
  }

  /** Every committed block, in commit order, with how it ended. */
  get blocks(): ReadonlyMap<string, BlockOutcome> {
    return this.#blocks
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
      try {
        await block.run(context)
        this.#blocks.set(block.name, BlockOutcome.Completed)
      } catch (error) {
        this.#blocks.set(block.name, BlockOutcome.StoppedPartWay)
        this.record(`the ${block.name} checks ran to completion`, false, describeError(error))
        if (recover) await recover(context).catch(() => {})
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

/** Poll `predicate` until it is true or the budget runs out. */
export async function poll(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true
    } catch {
      // The page may not be answering yet; keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return false
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
 * @returns A client for that tab.
 */
export async function connect(port: number): Promise<Devtools> {
  const endpoint = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" })
      const target = await response.json() as { webSocketDebuggerUrl?: string }
      if (target.webSocketDebuggerUrl) {
        return await Devtools.connect(target.webSocketDebuggerUrl)
      }
    } catch {
      // The browser is still starting.
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
  #socket: WebSocket
  #nextId = 0
  #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  #events: ProtocolEvent[] = []
  #waiters: Array<{ method: string; resolve: () => void }> = []

  private constructor(socket: WebSocket) {
    this.#socket = socket
    socket.onmessage = (message) => this.#handle(JSON.parse(message.data as string))
  }

  /**
   * @param url WebSocket URL of the page target.
   * @returns A connected client.
   */
  static async connect(url: string): Promise<Devtools> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error(`cannot open the DevTools socket at ${url}`))
    })

    return new Devtools(socket)
  }

  /**
   * Send a command and wait for its result.
   *
   * @param method Protocol method, e.g. `Page.navigate`.
   * @param params Method parameters.
   * @returns The method's result.
   */
  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.#nextId
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      this.#socket.send(JSON.stringify({ id, method, params }))
    })
  }

  /**
   * Evaluate an expression in the page and return its value.
   *
   * @param expression JavaScript to run; a promise is awaited.
   * @returns The JSON value the expression produced.
   */
  async evaluate<T>(expression: string): Promise<T> {
    const response = await this.send<{
      result: { value?: T }
      exceptionDetails?: { text: string }
    }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })

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
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${method}`)),
        timeoutMs,
      )
      this.#waiters.push({
        method,
        resolve: () => {
          clearTimeout(timer)
          resolve()
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
    this.#events.push({ method: message.method, params: message.params ?? {} })

    const waiting = this.#waiters.filter((waiter) => waiter.method === message.method)
    this.#waiters = this.#waiters.filter((waiter) => waiter.method !== message.method)
    for (const waiter of waiting) waiter.resolve()
  }
}
