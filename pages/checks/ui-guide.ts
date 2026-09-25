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
 * dialog, which the page's scroll does not move.
 */
async function clickElement(devtools: Devtools, selector: string): Promise<boolean> {
  const aim = `document.querySelector(${JSON.stringify(selector)})`
  const inDialog = await devtools.evaluate<boolean>(`${aim}?.closest("dialog") != null`)
  if (inDialog) {
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
 * shows that page, marks its link current, renders its cards and no one else's, and titles the
 * document after it.
 */
async function navigationChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "overview")
  const crud = guidePages.find((page) => page.id === "crud")
  const crudCards = (crud?.sections ?? []).flatMap((section) => section.names)
    .map((name) => `demo-${name}`)

  const clicked = await clickElement(devtools, `${ASIDE_NAV} a[data-guide-page-link="crud"]`)
  await poll(
    () => devtools.evaluate<boolean>(`document.querySelector('[data-guide-page="crud"]') !== null`),
    3_000,
  )
  await settledScroll(devtools)
  const shown = await readShown(devtools, ASIDE_NAV)

  check(
    "a click in the side navigation shows that page, and only that page's cards",
    clicked && shown.page === "crud" && shown.current.join() === "CRUD" &&
      shown.cards.length === crudCards.length &&
      shown.cards.every((card) => crudCards.includes(card)) &&
      shown.title === `CRUD — ${PAGE_TITLE}`,
    `${clicked ? "clicked" : "could not click"} → page "${shown.page}", current ` +
      `${JSON.stringify(shown.current)}, ${shown.cards.length}/${crudCards.length} cards, ` +
      `title "${shown.title}"`,
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
}

/**
 * A deep link opened cold — the address typed or pasted, the page loaded fresh — lands on a card on
 * a page other than the overview: the island hydrates the overview the server sent, reads the
 * address, shows the card's page, and marks and scrolls to the card.
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
