/**
 * The Playwright options every app shares, so an app's `playwright.config.ts` holds only its own
 * values: where the app is served, how to start it, and anything it does differently. Beside them,
 * two layout checks for an app's specs: {@link expectNotCovered} and {@link expectFitsInLanguages}.
 *
 * This module imports nothing, `@playwright/test` included. The app passes the one value that
 * comes from Playwright (`devices["Desktop Chrome"]`) and wraps the result in its own
 * `defineConfig`, and the layout checks take any page and locator shaped like Playwright's, so the
 * library never pins a Playwright version and an app that runs no browser test resolves no
 * Playwright package.
 *
 * @module
 */

/** One reporter: its name, then its options when it takes any. */
export type PlaywrightReporter = readonly [string] | readonly [string, Record<string, unknown>]

/** The `use` options {@link playwrightBaseConfig} sets for every app. */
export interface PlaywrightBaseUse {
  /** The address `page.goto("/")` resolves against. */
  baseURL: string
  /** The attribute `getByTestId` reads: `data-e2e`, the hook every component here carries. */
  testIdAttribute: string
  /** Milliseconds one action, such as a click, may take. */
  actionTimeout: number
  /** Milliseconds one navigation may take. */
  navigationTimeout: number
  /** A trace is kept for every failed test and for no other. */
  trace: "retain-on-failure"
}

/** What an app tells {@link playwrightBaseConfig}. */
export interface PlaywrightBaseOptions<Device extends object, Use extends object> {
  /** The address the app is served at, such as `"http://app.localhost"`. */
  baseURL: string
  /**
   * Whether this run is in CI, such as `!!Deno.env.get("CI")`. In CI a leftover `test.only` fails
   * the run and a failed test is retried twice.
   */
  ci: boolean
  /** The browser to run in: `devices["Desktop Chrome"]` from `@playwright/test`. */
  chromium: Device
  /** More `use` options, laid over the shared ones; a key given here replaces the shared value. */
  use?: Use
}

/** What {@link playwrightBaseConfig} returns: a value for Playwright's `defineConfig`. */
export interface PlaywrightBaseConfig<Device extends object, Use extends object> {
  /** Where the specs are: `./e2e`. */
  testDir: string
  /** Which files are specs: any `*.e2e.ts`. */
  testMatch: RegExp
  /** Where traces and other test output go: `./e2e/results`. */
  outputDir: string
  /** Whether a leftover `test.only` fails the run: in CI only. */
  forbidOnly: boolean
  /** How often a failed test is retried: twice in CI, never elsewhere. */
  retries: number
  /** Tests in one file run in order, because they share one server and its data. */
  fullyParallel: boolean
  /** One worker, for the same reason. */
  workers: number
  /** Milliseconds one test may take. */
  timeout: number
  /** An HTML report that never opens by itself, and a line per test in the terminal. */
  reporter: PlaywrightReporter[]
  /** The shared `use` options with the app's laid over them. */
  use: Omit<PlaywrightBaseUse, keyof Use> & Use
  /** One project, `chromium`, on the device the app passed. */
  projects: { name: string; use: Device }[]
}

/**
 * Build the Playwright configuration every app shares. Spread the result into `defineConfig` and
 * add the app's own keys after it (`webServer`, or a different `testMatch` or `reporter`): a key
 * written after the spread replaces the shared one. `use` is the exception, because it is nested;
 * pass extra `use` options in `options.use` instead, where they are merged.
 *
 * @example In `playwright.config.ts`, by the package's npm name: Playwright loads that file itself
 * and finds only packages in `node_modules` (`docs/app-checks.md` has the one-time setup).
 * ```ts
 * import { defineConfig, devices } from "@playwright/test"
 * import { playwrightBaseConfig } from "@jsr/spy4x__preact-playwright"
 *
 * export default defineConfig({
 *   ...playwrightBaseConfig({
 *     baseURL: "http://app.localhost",
 *     ci: !!Deno.env.get("CI"),
 *     chromium: devices["Desktop Chrome"],
 *   }),
 *   webServer: { command: "deno task start", url: "http://app.localhost/health" },
 * })
 * ```
 */
export function playwrightBaseConfig<
  Device extends object,
  Use extends object = Record<never, never>,
>(options: PlaywrightBaseOptions<Device, Use>): PlaywrightBaseConfig<Device, Use> {
  const shared: PlaywrightBaseUse = {
    baseURL: options.baseURL,
    testIdAttribute: "data-e2e",
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
  }
  // TypeScript types a spread of a generic as an intersection, which is wrong for a key the app
  // replaces with another type (`trace: "on"`), so the result is stated instead.
  const use = { ...shared, ...options.use } as unknown as Omit<PlaywrightBaseUse, keyof Use> & Use
  return {
    testDir: "./e2e",
    testMatch: /\.e2e\.ts$/,
    outputDir: "./e2e/results",
    forbidOnly: options.ci,
    retries: options.ci ? 2 : 0,
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    reporter: [["html", { open: "never" }], ["list"]],
    use,
    projects: [{ name: "chromium", use: { ...options.chromium } }],
  }
}

/** The part of a Playwright `Locator` the layout checks use; a real `Locator` satisfies it. */
export interface LayoutLocator {
  /** Waits until the element is visible. */
  waitFor(): Promise<void>
  /** Runs a function on the element, in the browser. */
  evaluate<Result>(pageFunction: (element: HTMLElement) => Result): Promise<Result>
}

/** The part of a Playwright `Page` the layout checks use; a real `Page` satisfies it. */
export interface LayoutPage {
  /** The current viewport, or `null` when the browser context has none of its own. */
  viewportSize(): { width: number; height: number } | null
  /** Resizes the viewport. */
  setViewportSize(size: { width: number; height: number }): Promise<void>
}

/** What {@link expectFitsInLanguages} checks, and how it reaches the screen. */
export interface FitsInLanguagesOptions<Page extends LayoutPage> {
  /** Every language to check; an empty list throws. */
  languages: readonly string[]
  /** Shows the screen in a language, the app's own way, and resolves once it is drawn. */
  open: (language: string) => void | Promise<void>
  /** The element to check. */
  target: (page: Page) => LayoutLocator
  /** The box the element must stay inside; the element's parent when left out. */
  container?: (page: Page) => LayoutLocator
  /** The viewport width in CSS pixels; 390 when left out. */
  width?: number
}

/**
 * Check that a person can reach an element: scroll it to the middle of the viewport, then fail
 * unless the element or something inside it is what the browser hits at its centre and just inside
 * its four corners. Playwright's `toBeInViewport` is true for an element under a fixed bar; this is
 * not. Corners follow the element's border radius, so a pill or a circle is tested on its own
 * surface. An overlay with `pointer-events: none` lets taps through, so it does not count as cover.
 *
 * @example
 * ```ts
 * await expectNotCovered(page.getByTestId("save"))
 * ```
 *
 * @param locator The element to check.
 * @throws When a point is covered or outside the viewport, naming each point and what is there.
 */
export async function expectNotCovered(locator: LayoutLocator): Promise<void> {
  await locator.waitFor()
  const { target, failures } = await locator.evaluate(findCoveredPoints)
  if (failures.length === 0) return
  throw new Error(
    `expectNotCovered: ${target} cannot be reached at ${failures.length} of 5 points:\n` +
      failures.map((failure) => `- ${failure}`).join("\n"),
  )
}

/**
 * Check that an element fits on a phone in every language: at 390 px wide it must stay inside its
 * container and the viewport's width, and its own text must not be clipped. Every language is
 * checked before the check fails, and the original viewport is restored either way. One pixel of
 * rounding is allowed.
 *
 * @example
 * ```ts
 * await expectFitsInLanguages(page, {
 *   languages: ["en", "de", "fr"],
 *   open: (language) => page.goto(`/${language}/settings`).then(() => undefined),
 *   target: (page) => page.getByTestId("save"),
 * })
 * ```
 *
 * @param page The page the screen is on.
 * @param options The languages, how to open the screen and the element to check.
 * @throws When `languages` is empty, when the page has no viewport of its own, or when a language
 * does not fit, listing each such language with the measured pixels.
 */
export async function expectFitsInLanguages<Page extends LayoutPage>(
  page: Page,
  options: FitsInLanguagesOptions<Page>,
): Promise<void> {
  if (options.languages.length === 0) {
    throw new Error("expectFitsInLanguages: `languages` is empty, so nothing would be checked")
  }
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error("expectFitsInLanguages: the page has no viewport size to change and restore")
  }
  const width = options.width ?? 390
  const failures: string[] = []
  try {
    await page.setViewportSize({ width, height: viewport.height })
    for (const language of options.languages) {
      const problems = await findFitProblems(page, options, language, width)
      if (problems.length > 0) failures.push(`- ${language}: ${problems.join("; ")}`)
    }
  } finally {
    await page.setViewportSize(viewport)
  }
  if (failures.length === 0) return
  throw new Error(
    `expectFitsInLanguages: ${failures.length} of ${options.languages.length} languages ` +
      `do not fit at ${width} px wide:\n${failures.join("\n")}`,
  )
}

/** An element's edges, in CSS pixels from the viewport's top left corner. */
interface Edges {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Open one language and say what does not fit in it. An error while opening or measuring is that
 * language's problem, so the languages after it are still checked.
 */
async function findFitProblems<Page extends LayoutPage>(
  page: Page,
  options: FitsInLanguagesOptions<Page>,
  language: string,
  width: number,
): Promise<string[]> {
  try {
    await options.open(language)
    const target = options.target(page)
    await target.waitFor()
    const fit = await target.evaluate(measureFit)
    const container = options.container
      ? (await options.container(page).evaluate(measureFit)).edges
      : fit.parent
    const viewport = { left: 0, right: width, top: -Infinity, bottom: Infinity }
    return [
      ...describeOverflow(fit.edges, container, "its container"),
      ...describeOverflow(fit.edges, viewport, "the viewport"),
      ...fit.clipped,
    ]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [`could not be checked: ${message.split("\n")[0]}`]
  }
}

/** Name each side where `inner` passes `outer` by more than one pixel of rounding. */
function describeOverflow(inner: Edges, outer: Edges, outerName: string): string[] {
  const overflow = {
    left: outer.left - inner.left,
    right: inner.right - outer.right,
    top: outer.top - inner.top,
    bottom: inner.bottom - outer.bottom,
  }
  return Object.entries(overflow).filter(([, pixels]) => pixels > 1).map(([side, pixels]) =>
    `passes ${outerName} by ${Math.round(pixels * 10) / 10} px on the ${side}`
  )
}

/**
 * Runs in the browser, so it uses nothing from this module: the element's edges, its parent's, and
 * a sentence for each way its own text is clipped.
 */
function measureFit(element: HTMLElement): { edges: Edges; parent: Edges; clipped: string[] } {
  const edgesOf = (of: Element): Edges => {
    const { left, right, top, bottom } = of.getBoundingClientRect()
    return { left, right, top, bottom }
  }
  const pixels = (value: number) => Math.round(value * 10) / 10
  const clipped: string[] = []
  const style = getComputedStyle(element)
  const canvas = document.createElement("canvas").getContext("2d")
  if (!canvas) throw new Error("the browser gave no canvas to measure text with")
  const useFont = (font: CSSStyleDeclaration) => {
    canvas.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`
    canvas.letterSpacing = font.letterSpacing
  }
  const field = element as HTMLInputElement
  const isTextArea = element.tagName === "TEXTAREA"
  const isTextInput = element.tagName === "INPUT" &&
    ["text", "search", "email", "url", "tel", "password", "number"].includes(field.type)

  if (isTextArea || isTextInput) {
    // A browser reports no overflow for a placeholder, so its text is measured instead.
    const text = field.value || field.placeholder
    const textStyle = getComputedStyle(element, field.value ? undefined : "::placeholder")
    useFont(textStyle)
    const width = field.clientWidth - parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    if (isTextArea) {
      // Text wraps here, so it is clipped only when its lines are taller than the box. Counting
      // by width alone ignores the room word wrapping wastes: this never reports a false clip.
      const height = field.clientHeight - parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom)
      const lineHeight = parseFloat(textStyle.lineHeight) || parseFloat(textStyle.fontSize) * 1.2
      const lines = text.split("\n").reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(canvas.measureText(line).width / width)),
        0,
      )
      if (lines * lineHeight > height + 1) {
        clipped.push(
          `its text is clipped: ${lines} lines need ${pixels(lines * lineHeight)} px of height, ` +
            `the box has ${pixels(height)} px`,
        )
      }
    } else {
      const needed = canvas.measureText(text).width
      if (needed > width + 1) {
        clipped.push(
          `its text is clipped: "${text}" needs ${pixels(needed)} px, ` +
            `the box has ${pixels(width)} px`,
        )
      }
    }
  } else {
    const hides = (overflow: string) => overflow === "hidden" || overflow === "clip"
    if (hides(style.overflowX) && element.scrollWidth > element.clientWidth + 1) {
      clipped.push(
        `its text is clipped: it needs ${element.scrollWidth} px of width, ` +
          `the box has ${element.clientWidth} px`,
      )
    }
    // A line height tighter than the font counts the font's unused room below the line as overflow,
    // though no letter is cut off, so that room is allowed.
    useFont(style)
    const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = canvas.measureText(
      "",
    )
    const lineHeight = parseFloat(style.lineHeight)
    const fontRoom = lineHeight ? Math.max(0, (ascent + descent - lineHeight) / 2) : 0
    if (hides(style.overflowY) && element.scrollHeight > element.clientHeight + 1 + fontRoom) {
      clipped.push(
        `its text is clipped: it needs ${element.scrollHeight} px of height, ` +
          `the box has ${element.clientHeight} px`,
      )
    }
  }

  const parent = element.parentElement ?? (element.getRootNode() as ShadowRoot).host
  return { edges: edgesOf(element), parent: edgesOf(parent), clipped }
}

/**
 * Runs in the browser, so it uses nothing from this module: scroll the element to the middle of the
 * viewport and describe each of its five points that something else answers for.
 */
function findCoveredPoints(element: HTMLElement): { target: string; failures: string[] } {
  const describe = (of: Element) => {
    const tag = of.tagName.toLowerCase()
    const testId = of.getAttribute("data-e2e")
    if (testId) return `${tag}[data-e2e="${testId}"]`
    if (of.id) return `${tag}#${of.id}`
    return of.classList[0] ? `${tag}.${of.classList[0]}` : tag
  }
  // Walks the flattened tree, so a child slotted into the element counts as inside it.
  const isInside = (hit: Element) => {
    let node: Node | null = hit
    while (node && node !== element) {
      node = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null
    }
    return node === element
  }

  // Instant, because `scroll-behavior: smooth` would leave the element still moving when measured.
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  const box = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  // How far in from both edges a corner's curve passes, for a radius of `rx` by `ry` (1 - cos 45°),
  // plus a pixel so that rounding cannot land the point just outside the element.
  const cornerInset = (radius: string) => {
    const [first, second = first] = radius.split(" ")
    const resolve = (value: string, size: number) =>
      value.endsWith("%") ? parseFloat(value) / 100 * size : parseFloat(value)
    const rx = resolve(first, box.width)
    const ry = resolve(second, box.height)
    // The browser shrinks a radius too large for the box, as on a pill's `9999px`.
    const scale = Math.min(1, box.width / (2 * rx || 1), box.height / (2 * ry || 1))
    return { x: rx * scale * (1 - Math.SQRT1_2) + 1, y: ry * scale * (1 - Math.SQRT1_2) + 1 }
  }
  const topLeft = cornerInset(style.borderTopLeftRadius)
  const topRight = cornerInset(style.borderTopRightRadius)
  const bottomLeft = cornerInset(style.borderBottomLeftRadius)
  const bottomRight = cornerInset(style.borderBottomRightRadius)
  const points: [string, number, number][] = [
    ["centre", box.left + box.width / 2, box.top + box.height / 2],
    ["top left", box.left + topLeft.x, box.top + topLeft.y],
    ["top right", box.right - topRight.x, box.top + topRight.y],
    ["bottom left", box.left + bottomLeft.x, box.bottom - bottomLeft.y],
    ["bottom right", box.right - bottomRight.x, box.bottom - bottomRight.y],
  ]

  const root = element.getRootNode() as Document | ShadowRoot
  const failures: string[] = []
  for (const [name, x, y] of points) {
    const hit = root.elementFromPoint(x, y)
    const at = `${name} (${Math.round(x)}, ${Math.round(y)})`
    if (!hit) failures.push(`${at}: outside the viewport`)
    else if (!isInside(hit)) failures.push(`${at}: covered by ${describe(hit)}`)
  }
  return { target: describe(element), failures }
}
