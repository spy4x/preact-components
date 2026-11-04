import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  openGuidePage,
  poll,
  pressKey,
} from "../harness.ts"

/** Where the `ComparisonTable` card's visible title sits, read at one scroll position. */
interface ComparisonTitleFit {
  /** The title's left edge, in viewport pixels; below 0 is off-screen. */
  left: number
  /** How far the title's right edge runs past the window, in pixels; above 0 is off-screen. */
  pastViewport: number
  /** How much of the title's text runs past its own box, in pixels; above 0 is cut off. */
  clipped: number
}

/** One first-column cell of the `ComparisonTable`, read after the box has scrolled. */
interface ComparisonCover {
  /** The cell's text, cut short, for the report. */
  text: string
  /** Whether `elementFromPoint` at the cell's centre lands in the cell. */
  onTop: boolean
  /** Whether a scrolled cell of the same row lies under that point, so the cover is tested. */
  under: boolean
  /** The alpha of the cell's own computed background, 0–255; 255 is opaque. */
  alpha: number
}

/** What {@link comparisonTableScroll} reads off the `ComparisonTable` card at 375 px. */
interface ComparisonTableScroll {
  /** Whether the card's title, table and scrolling container were found. */
  found: boolean
  /** How far the page itself scrolls sideways, in pixels; 0 means it does not. */
  pageOverflow: number
  /**
   * How far the component's right edge runs past the window, in pixels; above 0 is off-screen.
   * The guide clips its own content sideways, so the page alone would not show a component that
   * overflows; this does.
   */
  pastViewport: number
  /** How far the table's container scrolls sideways, in pixels; above 0 means it does. */
  scrollerOverflow: number
  /** How far the container moved when asked to scroll by 120 px. */
  scrolled: number
  /** How far each first-column cell moved left while the container scrolled, largest first. */
  firstColumnMoved: number
  /** How far the second column's header moved left over the same scroll. */
  secondColumnMoved: number
  /** The visible title before the scroll. */
  titleAtRest: ComparisonTitleFit
  /** The visible title after the scroll. */
  titleScrolled: ComparisonTitleFit
  /** Every first-column cell, after the scroll. */
  cover: ComparisonCover[]
}

/** The `ComparisonTable` card's scrolling box, as a page expression. */
const COMPARISON_SCROLLER =
  `document.querySelector('#demo-ComparisonTable [data-e2e="comparison-scroller"]')`

/**
 * Scroll the `ComparisonTable` card's container sideways and read how its columns moved, where its
 * title sits before and after, and whether the held column covers what scrolled under it.
 *
 * @param devtools The connected session, on the ui page at the width under test.
 */
function comparisonTableScroll(devtools: Devtools): Promise<ComparisonTableScroll> {
  return devtools.evaluate<ComparisonTableScroll>(`(async () => {
    const scroller = ${COMPARISON_SCROLLER}
    const table = scroller?.querySelector("table")
    const title = document.querySelector('#demo-ComparisonTable [data-e2e="comparison-title"]')
    const none = { left: 0, pastViewport: 0, clipped: 0 }
    if (!scroller || !table || !title) {
      return { found: false, pageOverflow: 0, pastViewport: 0, scrollerOverflow: 0, scrolled: 0,
        firstColumnMoved: 0, secondColumnMoved: 0, titleAtRest: none, titleScrolled: none, cover: [] }
    }
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()))
    const root = document.documentElement
    const firstColumn = [...table.querySelectorAll("tr > :first-child")]
    const second = table.querySelector("thead tr > :nth-child(2)")
    const lefts = () => firstColumn.map((cell) => cell.getBoundingClientRect().left)
    const titleFit = () => {
      const box = title.getBoundingClientRect()
      return {
        left: Math.floor(box.left),
        pastViewport: Math.ceil(box.right - root.clientWidth),
        clipped: title.scrollWidth - title.clientWidth,
      }
    }
    const canvas = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true })
    const alphaOf = (color) => {
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      return canvas.getImageData(0, 0, 1, 1).data[3]
    }
    scroller.scrollTo({ left: 0, behavior: "instant" })
    await frame()
    const before = lefts()
    const secondBefore = second.getBoundingClientRect().left
    const titleAtRest = titleFit()
    scroller.scrollTo({ left: 120, behavior: "instant" })
    await frame()
    await frame()
    const after = lefts()
    const cover = firstColumn.map((cell) => {
      const box = cell.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      const hit = document.elementFromPoint(x, y)
      return {
        text: cell.textContent.trim().slice(0, 30),
        onTop: hit !== null && cell.contains(hit),
        under: [...cell.parentElement.children].slice(1).some((other) => {
          const at = other.getBoundingClientRect()
          return at.left <= x && x <= at.right
        }),
        alpha: alphaOf(getComputedStyle(cell).backgroundColor),
      }
    })
    const reading = {
      found: true,
      pageOverflow: root.scrollWidth - root.clientWidth,
      pastViewport: Math.ceil(scroller.parentElement.getBoundingClientRect().right - root.clientWidth),
      scrollerOverflow: scroller.scrollWidth - scroller.clientWidth,
      scrolled: scroller.scrollLeft,
      firstColumnMoved: Math.max(...before.map((left, index) => Math.abs(left - after[index]))),
      secondColumnMoved: secondBefore - second.getBoundingClientRect().left,
      titleAtRest,
      titleScrolled: titleFit(),
      cover,
    }
    scroller.scrollTo({ left: 0, behavior: "instant" })
    return reading
  })()`)
}

/** What {@link comparisonTableKeyboardCheck} reads while the scrolling box has focus. */
interface ComparisonKeyboard {
  /** Whether the box was found with a focusable control before it. */
  found: boolean
  /** Whether a real Tab from the control before it put focus on the box. */
  focused: boolean
  /** What has focus after the Tab, for the report. */
  label: string
  /** Whether the box matches `:focus-visible` and its box shadow changed from its resting one. */
  ring: boolean
  /** The box's accessible name, from Chromium's accessibility tree. */
  name: string
  /** The visible title's text, the name the box should have. */
  title: string
  /** The box's `scrollLeft` after the ArrowRight presses. */
  scrolled: number
}

/**
 * Tab reaches the `ComparisonTable`'s scrolling box at 375 px, it shows a focus ring, it is named
 * by the visible title, and ArrowRight scrolls it. Focus starts on the last focusable control
 * before the box in document order, and the move is a real Tab press. The box is scrolled back
 * and blurred afterwards.
 *
 * @param devtools The connected session, on the ui page at 375 px.
 */
async function comparisonTableKeyboardCheck(devtools: Devtools): Promise<void> {
  await centreInView(devtools, COMPARISON_SCROLLER)
  const start = await devtools.evaluate<{ found: boolean; resting: string }>(`(() => {
    const scroller = ${COMPARISON_SCROLLER}
    if (!scroller) return { found: false, resting: "" }
    scroller.scrollTo({ left: 0, behavior: "instant" })
    const focusable = [...document.querySelectorAll(
      'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element === scroller || element.checkVisibility())
    const before = focusable[focusable.indexOf(scroller) - 1]
    if (!before) return { found: false, resting: "" }
    globalThis.__verifyComparison = scroller
    const resting = getComputedStyle(scroller).boxShadow
    before.focus()
    return { found: true, resting }
  })()`)
  let reading: ComparisonKeyboard = {
    found: false,
    focused: false,
    label: "",
    ring: false,
    name: "",
    title: "",
    scrolled: 0,
  }
  if (start.found) {
    await pressKey(devtools, "Tab")
    const focus = await devtools.evaluate<
      { focused: boolean; label: string; ring: boolean; title: string }
    >(`(() => {
      const scroller = globalThis.__verifyComparison
      const active = document.activeElement
      return {
        focused: active === scroller,
        label: active?.getAttribute("data-e2e") ?? active?.tagName ?? "nothing",
        ring: scroller.matches(":focus-visible") &&
          getComputedStyle(scroller).boxShadow !== ${JSON.stringify(start.resting)},
        title: document.querySelector('#demo-ComparisonTable [data-e2e="comparison-title"]')
          ?.textContent.trim() ?? "",
      }
    })()`)
    const { result } = await devtools.send<{ result: { objectId?: string } }>(
      "Runtime.evaluate",
      { expression: `globalThis.__verifyComparison ?? null` },
    )
    let name = ""
    if (result.objectId !== undefined) {
      const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
        "Accessibility.getPartialAXTree",
        { objectId: result.objectId, fetchRelatives: false },
      )
      name = nodes[0]?.name?.value ?? ""
    }
    for (let press = 0; press < 4; press++) await pressKey(devtools, "ArrowRight")
    await poll(
      () => devtools.evaluate<boolean>(`globalThis.__verifyComparison.scrollLeft > 0`),
      2_000,
    )
    const scrolled = await devtools.evaluate<number>(`globalThis.__verifyComparison.scrollLeft`)
    reading = { found: true, ...focus, name, scrolled }
  }
  await devtools.evaluate<null>(`(() => {
    const scroller = globalThis.__verifyComparison
    scroller?.scrollTo({ left: 0, behavior: "instant" })
    scroller?.blur()
    delete globalThis.__verifyComparison
    return null
  })()`)
  check(
    "at 375px Tab reaches the ComparisonTable's scrolling box, which shows a focus ring, is named " +
      "by the table's title, and scrolls with ArrowRight",
    reading.found && reading.focused && reading.ring && reading.name !== "" &&
      reading.name === reading.title && reading.scrolled > 0,
    !reading.found
      ? "no ComparisonTable scrolling box with a focusable control before it"
      : `Tab landed on ${reading.label}; ring ${reading.ring}; name "${reading.name}" for title ` +
        `"${reading.title}"; scrolled ${reading.scrolled}px after four ArrowRight presses`,
  )
}

/** One palette's contrast readings off the `ComparisonTable` card. */
interface ComparisonTableContrast {
  /** Whether every reading found its element. */
  found: boolean
  /** The lowest contrast of a value label, by value and column (`yes`, `ours yes`, …). */
  labels: Record<string, number>
  /** The lowest contrast of a value icon, by value and column. */
  icons: Record<string, number>
  /** The lowest contrast of the highlighted header's text (the name and "Ours"). */
  oursHeader: number
  /** Whether the highlighted column's ground differs from a plain column's. */
  highlightShows: boolean
}

/**
 * `ComparisonTable` on a phone and in both palettes (#585).
 *
 * At 375 px the page does not scroll sideways, the table's own container does, and while it
 * scrolls 120 px the first column — the capabilities and the header over them — stays where it was
 * as the second column moves; the visible title stays wholly inside the window before and after
 * that scroll; the held column is on top of, and opaque over, the cells scrolled under it; and a
 * real Tab reaches the box, which then scrolls with ArrowRight. In the light and the dark palette,
 * every value label, in a plain column and in the highlighted one, reads 4.5:1 or better against
 * its cell, every value icon 3:1 or better, the highlighted header's text 4.5:1 or better, and the
 * highlighted column's ground differs from a plain one. Every reading goes through `seen`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function comparisonTableChecks(devtools: Devtools): Promise<void> {
  try {
    await openGuidePage(devtools, "ui")
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const frame = `new Promise((done) => requestAnimationFrame(done))`
    await devtools.evaluate<null>(`${frame}.then(() => ${frame}).then(() => null)`)
    await centreInView(devtools, COMPARISON_SCROLLER)
    const scroll = await comparisonTableScroll(devtools)
    const detail = scroll.found
      ? `page overflow ${scroll.pageOverflow}px, past the window ${scroll.pastViewport}px, container overflow ${scroll.scrollerOverflow}px, ` +
        `scrolled ${scroll.scrolled}px, first column moved ${scroll.firstColumnMoved}px, second ` +
        `column moved ${scroll.secondColumnMoved}px`
      : "no ComparisonTable card with its scrolling container"
    check(
      "at 375px the page does not scroll sideways and the ComparisonTable stays inside the window, " +
        "while the table's own container does scroll",
      scroll.found && scroll.pageOverflow <= 0 && scroll.pastViewport <= 0 &&
        scroll.scrollerOverflow > 0 &&
        scroll.scrolled > 0,
      detail,
    )
    check(
      "at 375px the ComparisonTable's first column stays in place while the rest scrolls under it",
      scroll.found && scroll.scrolled > 0 && scroll.firstColumnMoved < 0.5 &&
        Math.abs(scroll.secondColumnMoved - scroll.scrolled) < 0.5,
      detail,
    )
    const fits = (fit: ComparisonTitleFit) =>
      fit.left >= 0 && fit.pastViewport <= 0 && fit.clipped <= 0
    const place = (fit: ComparisonTitleFit) =>
      `left ${fit.left}px, past the window ${fit.pastViewport}px, text past its box ${fit.clipped}px`
    check(
      "at 375px the ComparisonTable's whole title is inside the window, before and after the " +
        "table scrolls",
      scroll.found && scroll.scrolled > 0 && fits(scroll.titleAtRest) &&
        fits(scroll.titleScrolled),
      scroll.found
        ? `at rest: ${place(scroll.titleAtRest)}; scrolled ${scroll.scrolled}px: ` +
          place(scroll.titleScrolled)
        : detail,
    )
    check(
      "at 375px the ComparisonTable's held first column covers the cells scrolled under it: " +
        "each of its cells is on top at its centre and paints an opaque background",
      scroll.found && scroll.scrolled > 0 && scroll.cover.length > 1 &&
        scroll.cover.every((cell) => cell.onTop && cell.under && cell.alpha === 255),
      scroll.cover.map((cell) =>
        `"${cell.text}": on top ${cell.onTop}, a scrolled cell under it ${cell.under}, ` +
        `background alpha ${cell.alpha}`
      ).join("; ") || detail,
    )
    await comparisonTableKeyboardCheck(devtools)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
    await openGuidePage(devtools, "ui")
  }

  const reading = await devtools.evaluate<
    { light: ComparisonTableContrast; dark: ComparisonTableContrast }
  >(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()))
    const measure = () => {
      const table = document.querySelector("#demo-ComparisonTable table")
      const empty = { found: false, labels: {}, icons: {}, oursHeader: 0, highlightShows: false }
      if (!table) return empty
      const labels = {}
      const icons = {}
      const lowest = (record, key, value) => {
        record[key] = Math.min(record[key] ?? Infinity, value)
      }
      for (const mark of table.querySelectorAll("tbody td [data-value]")) {
        const cell = mark.closest("td")
        const key = (cell.previousElementSibling?.tagName === "TH" ? "ours " : "") + mark.dataset.value
        lowest(labels, key, seenRatio(mark.querySelector("span")))
        lowest(icons, key, seenRatio(mark.querySelector("svg")))
      }
      const header = table.querySelector("thead [data-ours]")
      const plain = table.querySelector("tbody tr > td:nth-child(3)")
      const ours = table.querySelector("tbody tr > td:nth-child(2)")
      if (!header || !plain || !ours) return empty
      const same = (a, b) => a.every((channel, index) => channel === b[index])
      return {
        found: Object.keys(labels).length === 6,
        labels,
        icons,
        oursHeader: Math.min(...textHolders(header).map((holder) => seenRatio(holder))),
        highlightShows: !same(seen(plain).ground, seen(ours).ground),
      }
    }
    try {
      root.classList.remove("dark")
      await frame()
      await frame()
      const light = measure()
      root.classList.add("dark")
      await frame()
      await frame()
      const dark = measure()
      return { light, dark }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`)

  for (const palette of ["light", "dark"] as const) {
    const contrast = reading[palette]
    const lowest = (record: Record<string, number>) => Math.min(...Object.values(record))
    const list = (record: Record<string, number>) =>
      Object.entries(record).map(([key, value]) => `${key} ${value.toFixed(2)}:1`).join(", ")
    check(
      `in the ${palette} palette every ComparisonTable value label reads 4.5:1 and its icon 3:1, ` +
        "in a plain column and in the highlighted one",
      contrast.found && lowest(contrast.labels) >= 4.5 && lowest(contrast.icons) >= 3,
      contrast.found
        ? `labels: ${list(contrast.labels)}; icons: ${list(contrast.icons)}`
        : "the ComparisonTable card is missing a value in a plain or the highlighted column",
    )
    check(
      `in the ${palette} palette the ComparisonTable's highlighted column shows, and its header ` +
        "reads 4.5:1",
      contrast.found && contrast.highlightShows && contrast.oursHeader >= 4.5,
      `header ${contrast.oursHeader.toFixed(2)}:1, highlight differs from a plain column ` +
        `${contrast.highlightShows}`,
    )
  }
}
