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
  settledScroll,
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

/** The `Bars` card's table. */
const BARS = `document.querySelector('#demo-Bars table')`

/** The gap `placeTooltip` keeps between a tooltip and the point it describes. */
const TOOLTIP_GAP = 12

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
  /** The tooltip's edges, in viewport pixels. */
  left: number
  top: number
  right: number
  bottom: number
  /** Against the left or right edge it may be pushed to: the chart's, or the viewport's margin. */
  atEdge: boolean
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
  await barsDarkContrastCheck(devtools)
  for (const width of WIDTHS) {
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 375 ? 812 : 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    try {
      await lineTooltipChecks(devtools, width)
      await lineViewportEdgeCheck(devtools, width)
      await donutTooltipChecks(devtools, width)
    } finally {
      await parkPointer(devtools)
      await devtools.send("Emulation.clearDeviceMetricsOverride")
    }
  }
}

/**
 * On the dark theme, every bar of the `Bars` card reaches 3:1 against what it is drawn on: the
 * table carries the palette's dark steps, as the other charts do.
 *
 * @param devtools The connected session, on the charts page.
 */
async function barsDarkContrastCheck(devtools: Devtools): Promise<void> {
  await centreInView(devtools, BARS)
  const bars = await devtools.evaluate<{ label: string; ratio: number }[]>(`(async () => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.add("dark")
    try {
      for (const animation of document.getAnimations()) animation.finish()
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const paint = canvas.getContext("2d", { willReadFrequently: true })
      // Any CSS colour, oklch included, as sRGB channels and alpha.
      const rgba = (css) => {
        paint.clearRect(0, 0, 1, 1)
        paint.fillStyle = "#000"
        paint.fillStyle = css
        paint.fillRect(0, 0, 1, 1)
        return [...paint.getImageData(0, 0, 1, 1).data]
      }
      const luminance = ([r, g, b]) => {
        const linear = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
      }
      // The first opaque background at or above an element: what it is drawn on.
      const behind = (element) => {
        for (let at = element; at; at = at.parentElement) {
          const colour = rgba(getComputedStyle(at).backgroundColor)
          if (colour[3] === 255) return colour
        }
        return rgba(getComputedStyle(root).backgroundColor)
      }
      return [...${BARS}.querySelectorAll("tr")].map((row) => {
        const bar = row.querySelector("td span span") ?? row.querySelector("td [style*='background'] span")
        const fill = luminance(rgba(getComputedStyle(bar).backgroundColor))
        const ground = luminance(behind(bar.parentElement))
        const ratio = (Math.max(fill, ground) + 0.05) / (Math.min(fill, ground) + 0.05)
        return { label: row.querySelector("th").textContent.trim(), ratio: Math.round(ratio * 100) / 100 }
      })
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`)
  check(
    "on the dark theme, every bar in the Bars card reaches 3:1 against its track",
    bars.length === 4 && bars.every((bar) => bar.ratio >= 3),
    bars.map((bar) => `${bar.label} ${bar.ratio}:1`).join(", "),
  )
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
 * Scroll the line chart until its lowest point sits just above the viewport's bottom edge, with the
 * rest of the chart running on below it, then hover that point: the tooltip is pushed up into the
 * viewport rather than centred on the point and cut off, although the chart's own box has room.
 *
 * @param devtools The connected session, at the width being checked.
 * @param width The viewport width, for the check name.
 */
async function lineViewportEdgeCheck(devtools: Devtools, width: number): Promise<void> {
  await centreInView(devtools, LINE)
  const target = await devtools.evaluate<number>(`(() => {
    const dots = [...${LINE}.querySelectorAll("[data-chart-plot] span[title]")]
    const lowest = Math.max(...dots.map((dot) => dot.getBoundingClientRect().bottom))
    const top = Math.round(globalThis.scrollY + lowest - (document.documentElement.clientHeight - 14))
    globalThis.scrollTo({ top, behavior: "instant" })
    return top
  })()`)
  await settledScroll(devtools, { target })
  const aim = await devtools.evaluate<{ x: number; y: number; chartBottom: number }>(`(() => {
    const dots = [...${LINE}.querySelectorAll("[data-chart-plot] span[title]")]
    const lowest = dots.reduce((low, dot) =>
      dot.getBoundingClientRect().bottom > low.getBoundingClientRect().bottom ? dot : low
    )
    const box = lowest.getBoundingClientRect()
    return {
      x: Math.round(box.left + box.width / 2),
      y: Math.round(box.top + box.height / 2),
      chartBottom: Math.round(${LINE}.getBoundingClientRect().bottom),
    }
  })()`)
  await movePointer(devtools, aim)
  const tooltip = await readTooltip(devtools, LINE)
  const viewport = await devtools.evaluate<number>("document.documentElement.clientHeight")
  check(
    `at ${width} px, with the line chart running past the viewport's bottom, a point's tooltip stays above that edge`,
    aim.chartBottom > viewport && tooltip.shown && tooltip.inViewport &&
      tooltip.bottom <= viewport - 8 + 0.5,
    `point at ${aim.x},${aim.y}, chart bottom ${aim.chartBottom} of ${viewport}; ${
      describe(tooltip)
    }`,
  )
  await parkPointer(devtools)
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
  const placed: string[] = []
  for (const slice of slices) {
    await movePointer(devtools, slice)
    const tooltip = await readTooltip(devtools, DONUT)
    if (
      tooltip.shown && tooltip.text.startsWith(slice.label) && tooltip.inChart && tooltip.inViewport
    ) {
      hovered.push(slice.label)
    } else hovered.push(`MISSED ${slice.label}: ${describe(tooltip)}`)
    placed.push(
      isBeside(tooltip, slice)
        ? slice.label
        : `AWAY ${slice.label} from ${slice.x},${slice.y}: ${describe(tooltip)}`,
    )
  }
  check(
    `at ${width} px, a donut slice's tooltip sits beside the middle of the slice's arc`,
    slices.length === 4 && placed.every((entry) => !entry.startsWith("AWAY")),
    placed.join("; "),
  )
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
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      atEdge: Math.abs(box.left - Math.max(chart.left, 8)) <= 1 ||
        Math.abs(box.right - Math.min(chart.right, width - 8)) <= 1,
      box: [box.left, box.top, box.right, box.bottom].map(Math.round).join(",") + " in " +
        [chart.left, chart.top, chart.right, chart.bottom].map(Math.round).join(",") +
        " of " + width + "×" + height,
    }
  })()`)
}

/**
 * Whether a tooltip sits beside a point: level with it, and {@link TOOLTIP_GAP} pixels to the side
 * its `data-side` names — or pushed against the edge of the chart or the viewport when that side
 * has no room. A tooltip the chart never placed stays where the stylesheet put it, away from the
 * point.
 */
function isBeside(tooltip: TooltipState, at: { x: number; y: number }): boolean {
  const level = tooltip.top <= at.y && tooltip.bottom >= at.y
  const gap = tooltip.side === "right" ? tooltip.left - at.x : at.x - tooltip.right
  return level && (Math.abs(gap - TOOLTIP_GAP) <= 1.5 || tooltip.atEdge)
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
