import { pageHref } from "@spy4x/preact-ui-guide/routes"
import {
  centreInView,
  check,
  type Devtools,
  frameOverviewHydrates,
  inFreshFrame,
  poll,
  pressKey,
  readFrameScripts,
} from "./harness.ts"

/**
 * Strings only d3's code carries; a script that holds any of them counts as carrying d3. The first
 * is the 12-hour time format of the en-US locale `d3-time-format` installs as its default when it
 * is imported; the second is the property `d3-selection` stores bound data under. `pages/build.ts`
 * minifies the bundle, which renames identifiers but leaves string literals and property names
 * alone.
 */
const D3_MARKERS = ["%-I:%M:%S %p", "__data__"]

/** The id the fresh frame gets, so every expression below finds the same one. */
const FRAME_ID = "charts-no-d3-frame"

/** The first `LineChart` on the page: the time-axis one, with two series and a gap. */
const LINE = `document.querySelector('#demo-LineChart [data-chart="line"]')`

/** The `DonutChart` card's chart. */
const DONUT = `document.querySelector('#demo-DonutChart [data-chart="donut"]')`

/** The widths the tooltip must stay in view at: the narrowest phone the guide designs for, a desktop. */
const WIDTHS = [375, 1440] as const

/** What {@link readTooltip} reads: the tooltip against the chart's box and the viewport. */
interface TooltipState {
  /** Shown: not `invisible`, and with text. */
  shown: boolean
  text: string
  /** Inside the chart's own box, to the pixel. */
  inChart: boolean
  /** Inside the viewport's width and height. */
  inViewport: boolean
  /** `right` or `left` of the point. */
  side: string
  box: string
}

/**
 * `charts/`'s browser checks: the charts page loads no charting library; the line chart's and the
 * donut's tooltips follow the pointer and the keyboard, and stay inside the chart and the viewport
 * at 375 and 1440 pixels wide, at the first and the last point.
 *
 * @param devtools The connected session, on a hydrated page showing the charts page.
 */
export async function chartsChecks(devtools: Devtools): Promise<void> {
  await inFreshFrame(
    devtools,
    { id: FRAME_ID, src: pageHref("overview"), label: "no-d3" },
    (frame) => noD3Check(devtools, frame),
  )
  for (const width of WIDTHS) {
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 375 ? 812 : 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    try {
      await lineTooltipChecks(devtools, width)
      await donutTooltipChecks(devtools, width)
    } finally {
      await parkPointer(devtools)
      await devtools.send("Emulation.clearDeviceMetricsOverride")
    }
  }
}

/**
 * The charts page, opened fresh in a frame, fetches no script that carries d3's code: the line
 * chart's hover layer is the package's own.
 *
 * @param devtools The connected session.
 * @param frame A page expression for the frame, loaded at the overview.
 */
async function noD3Check(devtools: Devtools, frame: string): Promise<void> {
  if (!await frameOverviewHydrates(devtools, frame)) return
  await devtools.evaluate(
    `(${frame}.contentWindow.location.replace(${JSON.stringify(pageHref("charts"))}), null)`,
  )
  const opened = await poll(
    () =>
      devtools.evaluate<boolean>(
        `${frame}?.contentDocument?.querySelector('[data-guide-page="charts"] [data-chart="line"]') !== null`,
      ),
    15_000,
  )
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  const report = await readFrameScripts(devtools, frame, D3_MARKERS)
  check(
    "the charts page draws its charts and loads no d3: no script it fetched carries d3's code",
    opened && report.scripts.length > 0 && report.matching.length === 0,
    `charts page shown ${opened}; ${report.scripts.length} scripts` +
      (report.matching.length > 0 ? ` — d3 in ${report.matching.join(", ")}` : ""),
  )
}

/**
 * Hover the line chart's first and last point, then step through it with the keyboard, reading
 * the tooltip each time.
 *
 * @param devtools The connected session, at the width being checked.
 * @param width The viewport width, for the check names.
 */
async function lineTooltipChecks(devtools: Devtools, width: number): Promise<void> {
  await centreInView(devtools, LINE)
  const labels = await devtools.evaluate<{ first: string; last: string }>(`(() => {
    const dots = [...${LINE}.querySelectorAll("[data-chart-plot] span[title]")]
    const heading = (dot) => dot.title.replace(/^Today /, "").replace(/: [^:]*$/, "")
    return { first: heading(dots[0]), last: heading(dots[dots.length - 1]) }
  })()`)

  for (const end of ["first", "last"] as const) {
    const aim = await devtools.evaluate<{ x: number; y: number }>(`(() => {
      const dots = [...${LINE}.querySelectorAll("[data-chart-plot] span[title]")]
      const box = dots[${end === "first" ? 0 : "dots.length - 1"}].getBoundingClientRect()
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    })()`)
    await movePointer(devtools, aim)
    const tooltip = await readTooltip(devtools, LINE)
    check(
      `at ${width} px, hovering the line chart's ${end} point shows its tooltip inside the chart and the viewport`,
      tooltip.shown && tooltip.text.startsWith(labels[end]) && tooltip.inChart &&
        tooltip.inViewport,
      `expected "${labels[end]}"; ${describe(tooltip)}`,
    )
    if (end === "last") {
      check(
        `at ${width} px, the line chart's tooltip flips to the left of its last point`,
        tooltip.side === "left",
        `side ${tooltip.side}`,
      )
    }
  }
  await parkPointer(devtools)
  const left = await readTooltip(devtools, LINE)
  check(
    `at ${width} px, the line chart's tooltip hides when the pointer leaves the plot`,
    !left.shown,
    describe(left),
  )

  // A real click first: a page that has never had one sends no focus events for `.focus()`.
  await clickAt(devtools, await centreOf(devtools, `${LINE}.querySelector("h3")`))
  await devtools.evaluate(`(${LINE}.querySelector("[data-chart-plot]").focus(), null)`)
  const focused = await readTooltip(devtools, LINE)
  await pressKey(devtools, "End")
  const atEnd = await readTooltip(devtools, LINE)
  await pressKey(devtools, "ArrowLeft")
  const stepped = await readTooltip(devtools, LINE)
  await pressKey(devtools, "Escape")
  const escaped = await readTooltip(devtools, LINE)
  await devtools.evaluate(`(document.activeElement?.blur(), null)`)
  check(
    `at ${width} px, focusing the line chart shows the first point's tooltip, and End, ArrowLeft and Escape move and hide it`,
    focused.shown && focused.text.startsWith(labels.first) && atEnd.shown &&
      atEnd.text.startsWith(labels.last) && atEnd.inChart && atEnd.inViewport &&
      stepped.shown && stepped.text !== atEnd.text && !escaped.shown,
    `focus: ${describe(focused)} | End: ${describe(atEnd)} | ArrowLeft: ${
      describe(stepped)
    } | Escape: ${describe(escaped)}`,
  )
}

/**
 * Hover every donut slice at the middle of its arc, then step through the slices with the keyboard.
 *
 * @param devtools The connected session, at the width being checked.
 * @param width The viewport width, for the check names.
 */
async function donutTooltipChecks(devtools: Devtools, width: number): Promise<void> {
  await centreInView(devtools, DONUT)
  const slices = await devtools.evaluate<{ label: string; x: number; y: number }[]>(`(() => {
    const ring = ${DONUT}.querySelector("[data-chart-ring]").getBoundingClientRect()
    const rows = [...${DONUT}.querySelectorAll("li")]
    let start = 0
    return rows.map((row) => {
      const share = parseFloat(row.querySelector("strong").textContent) / 100
      const turn = (start + share / 2) * 2 * Math.PI
      start += share
      const radius = ring.width * 0.425
      return {
        label: row.querySelector("span.flex-1").textContent,
        x: Math.round(ring.left + ring.width / 2 + Math.sin(turn) * radius),
        y: Math.round(ring.top + ring.height / 2 - Math.cos(turn) * radius),
      }
    })
  })()`)

  const hovered: string[] = []
  for (const slice of slices) {
    await movePointer(devtools, slice)
    const tooltip = await readTooltip(devtools, DONUT)
    if (
      tooltip.shown && tooltip.text.startsWith(slice.label) && tooltip.inChart && tooltip.inViewport
    ) {
      hovered.push(slice.label)
    } else hovered.push(`MISSED ${slice.label}: ${describe(tooltip)}`)
  }
  check(
    `at ${width} px, hovering each donut slice shows its label, value and share inside the chart and the viewport`,
    slices.length === 4 && hovered.every((entry) => !entry.startsWith("MISSED")),
    hovered.join("; "),
  )
  await parkPointer(devtools)

  await clickAt(devtools, await centreOf(devtools, `${DONUT}.querySelector("h3")`))
  await devtools.evaluate(`(${DONUT}.querySelector("[data-chart-ring]").focus(), null)`)
  const stepped: string[] = []
  for (let index = 0; index < slices.length; index++) {
    if (index > 0) await pressKey(devtools, "ArrowRight")
    const tooltip = await readTooltip(devtools, DONUT)
    stepped.push(tooltip.shown && tooltip.inChart && tooltip.inViewport ? tooltip.text : "")
  }
  await devtools.evaluate(`(document.activeElement?.blur(), null)`)
  check(
    `at ${width} px, focusing the donut and pressing ArrowRight steps a tooltip through every slice`,
    slices.every((slice, index) => stepped[index]?.startsWith(slice.label)) &&
      stepped.every((text) => /\d+(\.\d)?%$/.test(text)),
    stepped.join(" | "),
  )
}

/**
 * The chart's tooltip, after two animation frames: whether it shows, its text, and whether it lies
 * inside the chart's box and the viewport.
 *
 * @param devtools The connected session.
 * @param chart A page expression for the chart's root.
 */
async function readTooltip(devtools: Devtools, chart: string): Promise<TooltipState> {
  return await devtools.evaluate<TooltipState>(`(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const root = ${chart}
    const tooltip = root.querySelector("[data-chart-tooltip]")
    const box = tooltip.getBoundingClientRect()
    const chart = root.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    const height = document.documentElement.clientHeight
    const text = tooltip.textContent.replace(/\\s+/g, " ").trim()
    return {
      shown: !tooltip.classList.contains("invisible") && text !== "",
      text,
      inChart: box.left >= chart.left - 0.5 && box.right <= chart.right + 0.5 &&
        box.top >= chart.top - 0.5 && box.bottom <= chart.bottom + 0.5,
      inViewport: box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height,
      side: tooltip.dataset.side ?? "",
      box: [box.left, box.top, box.right, box.bottom].map(Math.round).join(",") + " in " +
        [chart.left, chart.top, chart.right, chart.bottom].map(Math.round).join(",") +
        " of " + width + "×" + height,
    }
  })()`)
}

/** One line for a failure: what the tooltip said and where it was. */
function describe(tooltip: TooltipState): string {
  return `${tooltip.shown ? "shown" : "hidden"} "${tooltip.text}" at ${tooltip.box}`
}

/** The centre of an element, in viewport pixels. */
async function centreOf(devtools: Devtools, element: string): Promise<{ x: number; y: number }> {
  return await devtools.evaluate<{ x: number; y: number }>(`(() => {
    const box = ${element}.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)
}

/** Move the real pointer to a point. */
async function movePointer(devtools: Devtools, at: { x: number; y: number }): Promise<void> {
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: at.x,
    y: at.y,
    button: "none",
    buttons: 0,
  })
}

/** A real press and release at a point. */
async function clickAt(devtools: Devtools, at: { x: number; y: number }): Promise<void> {
  await movePointer(devtools, at)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: at.x,
      y: at.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    })
  }
}

/** Rest the pointer in the corner, off every chart, so a later check reads no hover. */
async function parkPointer(devtools: Devtools): Promise<void> {
  await movePointer(devtools, { x: 2, y: 2 })
}
