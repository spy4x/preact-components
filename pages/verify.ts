/**
 * Verify the built artefact — statically, then in a real browser.
 *
 * The static phase reads `dist/` and asserts the document's shape: base-prefixed asset paths that
 * exist, prerendered cards for every component and every theme-class card, a copy control on every
 * usage block, and a stylesheet that actually carries the theme. That alone would not prove the page
 * *works* — a prerendered catalogue is not an interactive one — so the second phase serves `dist/`
 * at the same base GitHub Pages uses, drives headless Chromium over the DevTools Protocol, and
 * exercises what the issues ask for: the dropdown, the switches, the icon filter, click-to-copy in
 * the gallery and on every usage block, the form controls of the class chapter, the surface classes
 * as computed styles, the scroll container, the toasts, the deep links, the colour scheme — then
 * reports any console error, page exception or failed request the run produced.
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
import { routeTableDrift } from "@preact-components/ui-guide/routes"
import { demoElementId } from "./src/deep-link.ts"
import { routeTableFromHtml } from "./src/route-echo.ts"
import { type PreviewServer, serveDist } from "./serve.ts"
import { DEFAULT_BASE, normalizeBase, PAGE_TITLE } from "./src/site.ts"

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
  const named = catalogueNames.filter((name) => html.includes(`id="${demoElementId(name)}"`))
  check(
    "every component has a prerendered card",
    named.length === catalogueNames.length,
    `${named.length}/${catalogueNames.length}`,
  )
  const sections = catalogueSections.filter((section) => html.includes(`id="${section.id}"`))
  check(
    "every catalogue section is prerendered",
    sections.length === catalogueSections.length,
    sections.map((section) => section.id).join(", "),
  )
  check("the icon gallery is prerendered", /data-icon="Icon/.test(html), "data-icon cells in HTML")

  // Read one card at a time: the host page's navigation has copy buttons of its own, so a count over
  // the whole document would pass with no card carrying one. An `<article>` holds no nested article,
  // which is what makes the non-greedy match a card.
  const cards = [...html.matchAll(/<article id="demo-[^"]+"[\s\S]*?<\/article>/g)].map((match) =>
    match[0]
  )
  const withoutSnippet = cards.filter((card) =>
    !/data-e2e="usage"><details[^>]*><summary[^>]*>Usage<\/summary><pre[^>]*><code>/.test(card)
  )
  const withoutCopy = cards.filter((card) =>
    !/data-e2e="usage"[\s\S]*?aria-label="Copy the [^"]+ snippet"/.test(card)
  )

  check(
    "every card prerenders its usage snippet",
    cards.length === catalogueNames.length && withoutSnippet.length === 0,
    `${
      cards.length - withoutSnippet.length
    }/${catalogueNames.length} cards carry the details/pre pair`,
  )
  check(
    "every card's usage block has a labelled copy control",
    cards.length === catalogueNames.length && withoutCopy.length === 0,
    `${cards.length - withoutCopy.length}/${catalogueNames.length} cards label their copy control`,
  )

  // The class chapter is the part of the stylesheet a component cannot demonstrate; assert the
  // sections ship their cards rather than trusting the section loop above to imply it.
  const classCards = catalogueSections
    .filter((section) => section.kind === "class")
    .flatMap((section) => section.names)
  const rendered = classCards.filter((name) => html.includes(`id="${demoElementId(name)}"`))
  check(
    "every theme-class card is prerendered",
    rendered.length === classCards.length,
    `${rendered.length}/${classCards.length} — ${classCards.join(", ")}`,
  )

  // Hash routing: under it the one document *is* every route, so the artefact's own route echo is
  // checked here as well as at build time — this reads the bytes that are actually served, and the
  // third check is the one that says the navigation links to the routes the resolver accepts.
  let routes: ReturnType<typeof routeTableFromHtml> | undefined
  try {
    routes = routeTableFromHtml(html)
  } catch {
    routes = undefined
  }

  check(
    "the document echoes the route table",
    routes !== undefined,
    routes ? `${routes.sections.length} sections, ${routes.demos.length} demos` : "no route echo",
  )
  const routeDrift = routes ? routeTableDrift(routes) : ["the document carries no route echo"]
  check(
    "every echoed route resolves back to its own section or demo",
    routeDrift.length === 0,
    routeDrift.length === 0 ? "every entry round-tripped" : routeDrift.join(" | "),
  )

  // A route no chip points at would be a page nobody can reach; a chip pointing at a route the
  // resolver refuses would be a dead link. Both directions, over the whole catalogue.
  const routeEntries = [...(routes?.sections ?? []), ...(routes?.demos ?? [])]
  const linked = routeEntries.filter((entry) => html.includes(`href="${entry.href}"`))
  check(
    "every emitted route is a link in the prerendered navigation",
    linked.length > 0 && linked.length === routeEntries.length,
    `${linked.length}/${routeEntries.length} routes carry their canonical href`,
  )
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

/** The outcome of looking for a browser to drive. */
interface ChromiumLookup {
  /** The executable to drive, or `undefined` when nothing ran. */
  executable?: string
  /** Evidence for the check: what ran, or what was tried and did not. */
  detail: string
}

/**
 * Find a Chromium to drive.
 *
 * `CHROME_PATH`, when set, is the only candidate: a configured path that does not run is a
 * misconfiguration, and silently falling back to some other browser on the machine would hide it.
 * The returned detail says which of the two happened, because the caller turns it into a check.
 *
 * @returns The executable and how it was found, or no executable and why there is none.
 */
async function findChromium(): Promise<ChromiumLookup> {
  const configured = Deno.env.get("CHROME_PATH")
  const candidates = configured ? [configured] : CHROMIUM_CANDIDATES

  for (const candidate of candidates) {
    try {
      const { success } = await new Deno.Command(candidate, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      }).output()
      if (success) return { executable: candidate, detail: `${candidate} --version ran` }
    } catch {
      // Not installed; try the next one.
    }
  }

  return {
    detail: configured
      ? `CHROME_PATH is set to \`${configured}\` and that path did not run`
      : `none of ${CHROMIUM_CANDIDATES.join(", ")} ran — set CHROME_PATH, ` +
        `or pass --static to skip the browser on purpose`,
  }
}

/** Drive the page in headless Chromium and assert the interactions. */
async function browserPhase(): Promise<void> {
  // A missing browser is a failure, not a skip. This phase carries every assertion about behaviour
  // the markup cannot show, so a run that quietly dropped it and still exited 0 reported a green
  // check for code nothing had executed. `--static` is the one explicit way to leave it out.
  const { executable: chromium, detail } = await findChromium()
  check("a Chromium binary is available for the browser phase", chromium !== undefined, detail)
  if (!chromium) return

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
  } catch (error) {
    // A throw half-way through used to take `report()` with it: the process exited non-zero with a
    // stack trace and printed none of the checks that had already passed. Recorded as one more
    // failed check instead, so the run still reports and the reason sits in the same list.
    check(
      "the browser phase ran to completion",
      false,
      error instanceof Error ? error.message : String(error),
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
    "the icon filter filters 119 glyphs live",
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

  // #30: every usage block's own copy control, clicked for real, has to put that block's text on the
  // clipboard. `navigator.clipboard` is stubbed in the page rather than read back, because reading
  // it needs a permission this run does not grant; the stub is what the page's own copy path calls.
  const copyBlocks = await devtools.evaluate<{
    patched: boolean
    cards: number
    unlabelled: string[]
    unconverted: string[]
    missing: string[]
    feedback: boolean
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 0))
    const copied = []
    const writeText = (text) => {
      copied.push(text)
      return Promise.resolve()
    }
    try {
      navigator.clipboard.writeText = writeText
    } catch {
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    }

    const cards = [...document.querySelectorAll('article[id^="demo-"]')]
    const missing = []
    const unconverted = []
    const unlabelled = []
    let feedback = false

    for (const [index, card] of cards.entries()) {
      const block = card.querySelector('[data-e2e="usage"]')
      const button = block?.querySelector("button")
      if (!block || !button) {
        missing.push(card.id)
        continue
      }
      if (!(button.getAttribute("aria-label") ?? "").startsWith("Copy the ")) {
        unlabelled.push(card.id)
      }

      const before = button.innerHTML
      copied.length = 0
      button.click()
      await settle()
      if (index === 0) feedback = button.innerHTML !== before
      if (copied[0] !== block.querySelector("pre code").textContent) unconverted.push(card.id)
    }

    return {
      patched: navigator.clipboard.writeText === writeText,
      cards: cards.length,
      unlabelled,
      unconverted,
      missing,
      feedback,
    }
  })()`)
  check(
    "every usage block copies its own text, through a labelled control",
    copyBlocks.patched && copyBlocks.cards > 30 && copyBlocks.missing.length === 0 &&
      copyBlocks.unlabelled.length === 0 && copyBlocks.unconverted.length === 0,
    `${copyBlocks.cards} blocks, ${copyBlocks.missing.length} without a control, ` +
      `${copyBlocks.unconverted.length} copied the wrong text, ` +
      `${copyBlocks.unlabelled.length} unlabelled`,
  )
  check(
    "the copy control confirms the copy",
    copyBlocks.feedback,
    "the glyph changed after the click",
  )

  // The form chapter is a section of the theme rather than of `ui/`, so the interaction is the
  // native one: type into `.input`, toggle `.checkbox`, pick a `.radio`. The computed styles are
  // what says the class itself reached the browser, not only the markup.
  const forms = await devtools.evaluate<{
    echoBefore: string
    echoAfter: string
    inputHeight: string
    inputRadius: string
    checkboxBefore: string
    checkboxAfter: string
    checkboxSize: string
    radio: string
    inlineButton: string
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const echo = (card) => document.querySelector("#demo-" + card + ' [data-e2e="controlled-value"]')
      .textContent.trim()

    const input = document.querySelector("#demo-class-input input.input")
    const echoBefore = echo("class-input")
    input.value = "ada@example.com"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await settle()

    const box = document.querySelector("#demo-class-checkbox input.checkbox")
    const checkboxBefore = echo("class-checkbox")
    box.click()
    await settle()

    const radio = document.querySelector('#demo-class-radio input.radio[value="sms"]')
    radio.click()
    await settle()

    return {
      echoBefore,
      echoAfter: echo("class-input"),
      inputHeight: getComputedStyle(input).height,
      inputRadius: getComputedStyle(input).borderRadius,
      checkboxBefore,
      checkboxAfter: echo("class-checkbox"),
      checkboxSize: getComputedStyle(box).width,
      radio: echo("class-radio"),
      inlineButton: document.querySelector("#demo-class-input-button button.btn-input-icon")
        .getAttribute("aria-label"),
    }
  })()`)
  check(
    "typing into a `.input` drives the demo's controlled value",
    forms.echoBefore !== forms.echoAfter && forms.echoAfter.includes("ada@example.com"),
    `${forms.echoBefore} → ${forms.echoAfter}`,
  )
  check(
    "the form classes reach the browser",
    forms.inputHeight === "48px" && forms.inputRadius === "8px" &&
      forms.checkboxSize === "20px",
    `.input ${forms.inputHeight}/radius ${forms.inputRadius} (h-12, radius-primary), ` +
      `.checkbox ${forms.checkboxSize} (size-5)`,
  )
  check(
    "a `.checkbox` and a `.radio` report through the native events",
    forms.checkboxBefore !== forms.checkboxAfter && forms.radio.includes("sms"),
    `${forms.checkboxBefore} → ${forms.checkboxAfter}; radio ${forms.radio}`,
  )
  check(
    "the inline `.btn-input-icon` is labelled for assistive tech",
    forms.inlineButton === "Search",
    `aria-label="${forms.inlineButton}"`,
  )

  // The `Fields` section's primitives: what `Field` wires is exactly what the browser makes
  // observable — the label's `for`, the control's `id`, and the ids of the messages the control
  // describes itself by, including the one it stops describing itself by once the error clears.
  const fields = await devtools.evaluate<{
    echoBefore: string
    echoAfter: string
    controlId: string
    labelFor: string
    beforeInvalid: string | null
    beforeDescribedBy: string
    afterInvalid: string | null
    afterDescribedBy: string
    errorText: string
  }>(`(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 30))
    const echo = () =>
      document.querySelector('#demo-Field [data-e2e="controlled-value"]').textContent.trim()
    const email = document.querySelector("#demo-Field input[type=email]")
    const read = () => ({
      invalid: email.getAttribute("aria-invalid"),
      describedBy: email.getAttribute("aria-describedby") ?? "",
    })

    const echoBefore = echo()
    const before = read()
    email.value = "ada@example.com"
    email.dispatchEvent(new Event("input", { bubbles: true }))
    await settle()

    return {
      echoBefore,
      echoAfter: echo(),
      controlId: email.id,
      labelFor: document.querySelector("#demo-Field label[for='guide-email']")?.getAttribute("for") ?? "",
      beforeInvalid: before.invalid,
      beforeDescribedBy: before.describedBy,
      afterInvalid: read().invalid,
      afterDescribedBy: read().describedBy,
      errorText: document.querySelector("#guide-email-error")?.textContent ?? "",
    }
  })()`)
  check(
    "typing into a `Field`'s control drives the demo's controlled value",
    fields.echoBefore !== fields.echoAfter && fields.echoAfter.includes("ada@example.com"),
    fields.echoAfter,
  )
  check(
    "`Field` wires the label's `for` to the control's `id`",
    fields.controlId === "guide-email" && fields.labelFor === "guide-email",
    `for="${fields.labelFor}" id="${fields.controlId}"`,
  )
  check(
    "`Field` describes the control by its error and its hint, and drops the error once it clears",
    fields.beforeInvalid === "true" &&
      fields.beforeDescribedBy === "guide-email-error guide-email-hint" &&
      fields.afterInvalid === null && fields.afterDescribedBy === "guide-email-hint" &&
      fields.errorText === "",
    `invalid=${fields.beforeInvalid} "${fields.beforeDescribedBy}" → ` +
      `invalid=${fields.afterInvalid} "${fields.afterDescribedBy}"`,
  )

  // The surface chapter has no control of its own: its interaction is the copy button its cards
  // carry (asserted above per card, for every section) plus the scroll container, which is driven
  // here. The rest is the stylesheet applying, read off computed styles.
  const surfaces = await devtools.evaluate<{
    cardRadius: string
    headerBorder: string
    footerBorder: string
    kpiValue: string
    numAlign: string
    barHeight: string
    scrolled: boolean
    overflow: boolean
    canvas: string
    surface: string
    link: string
    list: string
  }>(`(async () => {
    const style = (selector) => getComputedStyle(document.querySelector(selector))
    const scroller = document.querySelector('#demo-class-scrollbar [data-e2e="scrollbar"]')
    const overflow = scroller.scrollWidth > scroller.clientWidth
    scroller.scrollLeft = 120
    await new Promise((done) => setTimeout(done, 50))

    return {
      cardRadius: style("#demo-class-card .card").borderRadius,
      headerBorder: style("#demo-class-card .card-header").borderBottomWidth,
      footerBorder: style("#demo-class-card .card-footer").borderTopWidth,
      kpiValue: style("#demo-class-data-display .kpi-value").fontSize,
      numAlign: style("#demo-class-data-display .num").textAlign,
      barHeight: style("#demo-class-data-display .bar").height,
      scrolled: scroller.scrollLeft > 0,
      overflow,
      canvas: style("#demo-class-colour-atoms .bg-canvas").backgroundColor,
      surface: style("#demo-class-colour-atoms .bg-surface").backgroundColor,
      link: style("#demo-class-typography .link").textDecorationLine,
      list: style("#demo-class-typography .list-ul").listStyleType,
    }
  })()`)
  check(
    "the surface classes reach the browser",
    surfaces.cardRadius === "8px" && surfaces.headerBorder === "1px" &&
      surfaces.footerBorder === "1px" && surfaces.kpiValue === "24px" &&
      surfaces.barHeight === "6px",
    `card radius ${surfaces.cardRadius}, header ${surfaces.headerBorder}, ` +
      `footer ${surfaces.footerBorder}, kpi-value ${surfaces.kpiValue}, bar ${surfaces.barHeight}`,
  )
  check(
    "`.num` right-aligns and `.list-ul`/`.link` style their text",
    surfaces.numAlign === "right" && surfaces.list === "disc" && surfaces.link === "underline",
    `num ${surfaces.numAlign}, list ${surfaces.list}, link ${surfaces.link}`,
  )
  check(
    "`.scrollbar` is a real horizontal scroller",
    surfaces.overflow && surfaces.scrolled,
    `overflow ${surfaces.overflow}, scrolled to a non-zero offset`,
  )
  check(
    "`.bg-canvas` and `.bg-surface` are two different tokens",
    surfaces.canvas !== surfaces.surface,
    `${surfaces.canvas} vs ${surfaces.surface}`,
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

  // The deep link, driven in the canonical form the navigation now writes: `#/inputs/toggle-switch`,
  // not the `#toggle-switch` this page shipped before hash routing. The hashchange listener is what
  // turns that hash into a mark, a scroll and a title, so removing the listener reds this check —
  // which is what makes it a detection rather than a restatement of the markup.
  const deepLink = await devtools.evaluate<{
    marked: boolean
    current: string
    title: string
    scrolled: boolean
  }>(
    `(async () => {
      location.hash = "#/inputs/toggle-switch"
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
    `#/inputs/toggle-switch → ${deepLink.title}`,
  )

  // The rest of the grammar, driven the way a reader drives it: the legacy bare fragment this page
  // shipped before hash routing and still resolves, a section route, and an unknown route falling
  // back to the landing page. The resolver's own unit tests cannot prove the island wired any of it.
  const routes = await devtools.evaluate<{
    legacyMarked: boolean
    legacyCurrent: string
    legacyTitle: string
    sectionTop: number
    sectionMarked: number
    sectionCurrent: string
    sectionTitle: string
    markedBeforeUnknown: number
    unknownMarked: number
    unknownTitle: string
    unknownChipCurrent: string
  }>(
    `(async () => {
      const settle = () => new Promise((done) => setTimeout(done, 400))
      const marked = () => document.querySelectorAll("[data-deep-link]").length
      const current = () => document.querySelector('a[aria-current="true"]')?.textContent ?? ""

      location.hash = "#toggle-switch"
      await settle()
      const legacy = {
        legacyMarked: document.querySelector("#demo-ToggleSwitch").hasAttribute("data-deep-link"),
        legacyCurrent: current(),
        legacyTitle: document.title,
      }

      location.hash = "#/inputs"
      await settle()
      const section = {
        sectionTop: Math.round(document.getElementById("inputs").getBoundingClientRect().top),
        sectionMarked: marked(),
        sectionCurrent: current(),
        sectionTitle: document.title,
      }

      // Mark a card again before the unknown route, so the assertion below is a *transition* — the
      // mark has to be there first and gone after — and not something a host with no listener at all
      // would satisfy by never marking anything.
      location.hash = "#/inputs/toggle-switch"
      await settle()
      const markedBeforeUnknown = marked()

      location.hash = "#/nonsense"
      await settle()

      return {
        ...legacy,
        ...section,
        markedBeforeUnknown,
        unknownMarked: marked(),
        unknownTitle: document.title,
        unknownChipCurrent: current(),
      }
    })()`,
  )
  check(
    "the legacy fragment still resolves to the same card",
    routes.legacyMarked && routes.legacyCurrent === "ToggleSwitch" &&
      routes.legacyTitle.startsWith("ToggleSwitch"),
    `#toggle-switch → ${routes.legacyTitle}, chip "${routes.legacyCurrent}"`,
  )
  check(
    "the section route scrolls to its section and clears the card's mark",
    routes.sectionMarked === 0 && routes.sectionTitle.startsWith("Inputs") &&
      routes.sectionTop >= 0 && routes.sectionTop < 200,
    `#/inputs → ${routes.sectionTitle}, section top ${routes.sectionTop}px, ` +
      `${routes.sectionMarked} cards marked`,
  )
  check(
    "an unknown route falls back to the landing page and clears the mark",
    routes.markedBeforeUnknown === 1 && routes.unknownMarked === 0 &&
      routes.unknownChipCurrent === "" && routes.unknownTitle === PAGE_TITLE,
    `#/nonsense → "${routes.unknownTitle}", ${routes.markedBeforeUnknown} marked before → ` +
      `${routes.unknownMarked} after`,
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
  }>(`(async () => {
    // The outline below is the deep-link rule, so the card has to be the link's target first. This
    // used to be left over from the check that ran before; stating it here is what makes the probe
    // independent of the order the checks happen to run in, and it re-proves the canonical route
    // marks a card after an unknown hash cleared it.
    location.hash = "#/inputs/toggle-switch"
    await new Promise((done) => setTimeout(done, 400))

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
    `outline-width ${styled.outline} from styles.css, with the canonical route as the last hash`,
  )

  // Last on purpose: a Modal that refuses to close would sit in the top layer over everything, so a
  // failure here cannot take an unrelated check down with it.
  await modalChecks(devtools)
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

/** Escape: the dismiss key every overlay in this library is supposed to listen for. */
const ESCAPE: KeyPress = { key: "Escape", code: "Escape", keyCode: 27 }

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
async function pressKey(devtools: Devtools, press: KeyPress): Promise<void> {
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
 * Modal's keyboard and focus contract, driven in the browser that owns it.
 *
 * Three facts that no string-rendering test can reach: the element really enters the top layer, a
 * real Escape press closes it, and focus goes back to the button that opened it. All three live
 * behind an effect, a ref and a listener, which is exactly the shape this repository's unit tests
 * cannot execute.
 *
 * The trigger is parked on `globalThis` instead of being re-queried, so the focus assertion compares
 * element identity: a selector would also match a freshly rendered button that never had focus.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function modalChecks(devtools: Devtools): Promise<void> {
  const trigger = await devtools.evaluate<{ label: string; focused: boolean }>(`(() => {
    const card = document.querySelector("#demo-Modal")
    const button = [...card.querySelectorAll("button")]
      .find((candidate) => candidate.textContent.trim().startsWith("default"))
    globalThis.__verifyModalTrigger = button
    button.focus()
    return { label: button.textContent.trim(), focused: document.activeElement === button }
  })()`)

  // `.click()` rather than a real Enter press, and measured rather than assumed: with Enter sent
  // through `Input.dispatchKeyEvent` on the focused trigger this run read `dialog.open=false` —
  // headless Chromium does not turn that key press into the activation click a person's Enter
  // produces. The Escape press below *is* a real key event, because that is the path under test.
  await devtools.evaluate<null>(`(globalThis.__verifyModalTrigger.click(), null)`)
  // Wait for `:modal`, not merely for the element: Preact renders the `<dialog>` first and calls
  // `showModal()` from an effect a tick later, so an element-presence poll returns while the dialog
  // is still a closed, non-modal node and reads `open === false`.
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector("#demo-Modal dialog")?.matches(":modal") === true`,
      ),
    3_000,
  )
  await poll(
    () => devtools.evaluate<boolean>(`document.querySelector("#demo-Modal dialog") !== null`),
    3_000,
  )

  const opened = await devtools.evaluate<{
    open: boolean
    modal: boolean
    focusInside: boolean
    activeLabel: string
  }>(`(() => {
    const dialog = document.querySelector("#demo-Modal dialog")
    const active = document.activeElement
    return {
      open: dialog?.open === true,
      modal: dialog?.matches(":modal") === true,
      focusInside: dialog !== null && dialog.contains(active),
      activeLabel: (active?.getAttribute("aria-label") ?? active?.tagName ?? "none").trim(),
    }
  })()`)
  check(
    "activating Modal's trigger opens a modal dialog and moves focus into it",
    trigger.focused && opened.open && opened.modal && opened.focusInside,
    `trigger focused=${trigger.focused}, dialog.open=${opened.open}, ` +
      `:modal=${opened.modal}, focus now on ${opened.activeLabel}`,
  )

  await pressKey(devtools, ESCAPE)
  const closed = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const dialog = document.querySelector("#demo-Modal dialog")
        return dialog === null || dialog.open === false
      })()`),
    3_000,
  )
  // A transition, open → closed, not just the closed half: a dialog that never opened is trivially
  // closed, and that is precisely what a broken opening step would leave behind.
  check(
    "a real Escape key press closes the Modal",
    opened.open && closed,
    opened.open
      ? closed
        ? "Input.dispatchKeyEvent Escape → the dialog left the top layer"
        : "the dialog was still open 3s after the key press"
      : "the dialog was never open, so this proves nothing about Escape",
  )

  const restored = await poll(
    () => devtools.evaluate<boolean>(`document.activeElement === globalThis.__verifyModalTrigger`),
    3_000,
  )
  const active = await devtools.evaluate<string>(`(() => {
    const active = document.activeElement
    if (active === globalThis.__verifyModalTrigger) return "the trigger"
    return (active?.tagName ?? "nothing") + " " + (active?.textContent ?? "").trim().slice(0, 40)
  })()`)
  // Also a transition: focus has to have left the trigger for the dialog first, or "focus is on the
  // trigger" would hold for a dialog that never took it.
  //
  // What this check does *not* guard, measured rather than assumed: the component's own
  // `restoreFocus`. Deleting the `target.focus()` call from `ui/modal.tsx`, rebuilding and
  // re-running left this green, because Chromium itself returns focus to the element that was
  // focused before `showModal()` when a dialog closes. So this asserts the behaviour a person
  // experiences; it cannot tell the component's restore from the platform's.
  check(
    "closing the Modal returns focus to the button that opened it",
    opened.focusInside && restored,
    opened.focusInside
      ? `trigger "${trigger.label}" — document.activeElement is ${active}`
      : "focus never moved into the dialog, so a restore proves nothing",
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
if (Deno.args.includes("--static")) {
  console.log("\n--static — browser phase left out on purpose")
} else {
  await browserPhase()
}
report()
