/**
 * Shared machinery for every browser check: the results ledger, the small `Devtools` client that
 * drives Chromium over the DevTools Protocol, and the key-press/poll helpers more than one package
 * file needs.
 *
 * This module exists so there is exactly one of each: one results array, one `Devtools` class, one
 * `pressKey`. `pages/verify.ts` owns the browser's startup and teardown and calls into one file per
 * workspace package under `pages/checks/`; every one of those files imports what it needs from here
 * rather than redefining it.
 */

import { join } from "node:path"

/** One assertion's outcome. */
interface Check {
  name: string
  ok: boolean
  detail: string
}

const checks: Check[] = []

/**
 * Record one assertion.
 *
 * @param name What was asserted, in the present tense.
 * @param ok Whether it held.
 * @param detail Evidence printed next to the name.
 */
export function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail })
}

/** Print the outcome and exit non-zero when anything failed. */
export function report(): never {
  const failed = checks.filter((entry) => !entry.ok)
  for (const { name, ok, detail } of checks) {
    console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  }

  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  Deno.exit(failed.length === 0 ? 0 : 1)
}

/** One key press, described the way the DevTools Protocol wants it. */
export interface KeyPress {
  /** `KeyboardEvent.key`. */
  key: string
  /** `KeyboardEvent.code` — the physical key, which is what a `code`-based handler reads. */
  code: string
  /** Virtual key code; Chromium wants it in both the Windows and the native field. */
  keyCode: number
}

/** Escape: the dismiss key every overlay in this library is supposed to listen for. */
export const ESCAPE: KeyPress = { key: "Escape", code: "Escape", keyCode: 27 }

/**
 * Press one key the way a person does — through the browser's own input pipeline.
 *
 * `Input.dispatchKeyEvent` is the point of this helper, and the obvious alternative is not
 * equivalent: `dispatchEvent(new KeyboardEvent(...))` inside the page produces an **untrusted**
 * event, and the browser skips its own default key handling for those. A synthetic Escape would
 * prove only that a listener was registered, never that pressing Escape does anything.
 *
 * Shared rather than inlined because the keyboard checks still to be written — arrow keys in
 * Dropdown, Tabs and Calendar, Tab out of a Combobox, Escape on a Tooltip — all need this same pair
 * of protocol messages.
 *
 * @param devtools The connected session; the key goes to whatever the page has focused.
 * @param press The key to send.
 */
export async function pressKey(devtools: Devtools, press: KeyPress): Promise<void> {
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
