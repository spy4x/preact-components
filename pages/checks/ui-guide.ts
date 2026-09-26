import { guidePages } from "@spy4x/preact-ui-guide/registry"
import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  poll,
  pressKey,
  settledScroll,
} from "./harness.ts"
import { PAGE_TITLE } from "../src/site.ts"

/** The guide's side navigation at `lg` and up, where it is a column beside the page. */
const ASIDE_NAV = "aside nav"
/** The phone-width menu button, and the dialog it opens. */
const MENU_BUTTON = `[data-e2e="ui-guide-nav-open"]`
const MENU_DIALOG = `[data-e2e="ui-guide-nav-dialog"]`

/**
 * `ui-guide/`'s browser checks: the shell — its pages, its navigation at both widths, a deep link
 * landing on another page — and every card's usage-snippet copy control, clicked for real.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function uiGuideChecks(devtools: Devtools): Promise<void> {
  await serverTextChecks(devtools)
  await copyBlockChecks(devtools)
  // Between `lg` and `xl`: the side navigation is a column and still lists the page's cards, which
  // move to the "On this page" column from `xl`.
  await withViewport(devtools, 1152, 800, () => navigationChecks(devtools))
  await withViewport(devtools, 375, 812, () => phoneNavigationChecks(devtools))
  await withViewport(devtools, 375, 812, () => overflowChecks(devtools))
  for (const width of [375, 1024]) {
    await withViewport(devtools, width, 812, () => propsSummaryCheck(devtools, width))
  }
  for (const width of [375, 1280]) {
    await withViewport(devtools, width, 812, () => tooltipTriggerCheck(devtools, width))
  }
  await withViewport(devtools, 1280, 800, () => searchChecks(devtools))
  await withViewport(devtools, 1280, 800, () => searchShortcutChecks(devtools))
  for (const width of [375, 1280]) {
    await withViewport(devtools, width, 812, () => themeSwitchCheck(devtools, width))
  }
  await withViewport(devtools, 375, 812, () => drawerContentCheck(devtools))
  await withViewport(devtools, 1440, 900, () => onThisPageCheck(devtools))
  await coldDeepLinkCheck(devtools)
  await coldFragmentCheck(devtools)
  await reloadAtTopCheck(devtools)
}

/**
 * Run `body` with the page laid out at one viewport size, and put the browser's own size back
 * afterwards, however `body` ends.
 */
async function withViewport(
  devtools: Devtools,
  width: number,
  height: number,
  body: () => Promise<void>,
): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    await body()
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/**
 * Press and release the left button on the middle of an element, once it is in view: centred in
 * the page for an element of the page, scrolled into its dialog's own box for one inside a modal
 * dialog, which the page's scroll does not move, and left where it is with `inPlace`.
 */
async function clickElement(
  devtools: Devtools,
  selector: string,
  { inPlace = false }: { inPlace?: boolean } = {},
): Promise<boolean> {
  const aim = `document.querySelector(${JSON.stringify(selector)})`
  const inDialog = await devtools.evaluate<boolean>(`${aim}?.closest("dialog") != null`)
  if (inPlace) {
    // Aimed where it is: a link in the sticky column is on screen at any scroll, and centring it
    // would scroll the page the check is about to read.
  } else if (inDialog) {
    await devtools.evaluate(`${aim}.scrollIntoView({ block: "nearest", behavior: "instant" })`)
  } else if (!await centreInView(devtools, aim)) return false
  const point = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const box = ${aim}?.getBoundingClientRect()
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
  })()`)
  if (!point) return false
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    })
  }
  return true
}

/**
 * #30: every usage block's own copy control, clicked, puts that block's text on the clipboard —
 * on every page that has cards, since the guide renders one page at a time.
 *
 * `navigator.clipboard` is stubbed in the page rather than read back, because reading it needs a
 * permission this run does not grant; the stub is what the page's own copy path calls.
 */
async function copyBlockChecks(devtools: Devtools): Promise<void> {
  const totals = {
    cards: 0,
    missing: [] as string[],
    unconverted: [] as string[],
    unlabelled: [] as string[],
  }
  let patched = true
  let feedback = false

  for (const page of guidePages.filter((candidate) => candidate.sections.length > 0)) {
    await openGuidePage(devtools, page.id)
    const result = await devtools.evaluate<{
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

    patched &&= result.patched
    feedback ||= result.feedback
    totals.cards += result.cards
    totals.missing.push(...result.missing)
    totals.unconverted.push(...result.unconverted)
    totals.unlabelled.push(...result.unlabelled)
  }

  const expected = guidePages.reduce(
    (total, page) => total + page.sections.reduce((sum, section) => sum + section.names.length, 0),
    0,
  )
  check(
    "every usage block copies its own text, through a labelled control",
    patched && totals.cards === expected && totals.missing.length === 0 &&
      totals.unlabelled.length === 0 && totals.unconverted.length === 0,
    `${totals.cards}/${expected} blocks across the pages, ${totals.missing.length} without a ` +
      `control, ${totals.unconverted.length} copied the wrong text, ` +
      `${totals.unlabelled.length} unlabelled`,
  )
  check(
    "the copy control confirms the copy",
    feedback,
    "the glyph changed after the click",
  )
}

/** One card's text, split into the part compared everywhere and the part an effect draws. */
interface CardText {
  /** The card's text with every {@link DrawnInBrowser.selector} match left out. */
  rest: string
  /** The text of those matches alone; empty for a card with nothing listed. */
  drawn: string
  /** How many elements matched the selector (outermost matches only). */
  parts: number
}

/**
 * The text of every card, keyed by its `demo-<Name>` id, with each run of whitespace collapsed to
 * one space. A page expression taking the root to read and a map of card id to the selector of the
 * part left out of `rest`, so the same reading applies to the served document parsed in the page
 * and to the live one.
 *
 * A `<textarea>` counts by its value rather than its child text: the server writes the value as the
 * element's text, while Preact in the browser sets the `value` property and leaves the element
 * empty, so `textContent` alone reports every filled textarea as a difference.
 */
const CARD_TEXTS = `(root, drawnBy) => {
  const squash = (text) => text.replace(/\\s+/g, " ").trim()
  const read = (card) => {
    const selector = drawnBy[card.id]
    const rest = []
    const drawn = []
    let parts = 0
    const walk = (node, into) => {
      if (node.nodeType === Node.TEXT_NODE) return void into.push(node.data)
      if (node.nodeType !== Node.ELEMENT_NODE) return
      if (into === rest && selector && node.matches(selector)) {
        into = drawn
        parts++
      }
      if (node.nodeName === "TEXTAREA") return void into.push(" " + node.value + " ")
      for (const child of node.childNodes) walk(child, into)
    }
    walk(card, rest)
    return { rest: squash(rest.join("")), drawn: squash(drawn.join(" ")), parts }
  }
  return Object.fromEntries(
    [...root.querySelectorAll('article[id^="demo-"]')].map((card) => [card.id, read(card)]),
  )
}`

/** A part of a card that an effect draws, so its text exists only in the browser. */
interface DrawnInBrowser {
  /** A selector inside the card for that part; everything else in the card is still compared. */
  selector: string
  /** Why this part cannot match the served document. */
  reason: string
  /**
   * How many elements the selector matches in the card in the browser. A different count fails the
   * run, so a second element that happens to match (another status region, another chart) is not
   * left out silently.
   */
  parts: number
}

/**
 * The cards with a part whose text is expected to differ between the served document and the page
 * after it runs. Only the part the selector names is left out; the rest of the card is compared
 * like any other. A listed part whose text stops differing fails the check, so the list cannot
 * outlive its reason.
 */
const TEXT_DRAWN_IN_BROWSER: Record<string, DrawnInBrowser> = {
  "demo-CrudEditor": {
    selector: `[role="status"][aria-atomic="true"]`,
    parts: 1,
    reason: "validation runs in an effect, so the cross-field message in the live region above " +
      "Save exists only in the browser",
  },
  "demo-D3LineChart": {
    selector: `[data-e2e="d3-chart-slot"]`,
    parts: 2,
    reason: "charts/d3-line-chart loads when the charts page opens: the served page holds a " +
      "placeholder, and d3 draws the chart's axes, lines and legend in its place",
  },
  "demo-CompareChart": {
    selector: `[data-e2e="d3-chart-slot"]`,
    parts: 1,
    reason: "charts/compare-chart loads when the charts page opens: the served page holds a " +
      "placeholder, and the browser shows the toggle and the chart d3 draws in its place",
  },
  "demo-formatTimeTick": {
    selector: `[data-e2e="example-output"]`,
    parts: 1,
    reason: "charts/d3-line-chart loads when the charts page opens, and this output calls " +
      "formatTimeTick and defaultTooltipFormat from it",
  },
  "demo-Map": {
    selector: `[data-e2e="map-slot"]`,
    parts: 1,
    reason: "@spy4x/preact-map, and Leaflet with it, loads when the map page opens: the served " +
      "slot holds a placeholder, and the browser's the map, its credit line and its list of places",
  },
}

/**
 * Wait until the showing page has replaced every placeholder of a lazily loaded module
 * (`ui-guide/lazy.ts`) with what that module draws: the charts page loads d3 when it opens, and the
 * map page `@spy4x/preact-map`, so their cards and examples read their placeholder text until the
 * module arrives. Reading before then
 * would find a listed part the same on both sides and fail for the wrong reason. A page with no
 * placeholder returns at once; one still showing a placeholder after 15s is left for the text check
 * to report.
 *
 * @param devtools The connected session, on the page about to be read.
 */
async function lazyContentShown(devtools: Devtools): Promise<void> {
  await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        if (document.querySelector('[data-e2e="d3-chart-placeholder"]') !== null) return false
        if (document.querySelector('[data-e2e="map-placeholder"]') !== null) return false
        return ![...document.querySelectorAll('[data-e2e="example-output"]')]
          .some((output) => output.textContent.includes("needs charts/d3-line-chart"))
      })()`),
    15_000,
  )
}

/**
 * #303: every card shows the same text in the browser as in the served, server-rendered document.
 *
 * Preact replaces text that differs from the server's while it hydrates, and logs nothing, so a card
 * whose output depends on the clock, the time zone, the locale or a browser-only API passes the
 * console check while a reader without JavaScript sees something else. The served `index.html` is
 * fetched from the page's own address and parsed there; it is the guide's `all` page, so it holds
 * every card. Each package page is then opened, and every card's text, read the same way, is
 * compared with the served card of the same id. Text only: attributes and styles are not compared.
 */
async function serverTextChecks(devtools: Devtools): Promise<void> {
  const drawnBy = JSON.stringify(
    Object.fromEntries(
      Object.entries(TEXT_DRAWN_IN_BROWSER).map(([id, { selector }]) => [id, selector]),
    ),
  )
  const served = await devtools.evaluate<Record<string, CardText>>(`(async () => {
    const response = await fetch(location.href.split("#")[0], { cache: "no-store" })
    const html = await response.text()
    const document = new DOMParser().parseFromString(html, "text/html")
    return (${CARD_TEXTS})(document, ${drawnBy})
  })()`)

  const differing = new Map<string, string>()
  const missing: string[] = []
  const stillSame: string[] = []
  const wrongParts: string[] = []
  const seen = new Set<string>()
  for (const page of guidePages.filter((each) => each.id !== "all" && each.sections.length > 0)) {
    await openGuidePage(devtools, page.id)
    await lazyContentShown(devtools)
    const live = await devtools.evaluate<Record<string, CardText>>(
      `(${CARD_TEXTS})(document, ${drawnBy})`,
    )
    for (const [id, text] of Object.entries(live)) {
      seen.add(id)
      const server = served[id]
      if (server === undefined) {
        missing.push(id)
        continue
      }
      if (server.rest !== text.rest) differing.set(id, whereTextsDiffer(server.rest, text.rest))
      if (id in TEXT_DRAWN_IN_BROWSER && server.drawn === text.drawn) stillSame.push(id)
      const listedParts = TEXT_DRAWN_IN_BROWSER[id]?.parts
      if (listedParts !== undefined && text.parts !== listedParts) {
        wrongParts.push(`#${id} (${text.parts}, listed ${listedParts})`)
      }
    }
  }

  const expected = guidePages.filter((page) => page.id !== "all").reduce(
    (total, page) => total + page.sections.reduce((sum, section) => sum + section.names.length, 0),
    0,
  )
  const listed = Object.keys(TEXT_DRAWN_IN_BROWSER)
  const unseen = listed.filter((id) => !seen.has(id))
  check(
    "every card shows the same text in the browser as in the served document",
    seen.size === expected && Object.keys(served).length === expected && missing.length === 0 &&
      differing.size === 0 && stillSame.length === 0 && unseen.length === 0 &&
      wrongParts.length === 0,
    [
      `${seen.size}/${expected} cards read in the browser, ${Object.keys(served).length} served, ` +
      `${listed.length} with a part drawn in the browser left out`,
      missing.length > 0 ? `not in the served document: ${missing.join(", ")}` : "",
      differing.size > 0
        ? `text differs: ${[...differing].map(([id, where]) => `#${id} (${where})`).join(", ")}`
        : "",
      stillSame.length > 0
        ? `listed part now the same on both sides, so drop it from the list: ${
          stillSame.join(", ")
        }`
        : "",
      unseen.length > 0 ? `listed but no such card: ${unseen.join(", ")}` : "",
      wrongParts.length > 0
        ? `a listed selector matches a different number of parts: ${wrongParts.join(", ")}`
        : "",
    ].filter(Boolean).join("; "),
  )
}

/**
 * Where two card texts part: a few characters of each from the first one that differs, so a failure
 * says what changed as well as which card.
 */
function whereTextsDiffer(served: string, live: string): string {
  let at = 0
  while (at < served.length && served[at] === live[at]) at++
  const from = Math.max(0, at - 10)
  const excerpt = (text: string) => JSON.stringify(text.slice(from, at + 30))
  return `served ${excerpt(served)}, browser ${excerpt(live)}`
}

/** What one page of the guide shows, read off the live document. */
interface Shown {
  page: string
  current: string[]
  cards: string[]
  title: string
}

/** Read which page shows, which navigation links are current, and which cards are rendered. */
function readShown(devtools: Devtools, nav: string): Promise<Shown> {
  return devtools.evaluate<Shown>(`(() => ({
    page: document.querySelector("[data-guide-page]")?.dataset.guidePage ?? "",
    current: [...document.querySelectorAll(${JSON.stringify(`${nav} a[aria-current="page"]`)})]
      .map((link) => link.textContent.trim()),
    cards: [...document.querySelectorAll('article[id^="demo-"]')].map((card) => card.id),
    title: document.title,
  }))()`)
}

/**
 * At desktop width the navigation is a column beside the page: a real click on another page's link
 * shows that page from its title, marks its link current, renders its cards and no one else's, and
 * titles the document after it.
 */
async function navigationChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "overview")
  const crud = guidePages.find((page) => page.id === "crud")
  const crudCards = (crud?.sections ?? []).flatMap((section) => section.names)
    .map((name) => `demo-${name}`)

  // Clicked a screen down the overview, so a page that kept the old scroll, or scrolled to the
  // section that shares its id, lands below its own title. Not from the very bottom: there the
  // footer pushes the sticky column, and the link with it, off the screen.
  await devtools.evaluate(`(scrollTo({ top: innerHeight, behavior: "instant" }), null)`)
  await settledScroll(devtools)
  const scrolledFrom = await devtools.evaluate<number>("Math.round(scrollY)")
  const clicked = await clickElement(devtools, `${ASIDE_NAV} a[data-guide-page-link="crud"]`, {
    inPlace: true,
  })
  await poll(
    () => devtools.evaluate<boolean>(`document.querySelector('[data-guide-page="crud"]') !== null`),
    3_000,
  )
  await settledScroll(devtools)
  const shown = await readShown(devtools, ASIDE_NAV)
  // The heading is in view when the point at its middle is the heading, not the sticky header.
  const titleInView = await devtools.evaluate<boolean>(`(() => {
    const heading = document.querySelector("[data-guide-page] h1")
    const box = heading?.getBoundingClientRect()
    if (!box) return false
    const hit = document.elementFromPoint(box.left + 4, box.top + box.height / 2)
    return hit !== null && heading.contains(hit)
  })()`)

  check(
    "a click in the side navigation shows that page from its title, and only that page's cards",
    clicked && scrolledFrom > 0 && titleInView && shown.page === "crud" &&
      shown.current.join() === "CRUD" &&
      shown.cards.length === crudCards.length &&
      shown.cards.every((card) => crudCards.includes(card)) &&
      shown.title === `CRUD — ${PAGE_TITLE}`,
    `${clicked ? "clicked" : "could not click"} from scrollY ${scrolledFrom} → page ` +
      `"${shown.page}", h1 ${titleInView ? "in view" : "not in view"}, current ` +
      `${JSON.stringify(shown.current)}, ${shown.cards.length}/${crudCards.length} cards, ` +
      `title "${shown.title}"`,
  )

  // The skip link is the guide's first link: a real Enter on it moves focus past the navigation.
  // The column it lands on is focusable only while it holds that focus; one that stayed focusable
  // would take the focus of every click on a non-focusable spot inside it, and a menu there closes.
  const SKIP = `document.querySelector('[data-e2e="ui-guide-skip"]')`
  const COLUMN = `document.getElementById(${SKIP}.getAttribute("href").slice(1))`
  await devtools.evaluate(`${SKIP}.focus()`)
  const padding = await devtools.evaluate<string>(`getComputedStyle(${SKIP}).paddingLeft`)
  await pressKey(devtools, "Enter")
  const onContent = await devtools.evaluate<boolean>(`document.activeElement === ${COLUMN}`)
  await pressKey(devtools, "Tab")
  const released = await devtools.evaluate<boolean>(
    `document.activeElement !== ${COLUMN} && !${COLUMN}.hasAttribute("tabindex")`,
  )
  check(
    "a real Enter on the skip link moves focus to the page, which is unfocusable again after Tab",
    padding === "12px" && onContent && released,
    `skip link padding while focused ${padding}; focus on the page column: ${onContent}; after ` +
      `Tab the column is ${released ? "no longer focusable" : "still focusable or focused"}`,
  )

  // Within the page showing, the navigation lists its cards; a click on one lands on it. A
  // component card, whose link text is its name; an example card's link reads its title.
  const target = (crud?.sections ?? []).filter((section) => section.kind === "component")
    .flatMap((section) => section.names).map((name) => `demo-${name}`).at(-1) ?? ""
  const name = target.replace(/^demo-/, "")
  const link = `${ASIDE_NAV} a[href$="/${
    name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
  }"]`
  // The column scrolls on its own once its list outgrows the screen; scroll it, not the page, to
  // bring the link into view, then aim at it where it is.
  await devtools.evaluate(`(() => {
    const link = document.querySelector(${JSON.stringify(link)})
    const column = link?.closest("aside")
    if (!link || !column) return null
    const offset = link.getBoundingClientRect().top - column.getBoundingClientRect().top
    column.scrollTop += offset - column.clientHeight / 2
    return null
  })()`)
  const linkClicked = await clickElement(devtools, link, { inPlace: true })
  const landed = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const card = document.getElementById(${JSON.stringify(target)})
        if (!card?.hasAttribute("data-deep-link")) return false
        const top = card.getBoundingClientRect().top
        return top >= 0 && top < innerHeight / 2
      })()`),
    3_000,
  )
  const marked = await devtools.evaluate<string>(
    `document.querySelector('${ASIDE_NAV} a[aria-current="true"]')?.textContent ?? ""`,
  )
  check(
    "a card's link in the side navigation lands on its card and marks the link",
    linkClicked && landed && marked === name,
    `${name}: ${linkClicked ? "clicked" : "could not click"}, card ${
      landed ? "marked and in view" : "not marked in view"
    }, current link "${marked}"`,
  )
}

/**
 * At phone width the navigation is a modal dialog behind a menu button: Enter and Space on the
 * button open it with focus inside, Escape closes it and puts focus back on the button, and a link
 * followed from inside it shows its page and closes it.
 */
async function phoneNavigationChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "overview")

  const state = () =>
    devtools.evaluate<{ open: boolean; modal: boolean; inside: boolean; onButton: boolean }>(
      `(() => {
        const dialog = document.querySelector(${JSON.stringify(MENU_DIALOG)})
        return {
          open: dialog?.open === true,
          modal: dialog?.matches(":modal") === true,
          inside: dialog?.contains(document.activeElement) === true,
          onButton: document.activeElement === document.querySelector(${
        JSON.stringify(MENU_BUTTON)
      }),
        }
      })()`,
    )

  const visible = await devtools.evaluate<{ button: boolean; aside: boolean }>(`({
    button: document.querySelector(${JSON.stringify(MENU_BUTTON)})?.checkVisibility() === true,
    aside: document.querySelector("aside")?.checkVisibility() === true,
  })`)

  const results: string[] = []
  let ok = visible.button && !visible.aside
  for (const key of ["Enter", "Space"] as const) {
    await devtools.evaluate(`document.querySelector(${JSON.stringify(MENU_BUTTON)}).focus()`)
    await pressKey(devtools, key)
    const opened = await poll(async () => (await state()).open, 2_000)
    const afterOpen = await state()
    await pressKey(devtools, "Escape")
    await poll(async () => !(await state()).open, 2_000)
    const afterClose = await state()
    const passed = opened && afterOpen.modal && afterOpen.inside && !afterClose.open &&
      afterClose.onButton
    ok &&= passed
    results.push(
      `${key}: opened ${afterOpen.open} (modal ${afterOpen.modal}, focus inside ` +
        `${afterOpen.inside}), Escape → open ${afterClose.open}, focus on button ` +
        `${afterClose.onButton}`,
    )
  }
  check(
    "at phone width the navigation opens with Enter and Space and closes with Escape, " +
      "returning focus",
    ok,
    `menu button visible ${visible.button}, side column visible ${visible.aside}; ` +
      results.join("; "),
  )

  // Follow a link from inside the dialog: the page changes and the dialog closes behind it.
  await devtools.evaluate(`document.querySelector(${JSON.stringify(MENU_BUTTON)}).focus()`)
  await pressKey(devtools, "Enter")
  const MAP_LINK = `${MENU_DIALOG} a[data-guide-page-link="map"]`
  const reopened = await poll(async () => (await state()).open, 3_000)
  const linked = await poll(
    () =>
      devtools.evaluate<boolean>(`document.querySelector(${JSON.stringify(MAP_LINK)}) !== null`),
    3_000,
  )
  const followed = reopened && linked && await clickElement(devtools, MAP_LINK)
  await poll(
    () => devtools.evaluate<boolean>(`document.querySelector('[data-guide-page="map"]') !== null`),
    3_000,
  )
  await poll(async () => !(await state()).open, 2_000)
  const after = await state()
  const page = await devtools.evaluate<string>(
    `document.querySelector("[data-guide-page]")?.dataset.guidePage ?? ""`,
  )
  // A dialog left open is modal and would swallow every later block's clicks.
  if (after.open) {
    await devtools.evaluate(`document.querySelector(${JSON.stringify(MENU_DIALOG)}).close()`)
  }
  check(
    "a link followed from the phone navigation shows its page and closes the dialog",
    followed && page === "map" && !after.open && after.onButton,
    `dialog reopened ${reopened}, Map link rendered ${linked}, ` +
      `${followed ? "clicked" : "could not click"} → page "${page}", dialog open ` +
      `${after.open}, focus back on the menu button ${after.onButton}`,
  )
}

/**
 * The Tooltip card shows every placement with its hint forced visible, so a reader can see where
 * each one opens. That only works while no hint covers a trigger: at the given width, the element
 * the browser finds at the middle of each placement trigger is the trigger itself or inside it —
 * and not the trigger's own hint, which is a child of the trigger too.
 *
 * @param devtools The connected session.
 * @param width The viewport width the caller set, for the check's name.
 */
async function tooltipTriggerCheck(devtools: Devtools, width: number): Promise<void> {
  await openGuidePage(devtools, "ui")
  const cells = `[...document.querySelectorAll('#demo-Tooltip [data-e2e="tooltip-placement"]')]`
  const count = await devtools.evaluate<number>(`${cells}.length`)
  const covered: string[] = []
  for (let index = 0; index < count; index++) {
    const trigger = `${cells}[${index}].querySelector("[aria-describedby]")`
    const inView = await centreInView(devtools, trigger)
    const hit = await devtools.evaluate<{ name: string; own: boolean; by: string }>(`(() => {
      const trigger = ${trigger}
      const box = trigger.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return {
        name: trigger.getAttribute("aria-label") ?? trigger.textContent.trim(),
        own: hit !== null && trigger.contains(hit) && hit.closest("[role=tooltip]") === null,
        by: hit === null
          ? "nothing"
          : hit.closest("[role=tooltip]")
          ? (trigger.contains(hit) ? "its own hint" : "a hint")
          : hit.tagName,
      }
    })()`)
    if (!inView || !hit.own) covered.push(`${hit.name} (${inView ? hit.by : "not in view"})`)
  }
  await devtools.evaluate(`globalThis.scrollTo({ top: 0, behavior: "instant" })`)
  check(
    `at ${width}px no Tooltip placement trigger is covered by a hint`,
    count === 4 && covered.length === 0,
    count !== 4
      ? `found ${count} placement cells in #demo-Tooltip, expected 4`
      : covered.length === 0
      ? "top, right, bottom and left are each the element at their own centre"
      : `covered: ${covered.join(", ")}`,
  )
}

/**
 * The text the shell itself sets — a card's heading and summary, a page's or a section's heading
 * and blurb — in the page showing. A card's live example is left out: it is the component's own
 * markup, not the shell's.
 */
const SHELL_TEXT = [
  `article[id^="demo-"] > header > *`,
  `[data-guide-page] header > *`,
  `section[id] > div:first-child:not(.sr-only) > *`,
].join(", ")

/**
 * Every card's props summary fits its card without scrolling sideways, on a phone and in a
 * half-width card at 1024px, where a row stacks its sentence under the name and type.
 *
 * The summary scrolls rather than clips when it is too wide, so the page-level overflow check does
 * not see it; this measures each summary's own box on every page.
 */
async function propsSummaryCheck(devtools: Devtools, width: number): Promise<void> {
  const wide: string[] = []
  let measured = 0
  let stacked = 0
  for (const page of guidePages) {
    await openGuidePage(devtools, page.id)
    const found = await devtools.evaluate<{ count: number; stacked: number; wide: string[] }>(
      `(() => {
      const boxes = [...document.querySelectorAll("article table > caption")]
        .map((caption) => caption.closest("table")?.parentElement)
        .filter((box) => box && box.classList.contains("@container"))
      const wide = []
      let stacked = 0
      for (const box of boxes) {
        const card = box.closest("article")?.id ?? "?"
        if (box.scrollWidth > box.clientWidth + 1) {
          wide.push(card + " scrolls by " + (box.scrollWidth - box.clientWidth) + "px")
        }
        const table = box.querySelector("table").getBoundingClientRect().width
        // Below the card's md container width (28rem) a sentence takes the row's whole width
        // instead of a third of it.
        const md = 28 * parseFloat(getComputedStyle(document.documentElement).fontSize)
        if (table < md) {
          stacked++
          for (const cell of box.querySelectorAll("tbody td:last-child")) {
            const share = cell.getBoundingClientRect().width / table
            if (share < 0.9) wide.push(card + " squeezes a sentence to " + Math.round(share * 100) + "%")
          }
          // No page has a long prop name today, so borrow a row, give it one, and require the
          // type beside it to keep a readable share of the row.
          const row = box.querySelector("tbody tr").cloneNode(true)
          row.querySelector("th").textContent = "onSelectionChangeWithModifiersAndAVeryLongNameIndeed"
          row.querySelector("td").textContent = "(event: SelectionChangeEvent<RowModel>) => void"
          box.querySelector("tbody").append(row)
          const typeShare = row.querySelector("td").getBoundingClientRect().width / table
          const scrolls = box.scrollWidth > box.clientWidth + 1
          row.remove()
          if (typeShare < 0.4 || scrolls) {
            wide.push(card + " gives a long name's type " + Math.round(typeShare * 100) + "%")
          }
        }
      }
      return { count: boxes.length, stacked, wide }
    })()`,
    )
    measured += found.count
    stacked += found.stacked
    for (const entry of found.wide) wide.push(`${page.id}: ${entry}`)
  }
  check(
    `every props summary fits its card at ${width}px, a narrow one with each sentence at full width and a long name's type at 40% or more`,
    wide.length === 0 && measured > 0 && stacked > 0,
    wide.length === 0
      ? `${measured} summaries measured across ${guidePages.length} pages, ${stacked} of them narrow`
      : wide.join(", "),
  )
}

/**
 * At 375px wide no page scrolls sideways and none of the shell's own text runs past its box, in
 * the light palette or the dark one.
 *
 * Both halves are needed: the page column clips what overflows it, so a document that does not
 * scroll can still hide the end of a summary a reader never sees. The palette is switched on
 * `<html>`'s class, the switch the page's own toggle flips, and put back afterwards; the toggle
 * itself is not pressed, because it also writes to storage.
 */
async function overflowChecks(devtools: Devtools): Promise<void> {
  const wide: string[] = []
  const clipped = new Map<string, number>()
  let measured = 0
  const wasDark = await devtools.evaluate<boolean>(
    `document.documentElement.classList.contains("dark")`,
  )
  try {
    for (const dark of [false, true]) {
      await devtools.evaluate(`document.documentElement.classList.toggle("dark", ${dark})`)
      for (const page of guidePages) {
        await openGuidePage(devtools, page.id)
        const width = await devtools.evaluate<
          { scroll: number; client: number; texts: number; overflowing: string[] }
        >(`(() => {
          const texts = [...document.querySelectorAll(${JSON.stringify(SHELL_TEXT)})]
          return {
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
            texts: texts.length,
            overflowing: texts.filter((text) => text.scrollWidth > text.clientWidth + 1)
              .map((text) => (text.closest("[id]")?.id ?? "page") + " " + text.tagName.toLowerCase()),
          }
        })()`)
        measured += width.texts
        for (const [owner, px] of Object.entries(await clippedContent(devtools))) {
          clipped.set(owner, Math.max(clipped.get(owner) ?? 0, px))
        }
        const palette = dark ? "dark" : "light"
        if (width.scroll > width.client) {
          wide.push(`${page.id} (${palette}) scrolls to ${width.scroll}px`)
        }
        for (const text of width.overflowing) wide.push(`${page.id} (${palette}): ${text}`)
      }
    }
  } finally {
    await devtools.evaluate(`document.documentElement.classList.toggle("dark", ${wasDark})`)
  }
  check(
    "no page of the guide scrolls sideways at 375px or cuts off its own text, in either palette",
    wide.length === 0 && measured > 0,
    wide.length === 0
      ? `${guidePages.length} pages × 2 palettes fit 375px; ${measured} headings, summaries ` +
        `and blurbs wrap inside their boxes`
      : wide.join(", "),
  )

  const unlisted = [...clipped].filter(([owner]) => !(owner in CLIPPED_AT_PHONE_WIDTH))
  const fixed = Object.keys(CLIPPED_AT_PHONE_WIDTH).filter((owner) => !clipped.has(owner))
  check(
    "at 375px exactly the listed cards run past the page column, and nothing else does",
    unlisted.length === 0 && fixed.length === 0,
    [
      unlisted.length > 0
        ? `cut off and not listed: ${
          unlisted.map(([owner, px]) => `${owner} by ${px}px`).join(", ")
        }`
        : "",
      fixed.length > 0 ? `listed but now fits, so drop it from the list: ${fixed.join(", ")}` : "",
      `known: ${[...clipped].map(([owner, px]) => `${owner} ${px}px`).join(", ")}`,
    ].filter(Boolean).join("; "),
  )
}

/**
 * The cards whose live example is wider than a 375px page column, which the column clips. Each is
 * the card body's own markup, owned by the card, and waiting for a fix there; a card that starts
 * overflowing, or one of these that stops, fails the check above, so the list cannot drift.
 *
 * Empty: every card fits a 375px column. A card listed here needs the reason it cannot fit yet.
 */
const CLIPPED_AT_PHONE_WIDTH: Record<string, string> = {}

/**
 * How far past the page column the content showing runs, per card (`demo-<Name>`) or `host extra`
 * for the host's own content, in whole pixels. Content inside something that scrolls or clips on
 * its own is its container's business and is left out, as is anything 1px wide or less
 * (`sr-only`).
 */
function clippedContent(devtools: Devtools): Promise<Record<string, number>> {
  return devtools.evaluate<Record<string, number>>(`(() => {
    const column = document.getElementById(
      document.querySelector('[data-e2e="ui-guide-skip"]').getAttribute("href").slice(1),
    )
    const edge = column.getBoundingClientRect()
    const contained = (element) => {
      for (let node = element.parentElement; node && node !== column; node = node.parentElement) {
        if (getComputedStyle(node).overflowX !== "visible") return true
      }
      return false
    }
    const past = {}
    for (const element of column.querySelectorAll("*")) {
      const box = element.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      const by = Math.round(Math.max(box.right - edge.right, edge.left - box.left))
      if (by <= 1 || contained(element)) continue
      const owner = element.closest('article[id^="demo-"]')?.id ?? "host extra"
      past[owner] = Math.max(past[owner] ?? 0, by)
    }
    return past
  })()`)
}

/**
 * A deep link opened cold — the address typed or pasted, the page loaded fresh — lands on a card on
 * one package's page: the island hydrates the `all` page the server sent, reads the address, shows
 * the card's page, and marks and scrolls to the card.
 */
async function coldDeepLinkCheck(devtools: Devtools): Promise<void> {
  const HREF = "#/crud/crud-editor"
  await devtools.evaluate(`(history.replaceState(null, "", ${JSON.stringify(HREF)}), null)`)
  await devtools.send("Page.reload", { ignoreCache: true })
  await devtools.next("Page.loadEventFired")
  const hydrated = await poll(
    () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
    10_000,
  )
  const landed = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const card = document.getElementById("demo-CrudEditor")
        if (!card?.hasAttribute("data-deep-link")) return false
        const top = card.getBoundingClientRect().top
        return top >= 0 && top < innerHeight / 2
      })()`),
    5_000,
  )
  await settledScroll(devtools)
  const shown = await devtools.evaluate<{ page: string; title: string }>(`({
    page: document.querySelector("[data-guide-page]")?.dataset.guidePage ?? "",
    title: document.title,
  })`)
  check(
    "a deep link loaded cold opens its card's page and lands on the card",
    hydrated && landed && shown.page === "crud" && shown.title.startsWith("CrudEditor"),
    `${HREF} → page "${shown.page}", card ${
      landed ? "marked and in view" : "not marked in view"
    }, ` +
      `title "${shown.title}"`,
  )
}

/**
 * A bare fragment opened cold, `#icons`, names an element of one page: the guide opens that page
 * and the element is in view, rather than the overview with the element gone.
 */
async function coldFragmentCheck(devtools: Devtools): Promise<void> {
  const HREF = "#icons"
  await devtools.evaluate(`(history.replaceState(null, "", ${JSON.stringify(HREF)}), null)`)
  await devtools.send("Page.reload", { ignoreCache: true })
  await devtools.next("Page.loadEventFired")
  const hydrated = await poll(
    () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
    10_000,
  )
  const landed = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        if (document.querySelector("[data-guide-page]")?.dataset.guidePage !== "icons") return false
        const top = document.getElementById("icons")?.getBoundingClientRect().top
        return top !== undefined && top >= 0 && top < innerHeight / 2
      })()`),
    5_000,
  )
  await settledScroll(devtools)
  const page = await devtools.evaluate<string>(
    `document.querySelector("[data-guide-page]")?.dataset.guidePage ?? ""`,
  )
  check(
    "a bare fragment loaded cold opens the page that holds its element, in view",
    hydrated && landed,
    `${HREF} → page "${page}", #icons ${landed ? "in view" : "not in view"}`,
  )

  // A fragment naming a page with no element of that id opens the page at its top, as its route
  // does, rather than keeping the scroll of the page it replaced.
  await devtools.evaluate(`(scrollTo({ top: 1500, behavior: "instant" }), null)`)
  await settledScroll(devtools)
  const from = await devtools.evaluate<number>("Math.round(scrollY)")
  await devtools.evaluate(`(location.hash = "#theme", null)`)
  await poll(
    () =>
      devtools.evaluate<boolean>(`document.querySelector('[data-guide-page="theme"]') !== null`),
    3_000,
  )
  await settledScroll(devtools)
  const theme = await devtools.evaluate<{ page: string; top: number }>(`({
    page: document.querySelector("[data-guide-page]")?.dataset.guidePage ?? "",
    top: Math.round(scrollY),
  })`)
  check(
    "a fragment naming a page opens that page at its top",
    from > 0 && theme.page === "theme" && theme.top === 0,
    `#theme from scrollY ${from} → page "${theme.page}" at scrollY ${theme.top}`,
  )
}

/**
 * A page reloaded far down opens at its top. The server sends the longer `all` document, so a
 * position the browser restored would land somewhere unrelated, and late enough to override a later
 * scroll (#292's third review). Two things hold it, and either alone keeps this check green: the
 * host sets `history.scrollRestoration = "manual"`, and the guide scrolls on its first read.
 */
async function reloadAtTopCheck(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "system")
  await devtools.evaluate(`(scrollTo({ top: 8600, behavior: "instant" }), null)`)
  await settledScroll(devtools)
  const before = await devtools.evaluate<number>("scrollY")
  await devtools.send("Page.reload", { ignoreCache: true })
  await devtools.next("Page.loadEventFired")
  const hydrated = await poll(
    () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
    10_000,
  )
  await devtools.evaluate(`new Promise((done) => setTimeout(done, 1200))`)
  const after = await devtools.evaluate<number>("scrollY")
  check(
    "a page reloaded far down opens at its top, and stays there",
    hydrated && before > 1000 && after === 0,
    `#/system at scrollY ${before} → reloaded, 1.2s after hydration scrollY ${after}`,
  )
}

const SEARCH_BUTTON = `[data-e2e="ui-guide-search-open"]`
const SEARCH_DIALOG = `[data-e2e="ui-guide-search"]`

/**
 * The header's search: a click opens it with focus in the field, typing filters the results, the
 * arrow keys move the highlight, Enter opens the highlighted card's route and closes the dialog,
 * `/` opens it from the page, and Escape closes it with focus back on the button.
 */
async function searchChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "overview")
  const state = () =>
    devtools.evaluate<
      { open: boolean; focusInField: boolean; onButton: boolean; results: string[]; active: string }
    >(`(() => {
      const dialog = document.querySelector(${JSON.stringify(SEARCH_DIALOG)})
      const field = dialog?.querySelector('[role="combobox"]')
      const active = field?.getAttribute("aria-activedescendant")
      return {
        open: dialog?.open === true,
        focusInField: document.activeElement === field,
        onButton: document.activeElement === document.querySelector(${
      JSON.stringify(SEARCH_BUTTON)
    }),
        results: [...(dialog?.querySelectorAll('[role="option"]') ?? [])]
          .map((option) => option.querySelector("span span")?.textContent ?? ""),
        active: active ? document.getElementById(active)?.querySelector("span span")?.textContent ?? "" : "",
      }
    })()`)

  const clicked = await clickElement(devtools, SEARCH_BUTTON, { inPlace: true })
  const opened = await poll(async () => (await state()).focusInField, 2_000)
  await devtools.send("Input.insertText", { text: "LineChart" })
  await poll(async () => (await state()).results[0] === "LineChart", 2_000)
  const filtered = await state()
  await pressKey(devtools, "ArrowDown")
  const moved = await state()
  await pressKey(devtools, "ArrowUp")
  const back = await state()
  check(
    "the header's search opens with focus in its field, filters by name, and moves with the arrows",
    clicked && opened && filtered.results[0] === "LineChart" &&
      filtered.results.length > 1 && moved.active === filtered.results[1] &&
      back.active === "LineChart",
    `clicked ${clicked}, focus in the field ${opened}; results ${
      filtered.results.join(", ")
    }; ArrowDown → "${moved.active}", ArrowUp → "${back.active}"`,
  )

  await pressKey(devtools, "Enter")
  const landed = await poll(
    () =>
      devtools.evaluate<boolean>(
        `location.hash === "#/charts/line-chart" && ` +
          `document.getElementById("demo-LineChart")?.hasAttribute("data-deep-link") === true`,
      ),
    3_000,
  )
  const afterEnter = await state()
  check(
    "Enter on a search result opens its card's route and closes the search",
    landed && !afterEnter.open,
    `hash ${await devtools.evaluate<string>("location.hash")}, card marked ${landed}, ` +
      `dialog open ${afterEnter.open}`,
  )

  // `/` from the page, not from a field: the header's search button has focus after the close.
  await devtools.evaluate(`document.querySelector(${JSON.stringify(SEARCH_BUTTON)}).focus()`)
  await pressKey(devtools, "Slash")
  const slashOpened = await poll(async () => (await state()).focusInField, 2_000)
  const typed = await devtools.evaluate<string>(
    `document.querySelector(${JSON.stringify(SEARCH_DIALOG)} + ' [role="combobox"]')?.value ?? "?"`,
  )
  await pressKey(devtools, "Escape")
  await poll(async () => !(await state()).open, 2_000)
  const closed = await state()
  if (closed.open) {
    await devtools.evaluate(`document.querySelector(${JSON.stringify(SEARCH_DIALOG)}).close()`)
  }
  check(
    "/ opens the search from the page with an empty field, and Escape closes it onto its button",
    slashOpened && typed === "" && !closed.open && closed.onButton,
    `opened with focus in the field ${slashOpened}, field "${typed}", dialog open after Escape ${closed.open}, ` +
      `focus on the button ${closed.onButton}`,
  )
}

/**
 * The header's theme switch is named for what a press does, at a phone's width where it is an icon
 * alone and at a desktop's where it shows its words, and a press switches the palette and the name.
 * The palette and the stored preference are put back afterwards.
 */
async function themeSwitchCheck(devtools: Devtools, width: number): Promise<void> {
  await openGuidePage(devtools, "overview")
  const SWITCH = JSON.stringify(`[data-e2e="theme-toggle"]`)
  const result = await devtools.evaluate<
    {
      visible: boolean
      before: string
      text: string
      after: string
      dark: [boolean, boolean]
    }
  >(`(async () => {
    const root = document.documentElement
    let stored = null
    try { stored = localStorage.getItem("pc-theme") } catch {}
    const wasDark = root.classList.contains("dark")
    const button = document.querySelector(${SWITCH})
    const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)))
    if (wasDark) { button.click(); await frame() }
    const before = button.getAttribute("aria-label")
    const text = button.innerText.trim()
    const visible = button.checkVisibility()
    const lightDark = root.classList.contains("dark")
    button.click()
    await frame()
    const after = button.getAttribute("aria-label")
    const darkDark = root.classList.contains("dark")
    if (root.classList.contains("dark") !== wasDark) { button.click(); await frame() }
    try {
      if (stored === null) localStorage.removeItem("pc-theme")
      else localStorage.setItem("pc-theme", stored)
    } catch {}
    return { visible, before, text, after, dark: [lightDark, darkDark] }
  })()`)
  const wordsExpected = width >= 768 ? "Dark mode" : ""
  check(
    `at ${width}px the theme switch says what a press does, and a press does it`,
    result.visible && result.before === "Switch to dark mode" && result.text === wordsExpected &&
      result.dark[0] === false && result.dark[1] === true &&
      result.after === "Switch to light mode",
    `visible ${result.visible}; in light: name "${result.before}", words "${result.text}"; ` +
      `pressed → dark ${result.dark[1]}, name "${result.after}"`,
  )
}

/**
 * At a phone's width the drawer lists the page showing with its sections and cards, and its close
 * button closes it, putting focus back on the menu button.
 */
async function drawerContentCheck(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "charts")
  await clickElement(devtools, `[data-guide-page] h1`)
  await clickElement(devtools, MENU_BUTTON, { inPlace: true })
  const opened = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector(${JSON.stringify(MENU_DIALOG)})?.open === true`,
      ),
    2_000,
  )
  const listed = await devtools.evaluate<{ sections: number; cards: number; visible: boolean }>(
    `(() => {
      const dialog = document.querySelector(${JSON.stringify(MENU_DIALOG)})
      const cards = [...dialog.querySelectorAll('a[href^="#/charts/"], a[href^="#/charts-examples/"]')]
      return {
        sections: new Set([...dialog.querySelectorAll('a[href="#/charts"], a[href="#/charts-examples"]')]
          .map((link) => link.getAttribute("href"))).size,
        cards: cards.length,
        visible: cards.every((link) => link.checkVisibility()),
      }
    })()`,
  )
  await clickElement(devtools, `${MENU_DIALOG} button[aria-label]`)
  const closed = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector(${JSON.stringify(MENU_DIALOG)})?.open === false && ` +
          `document.activeElement === document.querySelector(${JSON.stringify(MENU_BUTTON)})`,
      ),
    2_000,
  )
  if (!closed) {
    await devtools.evaluate(`document.querySelector(${JSON.stringify(MENU_DIALOG)}).close()`)
  }
  const expected = guidePages.find((page) => page.id === "charts")?.sections
    .flatMap((section) => section.names).length ?? 0
  check(
    "the phone drawer lists the page's sections and cards, and its close button closes it",
    opened && listed.sections === 2 && listed.cards === expected && listed.visible && closed,
    `opened ${opened}; ${listed.sections} section links, ${listed.cards}/${expected} card ` +
      `links, all visible ${listed.visible}; closed with focus on the menu button ${closed}`,
  )
}

/**
 * At `xl` the "On this page" column marks the card in view, and follows the reader: scrolled so a
 * later card sits under the header, the mark moves to that card.
 */
async function onThisPageCheck(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "charts")
  const LIST = JSON.stringify(`[data-e2e="ui-guide-on-this-page"]`)
  const marked = () =>
    devtools.evaluate<string>(
      `document.querySelector(${LIST})?.querySelector('a[aria-current="location"]')?.textContent ?? ""`,
    )
  const visible = await devtools.evaluate<boolean>(
    `document.querySelector(${LIST})?.checkVisibility() === true`,
  )
  const first = guidePages.find((page) => page.id === "charts")?.sections[0].names[0] ?? ""
  const atTop = await poll(async () => (await marked()) === first, 3_000)
  const topMark = await marked()

  const target = "KpiGrid"
  const top = await devtools.evaluate<number>(`(() => {
    const card = document.getElementById("demo-${target}")
    const y = Math.round(card.getBoundingClientRect().top + scrollY - 72)
    scrollTo({ top: y, behavior: "instant" })
    return Math.round(scrollY)
  })()`)
  await settledScroll(devtools, { target: top })
  const followed = await poll(async () => (await marked()) === target, 3_000)
  const scrolledMark = await marked()
  await devtools.evaluate(`(scrollTo({ top: 0, behavior: "instant" }), null)`)
  check(
    "at xl the On this page list marks the card in view and follows the scroll",
    visible && atTop && followed,
    `list visible ${visible}; at the top "${topMark}" (expected ${first}), ` +
      `scrolled to ${target} → "${scrolledMark}"`,
  )
}

/**
 * The search's other ways in and out: `/` typed into a text field stays in that field, Ctrl+K opens
 * the search from anywhere, its close button closes it, and so does a click on the backdrop.
 */
async function searchShortcutChecks(devtools: Devtools): Promise<void> {
  const FIELD = `input[name="icon-search"]`
  const isOpen = () =>
    devtools.evaluate<boolean>(
      `document.querySelector(${JSON.stringify(SEARCH_DIALOG)})?.open === true`,
    )
  const closeIfOpen = async () => {
    if (await isOpen()) {
      await devtools.evaluate(`document.querySelector(${JSON.stringify(SEARCH_DIALOG)}).close()`)
    }
  }

  await openGuidePage(devtools, "icons")
  const aimed = await clickElement(devtools, FIELD)
  await pressKey(devtools, "Slash")
  // A wrong open would move focus into the dialog; give it the frame it would take.
  await devtools.evaluate(
    `new Promise((done) => requestAnimationFrame(() => setTimeout(done, 50)))`,
  )
  const inField = await devtools.evaluate<{ value: string; focused: boolean }>(`(() => {
    const field = document.querySelector(${JSON.stringify(FIELD)})
    return { value: field?.value ?? "", focused: document.activeElement === field }
  })()`)
  const openedFromField = await isOpen()
  await closeIfOpen()
  await devtools.evaluate(`(() => {
    const field = document.querySelector(${JSON.stringify(FIELD)})
    field.value = ""
    field.dispatchEvent(new Event("input", { bubbles: true }))
  })()`)
  check(
    "/ typed into a text field stays in the field and does not open the search",
    aimed && inField.value === "/" && inField.focused && !openedFromField,
    `clicked the icon search ${aimed}; its value "${inField.value}", focused ${inField.focused}; ` +
      `search opened ${openedFromField}`,
  )

  await clickElement(devtools, `[data-guide-page] h1`)
  for (const type of ["keyDown", "keyUp"]) {
    await devtools.send("Input.dispatchKeyEvent", {
      type,
      key: "k",
      code: "KeyK",
      windowsVirtualKeyCode: 75,
      nativeVirtualKeyCode: 75,
      modifiers: 2,
    })
  }
  const byShortcut = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.activeElement === document.querySelector(${
          JSON.stringify(`${SEARCH_DIALOG} [role="combobox"]`)
        })`,
      ),
    2_000,
  )
  const closer = await clickElement(devtools, `[data-e2e="ui-guide-search-close"]`, {
    inPlace: true,
  })
  const closedByButton = await poll(async () => !(await isOpen()), 2_000)
  await closeIfOpen()
  check(
    "Ctrl+K opens the search with focus in its field, and its close button closes it",
    byShortcut && closer && closedByButton,
    `opened by Ctrl+K ${byShortcut}; close button clicked ${closer}, closed ${closedByButton}`,
  )

  // ⌘K, the same shortcut on a Mac: the Meta modifier (4) instead of Control (2).
  await clickElement(devtools, `[data-guide-page] h1`)
  for (const type of ["keyDown", "keyUp"]) {
    await devtools.send("Input.dispatchKeyEvent", {
      type,
      key: "k",
      code: "KeyK",
      windowsVirtualKeyCode: 75,
      nativeVirtualKeyCode: 75,
      modifiers: 4,
    })
  }
  const byMeta = await poll(isOpen, 2_000)
  await closeIfOpen()
  check("⌘K opens the search as well", byMeta, `opened by ⌘K ${byMeta}`)

  await clickElement(devtools, SEARCH_BUTTON, { inPlace: true })
  const reopened = await poll(isOpen, 2_000)
  // Outside the dialog's box: its left margin, near the bottom of the viewport.
  const point = await devtools.evaluate<{ x: number; y: number; outside: boolean }>(`(() => {
    const box = document.querySelector(${JSON.stringify(SEARCH_DIALOG)}).getBoundingClientRect()
    const x = 8, y = innerHeight - 8
    return { x, y, outside: x < box.left || y > box.bottom }
  })()`)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    })
  }
  const closedByBackdrop = await poll(async () => !(await isOpen()), 2_000)
  await closeIfOpen()
  check(
    "a click on the backdrop closes the search",
    reopened && point.outside && closedByBackdrop,
    `opened ${reopened}; clicked (${point.x}, ${point.y}), outside the dialog ${point.outside}; ` +
      `closed ${closedByBackdrop}`,
  )
}
