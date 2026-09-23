/**
 * Verify the built artefact — statically, then in a real browser.
 *
 * The static phase reads `dist/` and asserts the document's shape: base-prefixed asset paths that
 * exist, prerendered cards for every component and every theme-class card, a copy control on every
 * usage block, and a stylesheet that actually carries the theme. That alone would not prove the page
 * *works* — a prerendered catalogue is not an interactive one — so the second phase serves `dist/`
 * at the same base GitHub Pages uses, drives headless Chromium over the DevTools Protocol, and
 * exercises what the issues ask for: the switches, the icon filter, click-to-copy in the gallery
 * and on every usage block, the form controls of the class chapter, the surface classes as
 * computed styles, the scroll container, the deep links, the colour scheme, and the keyboard,
 * focus and effect behaviour of the components that have been covered so far — the dropdown as a
 * real menu, the toasts announcing and pausing, the combobox and the tooltip, the calendar's grid
 * and the image lightbox, the service-worker prompt registering and offering its reload, and the
 * filter hook following the address bar — then reports any console error, page exception or
 * failed request the run produced.
 *
 * ```bash
 * deno task build && deno task verify          # both phases
 * deno task verify --static                    # leave the browser out on purpose
 * ```
 *
 * **This is the repository's browser test path, and CI runs it.** Every unit test in the workspace
 * renders to an HTML string, so no effect, ref, key press or focus change is executed by any of
 * them; anything that lives behind one is proven here or nowhere. `.github/workflows/pages.yml`
 * runs `deno task check`, the build and this script on every pull request into `main` and on every
 * push to `main`, and the deploy job waits for all three. A missing or unusable browser is a failed
 * check, not a skip — `--static` is the one explicit way to leave the browser phase out.
 *
 * The checks that need a hydrated page are not written here: each workspace package that has one
 * owns a file under `pages/checks/`, and `PACKAGE_BLOCKS` below is the one place their run order is
 * fixed. Each block is run isolated from the others, so a throw inside one package is one failed
 * check naming that package and every later package still runs; the last line of the report then
 * says which blocks, if any, are missing from the totals. `pages/checks/harness.ts` holds what more
 * than one of those files needs in common — the `Devtools` protocol client, the results ledger,
 * `poll` and `pressKey`.
 */

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { catalogueNames, catalogueSections } from "@preact-components/ui-guide/registry"
import { routeTableDrift } from "@preact-components/ui-guide/routes"
import { chartsChecks } from "./checks/charts.ts"
import { crudChecks } from "./checks/crud.ts"
import {
  check,
  type CheckBlock,
  commitBlocks,
  connect,
  debuggingPort,
  type Devtools,
  poll,
  pressKey,
  report,
  runBlocks,
} from "./checks/harness.ts"
import { iconsChecks } from "./checks/icons.ts"
import { pagesChecks } from "./checks/pages.ts"
import { signalsChecks } from "./checks/signals.ts"
import { systemChecks } from "./checks/system.ts"
import { themeChecks } from "./checks/theme.ts"
import { uiChecks } from "./checks/ui.ts"
import { uiGuideChecks } from "./checks/ui-guide.ts"
import { demoElementId } from "./src/deep-link.ts"
import { routeTableFromHtml } from "./src/route-echo.ts"
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

  // The demo passes no `ogImage` (its only image is a 32×32 favicon), so `SEOHead` must derive
  // `summary` rather than the `summary_large_image` a hard-coded card type used to publish — see
  // #212. Exactly one tag: a workaround that hand-wrote a corrected tag beside the helper's own,
  // rather than fixing the derivation, would ship two `twitter:card` tags and this would catch it.
  const twitterCards = [...html.matchAll(/<meta[^>]*name="twitter:card"[^>]*>/g)].map((m) => m[0])
  check(
    "exactly one twitter:card tag, publishing summary for a page with no preview image",
    twitterCards.length === 1 && twitterCards[0].includes('content="summary"'),
    twitterCards.length === 1 ? twitterCards[0] : `${twitterCards.length} tag(s): ${twitterCards}`,
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
  // Commit to the package blocks before anything can go wrong, so that a phase which dies during
  // startup still reports which blocks it meant to run. `--static` never reaches this line, which
  // is what keeps a deliberate skip from being reported as nine lost blocks.
  commitBlocks(PACKAGE_BLOCKS.map((block) => block.name))

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
        // Tell the browser it has a mouse. Headless Chromium otherwise answers `(hover: none)` and
        // `(pointer: none)`, and Tailwind compiles every `hover:` and `group-hover:` utility inside
        // `@media (hover: hover)` — so without this flag not one hover style in the library applies
        // in any check, and a tooltip that appears on hover cannot be shown by hovering. The two
        // emulation routes were both measured not to cover these features: neither
        // `Emulation.setEmulatedMedia` (with `hover`/`pointer` and with `any-hover`/`any-pointer`)
        // nor a device-metrics override changes what `matchMedia` answers. `2` is Blink's
        // "hover" hover type and `4` its "fine" pointer type. `hoverCapability` below is the check
        // that this flag is still doing its job.
        "--blink-settings=primaryHoverType=2,availableHoverTypes=2," +
        "primaryPointerType=4,availablePointerTypes=4",
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

    await hoverCapability(devtools)

    if (hydrated) {
      await runBlocks(PACKAGE_BLOCKS, devtools, resetAfterThrow)
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

/**
 * Assert that the browser answers the two media features Tailwind gates hover styles behind.
 *
 * This is an environment check rather than a component one, which is why it lives here next to the
 * hydration check rather than in a package's file: it asserts what the launch flags in
 * {@link browserPhase} bought, and it runs before any package's checks so that a run whose hover
 * styles were all gated out says so at the top rather than leaving a dozen later checks to fail for
 * a reason none of them names. Without the `--blink-settings` flag both of these read `false`.
 *
 * @param devtools The connected session.
 */
async function hoverCapability(devtools: Devtools): Promise<void> {
  const media = await devtools.evaluate<{ hover: boolean; pointer: boolean }>(`(() => ({
    hover: matchMedia("(hover: hover)").matches,
    pointer: matchMedia("(pointer: fine)").matches,
  }))()`).catch(() => undefined)

  check(
    "the browser reports that it can hover, so hover styles apply",
    media?.hover === true && media?.pointer === true,
    media === undefined
      ? "the page did not answer matchMedia"
      : `(hover: hover) ${media.hover}, (pointer: fine) ${media.pointer}`,
  )
}

/** Whether any dialog is currently open in the page. */
function anyDialogOpen(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`document.querySelector("dialog[open]") !== null`)
}

/**
 * Close whatever dialog a throwing block left open, the way a person closes one.
 *
 * A dialog left in the top layer covers every check that runs after it, so something has to close
 * it — but `dialog.close()` closes it behind the owning component's back. A controlled Modal keeps
 * its open state in a signal the parent passed in; calling `close()` takes the element off the
 * screen and leaves that signal reading `true`, so the component believes it is still open and its
 * trigger stops working. Measured: a throw that left `ui`'s Modal open turned one contained failure
 * into five red checks in the `ui` block that pass on a clean run, with details that read like a
 * Modal defect.
 *
 * So Escape goes first. `pages/checks/ui.ts` proves that a real Escape press drives Modal's close
 * port, which is the path that puts the component's own state and the DOM back in agreement.
 * `dialog.close()` stays only as the fallback for a dialog that ignored Escape, and what the
 * fallback cannot do is exactly what the paragraph above describes: it clears the top layer and
 * nothing else, so a component whose open state lives outside the DOM is left believing it is open,
 * and checks after it may fail for a reason that has nothing to do with them.
 *
 * The Escape press is sent **only** when a dialog is actually open. Tooltip, Dropdown and Combobox
 * all listen for Escape, so an unconditional press would be the same class of mistake this function
 * exists to avoid — a recovery quietly changing state a later block reads.
 *
 * @param devtools The connected session.
 */
async function closeOpenDialog(devtools: Devtools): Promise<void> {
  if (!await anyDialogOpen(devtools)) return

  await pressKey(devtools, "Escape")
  if (await poll(async () => !await anyDialogOpen(devtools), 2_000)) return

  await devtools.evaluate(`(() => {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close()
  })()`)
}

/**
 * Put the page back into a neutral state after a package's checks threw part-way.
 *
 * This runs only on the throwing path — {@link runBlocks} never calls it between two blocks that
 * finished — because an unconditional reset would hide the very failures this phase exists to
 * catch: a dialog that refuses to close should break the next block loudly rather than be tidied
 * away. What it undoes is the shared state a half-finished block plausibly leaves behind for the
 * next one: an open dialog sitting in the top layer above everything (through
 * {@link closeOpenDialog}, which explains why that step is not a bare `dialog.close()`), the
 * pointer resting on a card (the browser can hover now, so a stray pointer changes styles and
 * pauses toast timers), focus somewhere unexpected, and a scrolled page.
 *
 * It deliberately does **not** reload the page or reset the route. A block that navigated away is
 * not recovered from here; the blocks after it fail loudly, which is the honest outcome, and a
 * reload would cost a fresh hydration and could fail on its own.
 *
 * The scroll reset asks for `behavior: "instant"` on purpose. `pages/styles.css` sets
 * `scroll-behavior: smooth` on the document, so a plain `scrollTo(0, 0)` starts an animation still
 * running when the next block takes its first reading — measured: with that form, making `signals`
 * throw broke the calendar's "no key the grid answers scrolls the page" check in the `system`
 * block, which is a recovery inventing a failure rather than containing one.
 *
 * @param devtools The connected session.
 */
async function resetAfterThrow(devtools: Devtools): Promise<void> {
  await closeOpenDialog(devtools)

  await devtools.evaluate(`(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo({ top: 0, behavior: "instant" })
  })()`)

  // Takes the pointer off whatever card it was left on; the corner is as neutral a resting place as
  // the protocol offers, since it refuses coordinates outside the viewport.
  await devtools.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0, buttons: 0 })
}

/**
 * Every workspace package's browser checks, in the one fixed order this file owns.
 *
 * Every package with something a browser can drive is named here, including the two that own no
 * check yet — `crud` and `charts` — so that a later PR adding a package's first check edits only
 * that package's file under `pages/checks/`, never this list. `cn` is the one workspace member
 * missing on purpose: it is a single class-name function with nothing a browser could drive.
 * `signals` has no catalogue section any more and still has a file: its checks drive the demo the
 * host page renders.
 *
 * `ui` runs last on purpose: its Modal checks (kept last within `ui.ts` for the same reason) open a
 * real modal dialog, and a dialog that refused to close would sit in the top layer above every check
 * that ran after it — a failure there would then take down checks that have nothing to do with it.
 * Isolating the blocks from each other does not make that ordering redundant: it keeps a throw from
 * dropping the later packages, while the order keeps a *passing* block from leaving the page in a
 * state the next one cannot work in.
 *
 * One list, not nine calls, so the names the run commits to and the functions it calls cannot drift
 * apart — {@link browserPhase} commits these names before it has a browser to run them with.
 */
const PACKAGE_BLOCKS: readonly CheckBlock<Devtools>[] = [
  { name: "theme", run: themeChecks },
  { name: "icons", run: iconsChecks },
  { name: "ui-guide", run: uiGuideChecks },
  { name: "pages", run: pagesChecks },
  { name: "signals", run: signalsChecks },
  { name: "system", run: systemChecks },
  { name: "crud", run: crudChecks },
  { name: "charts", run: chartsChecks },
  { name: "ui", run: uiChecks },
]

await staticPhase()
if (Deno.args.includes("--static")) {
  console.log("\n--static — browser phase left out on purpose")
} else {
  await browserPhase()
}
report()
