import { pageHref } from "@spy4x/preact-ui-guide/routes"
import {
  check,
  type Devtools,
  frameOverviewHydrates,
  inFreshFrame,
  poll,
  readFrameScripts,
} from "./harness.ts"

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
 * runs on it — so the check loads the site again in a fresh frame (`inFreshFrame` in `harness.ts`):
 * it opens at the overview, lists every script the frame fetched and reads each one for d3's code,
 * then opens the frame's charts page and reads again.
 *
 * @param devtools The connected session, on a hydrated page showing the charts page.
 */
export async function chartsChecks(devtools: Devtools): Promise<void> {
  await inFreshFrame(
    devtools,
    { id: FRAME_ID, src: pageHref("overview"), label: "d3" },
    (frame) => lazyD3Checks(devtools, frame),
  )
}

/**
 * The checks themselves: overview without d3, then the charts page with it.
 *
 * @param devtools The connected session.
 * @param frame A page expression for the frame, loaded at the overview.
 */
async function lazyD3Checks(devtools: Devtools, frame: string): Promise<void> {
  if (!await frameOverviewHydrates(devtools, frame)) return

  const overview = await readFrameScripts(devtools, frame, D3_MARKERS)
  check(
    "the guide's overview loads no d3: no script the page fetched carries d3's code",
    overview.scripts.length > 0 && overview.matching.length === 0,
    `${overview.scripts.length} scripts: ${overview.scripts.join(", ")}` +
      (overview.matching.length > 0 ? ` — d3 in ${overview.matching.join(", ")}` : ""),
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

  const opened = await readFrameScripts(devtools, frame, D3_MARKERS)
  const newScripts = opened.scripts.filter((path) => !overview.scripts.includes(path))
  check(
    "opening the charts page loads d3, in a script the overview never fetched",
    opened.matching.length > 0 && opened.matching.every((path) => newScripts.includes(path)),
    `new scripts: ${newScripts.join(", ") || "none"} — d3 in ${
      opened.matching.join(", ") || "none"
    }`,
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
