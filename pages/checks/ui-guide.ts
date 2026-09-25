import { guidePages } from "@preact-components/ui-guide/registry"
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
  await copyBlockChecks(devtools)
  await withViewport(devtools, 1280, 800, () => navigationChecks(devtools))
  await withViewport(devtools, 375, 812, () => phoneNavigationChecks(devtools))
  await withViewport(devtools, 375, 812, () => overflowChecks(devtools))
  await coldDeepLinkCheck(devtools)
  await coldFragmentCheck(devtools)
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

  // Within the page showing, the navigation lists its cards; a click on one lands on it.
  const target = crudCards.at(-1) ?? ""
  const name = target.replace(/^demo-/, "")
  const linkClicked = await clickElement(
    devtools,
    `${ASIDE_NAV} a[href$="/${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}"]`,
  )
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
  // A real click on the bar's page title first: a page that has had no real input has no focus,
  // and then no focus or blur event fires for anything below (AGENTS.md, wave seven).
  await clickElement(devtools, `${MENU_BUTTON} + span`)
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
 * The text the shell itself sets — a card's heading and summary, a page's or a section's heading
 * and blurb — in the page showing. A card's live example is left out: it is the component's own
 * markup, not the shell's.
 */
const SHELL_TEXT = [
  `article[id^="demo-"] > h3`,
  `article[id^="demo-"] > p`,
  `[data-guide-page] header > *`,
  `section[id] > div:first-child:not(.sr-only) > *`,
].join(", ")

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
 */
const CLIPPED_AT_PHONE_WIDTH: Record<string, string> = {
  "demo-Tabs": "the tab row does not wrap or scroll",
  "demo-Pagination": "Previous and Next run past the row",
  "demo-Tooltip": "the hint bubbles are positioned past the edge",
  "demo-Map": "the `tileUrl` example does not wrap",
}

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
