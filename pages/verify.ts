/**
 * Verify the built artefact — statically, then in a real browser.
 *
 * The static phase reads `dist/` and asserts the document's shape: base-prefixed asset paths that
 * exist, prerendered cards for every component, and a stylesheet that actually carries the theme.
 * That alone would not prove the page *works* — a prerendered catalogue is not an interactive one —
 * so the second phase serves `dist/` at the same base GitHub Pages uses, drives headless Chromium
 * over the DevTools Protocol, and exercises what the issue asks for: the dropdown, the switches, the
 * icon filter, click-to-copy, the toasts, the deep links, the colour scheme — then reports any
 * console error, page exception or failed request the run produced.
 *
 * ```bash
 * deno task build && deno task verify          # both phases
 * deno task verify --static                    # skip the browser
 * ```
 *
 * Chromium is a local verification tool only: it is not in the Pages workflow, which has no browser
 * assertion to make about a static file deploy.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { catalogueNames, catalogueSections } from "@preact-components/ui-guide/registry"
import { demoElementId } from "./src/deep-link.ts"
import { type PreviewServer, serveDist } from "./serve.ts"
import { DEFAULT_BASE, normalizeBase } from "./src/site.ts"

/** This file's directory: the demo's root, `pages/`. */
const PAGES_DIRECTORY = dirname(fileURLToPath(import.meta.url))
/** The artefact `build.ts` writes. */
const DIST_DIRECTORY = join(PAGES_DIRECTORY, "dist")
/** Base the artefact was built for. */
const BASE = normalizeBase(Deno.env.get("PAGES_BASE") ?? DEFAULT_BASE)

/** Executables tried, in order, when `CHROME_PATH` is unset. */
const CHROMIUM_CANDIDATES = [
  "chromium-browser",
  "chromium",
  "google-chrome",
  "google-chrome-stable",
  "chrome",
]

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
function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail })
}

/** Print the outcome and exit non-zero when anything failed. */
function report(): never {
  const failed = checks.filter((entry) => !entry.ok)
  for (const { name, ok, detail } of checks) {
    console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  }

  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  Deno.exit(failed.length === 0 ? 0 : 1)
}

/** Read the artefact and assert its shape. */
async function staticPhase(): Promise<void> {
  console.log(`static phase — ${DIST_DIRECTORY}`)

  let html: string
  try {
    html = await Deno.readTextFile(join(DIST_DIRECTORY, "index.html"))
  } catch {
    console.error(`no build found in ${DIST_DIRECTORY} — run \`deno task build\` first`)
    Deno.exit(1)
  }

  const cssHref = html.match(/<link rel="stylesheet" href="([^"]+)"/)?.[1] ?? ""
  const islandSrc = html.match(/<script type="module" src="([^"]+)"/)?.[1] ?? ""

  check("stylesheet href is base-prefixed", cssHref.startsWith(BASE), cssHref)
  check("island src is base-prefixed", islandSrc.startsWith(BASE), islandSrc)
  check(
    "the host page opts into the preset",
    /<body class="[^"]*theme-base/.test(html),
    "body.theme-base",
  )

  const stylesheet = await readAsset(cssHref)
  const island = await readAsset(islandSrc)

  check("browser JS is emitted, not only markup", island.length > 10_000, `${island.length} bytes`)
  check(
    "the island ships the host page",
    island.includes("live UI guide"),
    "page title string found in the bundle",
  )
  check(
    "tokens.css reaches the build",
    stylesheet.includes("--color-primary"),
    "custom property found in the compiled CSS",
  )
  check(
    "preset.css reaches the build",
    stylesheet.includes(".theme-base") && stylesheet.includes(".btn"),
    ".theme-base and .btn rules found",
  )

  // Counted against the catalogue rather than the `ui` barrel: the cards the guide renders are the
  // registry's, and every covered package contributes some.
  const cards = catalogueNames.filter((name) => html.includes(`id="${demoElementId(name)}"`))
  check(
    "every component has a prerendered card",
    cards.length === catalogueNames.length,
    `${cards.length}/${catalogueNames.length}`,
  )
  const sections = catalogueSections.filter((section) => html.includes(`id="${section.id}"`))
  check(
    "every catalogue section is prerendered",
    sections.length === catalogueSections.length,
    sections.map((section) => section.id).join(", "),
  )
  check("the icon gallery is prerendered", /data-icon="Icon/.test(html), "data-icon cells in HTML")
  check("snippets are prerendered", html.includes("<details>"), "usage snippets in HTML")
}

/** Fetch one built asset and assert it is served at the deployed base. */
async function readAsset(href: string): Promise<string> {
  const relative = href.startsWith(BASE) ? href.slice(BASE.length) : href
  try {
    const bytes = await Deno.readFile(join(DIST_DIRECTORY, relative))
    check(`asset exists: ${relative}`, bytes.length > 0, `${bytes.length} bytes`)
    return new TextDecoder().decode(bytes)
  } catch {
    check(`asset exists: ${relative}`, false, "404")
    return ""
  }
}

/** Find a Chromium to drive, or `undefined` when the machine has none. */
async function findChromium(): Promise<string | undefined> {
  const configured = Deno.env.get("CHROME_PATH")
  const candidates = configured ? [configured] : CHROMIUM_CANDIDATES

  for (const candidate of candidates) {
    try {
      const { success } = await new Deno.Command(candidate, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      }).output()
      if (success) return candidate
    } catch {
      // Not installed; try the next one.
    }
  }

  return undefined
}

/** Drive the page in headless Chromium and assert the interactions. */
async function browserPhase(): Promise<void> {
  const chromium = await findChromium()
  if (!chromium) {
    console.log("\nno Chromium found — browser phase skipped (set CHROME_PATH to run it)")
    return
  }

  console.log(`\nbrowser phase — ${chromium}`)

  let server: PreviewServer | undefined
  let profile: string | undefined
  let browser: Deno.ChildProcess | undefined

  try {
    server = await serveDist(DIST_DIRECTORY, BASE, 0)
    profile = await Deno.makeTempDir({ prefix: "pages-chromium-" })

    browser = new Deno.Command(chromium, {
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      stdout: "null",
      stderr: "null",
    }).spawn()

    const devtools = await connect(await debuggingPort(profile))
    await devtools.send("Runtime.enable", {})
    await devtools.send("Log.enable", {})
    await devtools.send("Network.enable", {})
    await devtools.send("Page.enable", {})

    await devtools.send("Page.navigate", { url: server.url })
    await devtools.next("Page.loadEventFired")

    const hydrated = await poll(
      () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
      10_000,
    )
    check("the island hydrates the prerendered page", hydrated, "data-hydrated set by an effect")

    if (hydrated) {
      await interactionChecks(devtools)
    }

    const errors = devtools.problems()
    check(
      "no console errors, exceptions or failed requests",
      errors.length === 0,
      errors.length === 0 ? `${server.url} loaded clean` : errors.join(" | "),
    )
  } finally {
    browser?.kill("SIGKILL")
    await browser?.status.catch(() => {})
    if (profile) await Deno.remove(profile, { recursive: true }).catch(() => {})
    await server?.close()
  }
}

/** Every interaction the acceptance list names, each one asserting on the DOM it changed. */
async function interactionChecks(devtools: Devtools): Promise<void> {
  const dropdown = await devtools.evaluate<{
    before: State
    open: State
    closed: State
  }>(`(async () => {
    const card = document.querySelector("#demo-Dropdown")
    const trigger = card.querySelector("button[aria-expanded]")
    const panel = card.querySelector('[role="menu"]')
    const state = () => ({
      expanded: trigger.getAttribute("aria-expanded"),
      hidden: panel.classList.contains("hidden"),
    })
    const settle = () => new Promise((done) => setTimeout(done, 50))
    const before = state()
    trigger.click()
    await settle()
    const open = state()
    trigger.click()
    await settle()
    return { before, open, closed: state() }
  })()`)
  check(
    "Dropdown opens and closes on click",
    dropdown.before.expanded === "false" && dropdown.open.expanded === "true" &&
      dropdown.open.hidden === false && dropdown.closed.hidden === true,
    `aria-expanded ${dropdown.before.expanded} → ${dropdown.open.expanded} → ${dropdown.closed.expanded}`,
  )

  const switches = await devtools.evaluate<{ count: number; before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-ToggleSwitch")
      const switches = [...card.querySelectorAll('button[role="switch"]')]
      const before = switches[0].getAttribute("aria-checked")
      switches[0].click()
      await new Promise((done) => setTimeout(done, 50))
      return { count: switches.length, before, after: switches[0].getAttribute("aria-checked") }
    })()`,
  )
  check(
    "ToggleSwitch toggles its controlled value",
    switches.before !== switches.after,
    `${switches.before} → ${switches.after} across ${switches.count} switches`,
  )

  const segmented = await devtools.evaluate<{ before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-OnOffButtons")
      const off = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("OFF"))
      const before = off.className
      off.click()
      await new Promise((done) => setTimeout(done, 50))
      return { before, after: off.className }
    })()`,
  )
  check("OnOffButtons switches the selected half", segmented.before !== segmented.after)

  const filter = await devtools.evaluate<{
    total: number
    filtered: number
    allMatch: boolean
    status: string
  }>(
    `(async () => {
      const input = document.querySelector('#icons input[name="icon-search"]')
      const total = document.querySelectorAll("#icons [data-icon]").length
      input.focus()
      input.value = "arrow"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await new Promise((done) => setTimeout(done, 50))
      const shown = [...document.querySelectorAll("#icons [data-icon]")]
        .map((cell) => cell.getAttribute("data-icon"))
      return {
        total,
        filtered: shown.length,
        allMatch: shown.every((name) => name.toLowerCase().includes("arrow")),
        status: document.querySelector("#icons p[aria-live]").textContent.trim(),
      }
    })()`,
  )
  check(
    "the icon filter filters 101 glyphs live",
    filter.total > 90 && filter.filtered > 0 && filter.filtered < filter.total && filter.allMatch,
    `${filter.filtered}/${filter.total} — ${filter.status}`,
  )

  const copy = await devtools.evaluate<{ name: string; status: string }>(
    `(async () => {
      const cell = document.querySelector("#icons [data-icon]")
      const name = cell.getAttribute("data-icon")
      cell.click()
      await new Promise((done) => setTimeout(done, 50))
      return { name, status: document.querySelector("#icons p[aria-live]").textContent }
    })()`,
  )
  check(
    "clicking an icon copies its JSX",
    copy.status.includes("copied") && copy.status.includes(`<${copy.name} />`),
    copy.status.trim(),
  )

  const toasts = await devtools.evaluate<{ pushed: boolean; text: string }>(
    `(async () => {
      const card = document.querySelector("#demo-Toastr")
      const button = [...card.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "success")
      button.click()
      await new Promise((done) => setTimeout(done, 50))
      return { pushed: document.body.textContent.includes("pushed by the demo stack"), text: button.textContent.trim() }
    })()`,
  )
  check("Toastr pushes a toast from the demo stack", toasts.pushed, `clicked "${toasts.text}"`)

  const deepLink = await devtools.evaluate<{
    marked: boolean
    current: string
    title: string
    scrolled: boolean
  }>(
    `(async () => {
      location.hash = "#toggle-switch"
      await new Promise((done) => setTimeout(done, 800))
      return {
        marked: document.querySelector("#demo-ToggleSwitch").hasAttribute("data-deep-link"),
        current: document.querySelector('a[aria-current="true"]')?.textContent ?? "",
        title: document.title,
        scrolled: document.documentElement.scrollTop > 0,
      }
    })()`,
  )
  check(
    "a deep link marks, scrolls to and titles its demo",
    deepLink.marked && deepLink.scrolled && deepLink.current === "ToggleSwitch" &&
      deepLink.title.startsWith("ToggleSwitch"),
    `#toggle-switch → ${deepLink.title}`,
  )

  const theme = await devtools.evaluate<{ before: boolean; after: boolean; pressed: string }>(
    `(async () => {
      const button = [...document.querySelectorAll("header button")]
        .find((candidate) => ["Dark", "Light"].includes(candidate.textContent.trim()))
      const before = document.documentElement.classList.contains("dark")
      button.click()
      await new Promise((done) => setTimeout(done, 50))
      return {
        before,
        after: document.documentElement.classList.contains("dark"),
        pressed: button.getAttribute("aria-pressed"),
      }
    })()`,
  )
  check(
    "the palette toggle flips the class the preset styles against",
    theme.before !== theme.after,
    `dark ${theme.before} → ${theme.after}, aria-pressed=${theme.pressed}`,
  )

  // Markup alone does not prove the stylesheet is live: these read declarations only Tailwind could
  // have emitted, only the preset's document rules could have applied, and only `tokens.css` can
  // switch between the two palettes.
  const styled = await devtools.evaluate<{
    buttonRadius: string
    buttonBackground: string
    light: string
    dark: string
    outline: string
  }>(`(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const canvas = () => getComputedStyle(document.body).backgroundColor
    root.classList.toggle("dark", false)
    const light = canvas()
    root.classList.toggle("dark", true)
    const dark = canvas()
    root.classList.toggle("dark", wasDark)

    const button = document.querySelector("#demo-Button button")
    return {
      buttonRadius: getComputedStyle(button).borderRadius,
      buttonBackground: getComputedStyle(button).backgroundColor,
      light,
      dark,
      outline: getComputedStyle(document.querySelector("#demo-ToggleSwitch")).outlineWidth,
    }
  })()`)
  check(
    "Tailwind utilities style the components in the browser",
    styled.buttonRadius === "6px" && styled.buttonBackground !== "rgba(0, 0, 0, 0)",
    `Button radius ${styled.buttonRadius} (rounded-md), primary fill ${styled.buttonBackground}`,
  )
  check(
    "tokens.css switches the palette on the .dark class",
    styled.light !== "rgba(0, 0, 0, 0)" && styled.light !== styled.dark,
    `canvas ${styled.light} light / ${styled.dark} dark`,
  )
  check(
    "the deep link outlines its card",
    styled.outline === "2px",
    `outline-width ${styled.outline} from styles.css`,
  )
}

/** One side of a dropdown's open/closed state. */
interface State {
  expanded: string | null
  hidden: boolean
}

/** Poll `predicate` until it is true or the budget runs out. */
async function poll(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
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
async function debuggingPort(profile: string, timeoutMs = 20_000): Promise<number> {
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
async function connect(port: number): Promise<Devtools> {
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
class Devtools {
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

await staticPhase()
if (!Deno.args.includes("--static")) {
  await browserPhase()
}
report()
