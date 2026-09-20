import { check, type Devtools } from "./harness.ts"
import { PAGE_TITLE } from "../src/site.ts"

/**
 * `pages/`'s own browser checks: the hash-routing grammar the host page's island wires up — the
 * canonical deep link, the legacy fragment, a section route, an unknown route falling back to the
 * landing page — and the deep-link outline rule that depends on it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function pagesChecks(devtools: Devtools): Promise<void> {
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

  // This check used to share one `evaluate` call with `theme.ts`'s Tailwind/`tokens.css` checks —
  // both needed the canonical route as the last hash, so the original code set it once and read
  // everything off that one settled page. Splitting the checks across files splits that call too:
  // this is the routing half, so it sets the hash itself rather than trusting a file it does not
  // import to have left it there. `routes` above already ends on `#/nonsense`, which clears every
  // mark, so this also re-proves the canonical route marks a card again after that.
  const outline = await devtools.evaluate<{ outline: string }>(`(async () => {
    location.hash = "#/inputs/toggle-switch"
    await new Promise((done) => setTimeout(done, 400))
    return {
      outline: getComputedStyle(document.querySelector("#demo-ToggleSwitch")).outlineWidth,
    }
  })()`)
  check(
    "the deep link outlines its card",
    outline.outline === "2px",
    `outline-width ${outline.outline} from styles.css, with the canonical route as the last hash`,
  )
}
