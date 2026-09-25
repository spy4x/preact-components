import { pageHref } from "@spy4x/preact-ui-guide/routes"
import { check, type Devtools, poll } from "./harness.ts"

/**
 * Strings only d3's code carries; a script that holds any of them counts as carrying d3. The first
 * is the 12-hour time format of the en-US locale `d3-time-format` installs as its default when it
 * is imported; the second is the property `d3-selection` stores bound data under, so a static
 * import of part of d3 without `d3-time-format` is caught too. `pages/build.ts` minifies the
 * bundle, which renames identifiers but leaves string literals and property names alone.
 */
const D3_MARKERS = ["%-I:%M:%S %p", "__data__"]

/** The id the frame gets, so every expression below finds the same one. */
const FRAME_ID = "charts-lazy-d3-frame"

/** What {@link readScripts} reports about the scripts a document has fetched. */
interface ScriptReport {
  /** Path of every `.js` file the frame's document fetched, in the order it fetched them. */
  scripts: string[]
  /** The subset whose body carries one of {@link D3_MARKERS}. */
  withD3: string[]
}

/** What {@link readCharts} reads off the frame's charts page. */
interface ChartsState {
  /** `D3LineChart` and `CompareChart` placeholders still showing. */
  placeholders: number
  /** Per chart svg on the two d3 cards (`D3LineChart` renders it with `role="img"`): how many
   * axis ticks and how many drawn paths. */
  svgs: { ticks: number; paths: number }[]
  /** Example outputs on the page that still print the loading line. */
  pendingExamples: number
  /** The time-labels example's output text. */
  timeLabels: string
}

/**
 * `charts/`'s browser checks: the guide loads d3 only when its charts page opens.
 *
 * An app that mounts the guide must not load d3 until someone opens the charts page. The shared
 * page cannot show that — earlier blocks have opened the charts page already, and the block itself
 * runs on it — so the check loads the site again in a same-origin `<iframe>`, which is a fresh
 * document with its own module map: it opens at the overview, lists every script the frame fetched
 * and reads each one for d3's code, then opens the frame's charts page and reads again. A second
 * tab would do the same, but `connect` in `harness.ts` needs the debugging port, which a block does
 * not get; the frame needs nothing but the page. The frame is fixed over the viewport, invisible
 * and click-through, so its charts measure a real width and nothing the pointer does reaches it,
 * and it is removed before the block ends. The shared page's scroll position is read before and
 * after, and the check fails if the frame moved it.
 *
 * @param devtools The connected session, on a hydrated page showing the charts page.
 */
export async function chartsChecks(devtools: Devtools): Promise<void> {
  const scrollBefore = await devtools.evaluate<number>("scrollY")
  try {
    await lazyD3Checks(devtools)
  } finally {
    await devtools.evaluate(
      `(document.getElementById(${JSON.stringify(FRAME_ID)})?.remove(), null)`,
    )
  }
  const scrollAfter = await devtools.evaluate<number>("scrollY")
  check(
    "the frame the d3 check loads leaves the shared page where it was",
    scrollAfter === scrollBefore,
    `scrollY ${scrollBefore} → ${scrollAfter}`,
  )
}

/**
 * The checks themselves: overview without d3, then the charts page with it.
 *
 * @param devtools The connected session.
 */
async function lazyD3Checks(devtools: Devtools): Promise<void> {
  const frame = `document.getElementById(${JSON.stringify(FRAME_ID)})`
  const inFrame = (selector: string) =>
    `${frame}?.contentDocument?.querySelector(${JSON.stringify(selector)})`

  await devtools.evaluate(`(() => {
    const frame = document.createElement("iframe")
    frame.id = ${JSON.stringify(FRAME_ID)}
    frame.setAttribute("aria-hidden", "true")
    frame.tabIndex = -1
    frame.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;border:0;opacity:0;pointer-events:none"
    frame.src = location.origin + location.pathname + ${JSON.stringify(pageHref("overview"))}
    document.body.append(frame)
    return null
  })()`)

  const overviewReady = await poll(
    () =>
      devtools.evaluate<boolean>(
        `${frame}?.contentDocument?.documentElement.dataset.hydrated === "true" &&
          ${inFrame('[data-guide-page="overview"]')} !== null`,
      ),
    15_000,
  )
  if (!overviewReady) {
    check("the guide's overview, loaded fresh in a frame, hydrates", false, "not within 15s")
    return
  }
  // Nothing on the overview should start a load after hydration; give anything that would a moment
  // to show up in the list before reading it.
  await new Promise((resolve) => setTimeout(resolve, 1_000))

  const overview = await readScripts(devtools, frame)
  check(
    "the guide's overview loads no d3: no script the page fetched carries d3's code",
    overview.scripts.length > 0 && overview.withD3.length === 0,
    `${overview.scripts.length} scripts: ${overview.scripts.join(", ")}` +
      (overview.withD3.length > 0 ? ` — d3 in ${overview.withD3.join(", ")}` : ""),
  )

  await devtools.evaluate(
    `(${frame}.contentWindow.location.replace(${JSON.stringify(pageHref("charts"))}), null)`,
  )
  let charts: ChartsState | undefined
  const drawn = await poll(async () => {
    charts = await readCharts(devtools, frame)
    return charts.placeholders === 0 && charts.svgs.length >= 3 &&
      charts.svgs.every((svg) => svg.ticks > 0 && svg.paths > 0) && charts.pendingExamples === 0
  }, 15_000)

  const opened = await readScripts(devtools, frame)
  const newScripts = opened.scripts.filter((path) => !overview.scripts.includes(path))
  check(
    "opening the charts page loads d3, in a script the overview never fetched",
    opened.withD3.length > 0 && opened.withD3.every((path) => newScripts.includes(path)),
    `new scripts: ${newScripts.join(", ") || "none"} — d3 in ${opened.withD3.join(", ") || "none"}`,
  )
  check(
    "the charts page's d3 charts draw axes and lines once d3 has loaded",
    drawn && charts !== undefined && charts.placeholders === 0,
    charts
      ? `${charts.placeholders} placeholders; per svg (ticks/paths): ${
        charts.svgs.map((svg) => `${svg.ticks}/${svg.paths}`).join(", ")
      }`
      : "the frame's charts page was never read",
  )
  check(
    "the d3 examples print their real output once d3 has loaded",
    charts !== undefined && charts.pendingExamples === 0 && charts.timeLabels.includes("hours:"),
    charts ? `${charts.pendingExamples} still loading; time labels: ${charts.timeLabels}` : "",
  )
}

/**
 * List the `.js` files the frame's document fetched, and which of them carry d3.
 *
 * Each body is fetched again from the shared page: same origin, same URL, so the browser's cache
 * answers, and the text read is what the frame ran.
 *
 * @param devtools The connected session.
 * @param frame An expression for the frame element.
 */
async function readScripts(devtools: Devtools, frame: string): Promise<ScriptReport> {
  return await devtools.evaluate<ScriptReport>(`(async () => {
    const entries = ${frame}.contentWindow.performance.getEntriesByType("resource")
    const scripts = entries.map((entry) => new URL(entry.name))
      .filter((url) => url.origin === location.origin && url.pathname.endsWith(".js"))
      .map((url) => url.pathname)
    const withD3 = []
    for (const path of scripts) {
      const text = await (await fetch(path)).text()
      if (${JSON.stringify(D3_MARKERS)}.some((marker) => text.includes(marker))) withD3.push(path)
    }
    return { scripts, withD3 }
  })()`)
}

/**
 * Read the frame's charts page: placeholders, drawn svgs and example outputs.
 *
 * @param devtools The connected session.
 * @param frame An expression for the frame element.
 */
async function readCharts(devtools: Devtools, frame: string): Promise<ChartsState> {
  return await devtools.evaluate<ChartsState>(`(() => {
    const doc = ${frame}?.contentDocument
    const page = doc?.querySelector('[data-guide-page="charts"]')
    if (!page) return { placeholders: -1, svgs: [], pendingExamples: -1, timeLabels: "" }
    const cards = [...page.querySelectorAll("#demo-D3LineChart, #demo-CompareChart")]
    const svgs = cards.flatMap((card) => [...card.querySelectorAll('svg[role="img"]')])
      .map((svg) => ({
        ticks: svg.querySelectorAll(".tick").length,
        paths: svg.querySelectorAll("path[d]").length,
      }))
    const outputs = [...page.querySelectorAll('[data-e2e="example-output"]')]
    return {
      placeholders: page.querySelectorAll('[data-e2e="d3-chart-placeholder"]').length,
      svgs,
      pendingExamples: outputs.filter((output) =>
        output.textContent.includes("needs charts/d3-line-chart")
      ).length,
      timeLabels: page.querySelector("#demo-formatTimeTick [data-e2e='example-output']")
        ?.textContent.replace(/\\s+/g, " ").trim() ?? "",
    }
  })()`)
}
