import { check, type Devtools, poll } from "./harness.ts"
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
  const legacy = await devtools.evaluate<{
    legacyMarked: boolean
    legacyCurrent: string
    legacyTitle: string
  }>(
    `(async () => {
      const settle = () => new Promise((done) => setTimeout(done, 400))
      location.hash = "#toggle-switch"
      await settle()
      return {
        legacyMarked: document.querySelector("#demo-ToggleSwitch").hasAttribute("data-deep-link"),
        legacyCurrent: document.querySelector('a[aria-current="true"]')?.textContent ?? "",
        legacyTitle: document.title,
      }
    })()`,
  )

  // The section route's scroll used to be settled with the same fixed 400ms wait as every other step
  // here, and it once read the section's top edge at a fractional pixel in CI — `#225`. Waiting for
  // `scrollY` to stop changing (`settledScroll`) looked like the fix and, on its own measurements,
  // wasn't: a review of this file delayed the actual scroll by 600ms and caught `settledScroll`
  // returning after 428ms anyway, because *something else* — not the route's own scroll — had
  // stopped moving the page in that window, so the poll agreed with itself too early and this read
  // the pre-scroll position. Polling for the condition this check actually asserts — the section's
  // top inside the expected range — rather than a proxy for it (the scroll having stopped, for
  // whatever reason) is what a delayed scroll cannot fool the same way: it keeps reading until the
  // real thing happens or the deadline runs out, and it reports the raw value either way.
  //
  // Scrolling to the very top before setting the hash is a second, separate fix a later review
  // asked for: the legacy-fragment step just above already scrolled toward `#demo-ToggleSwitch`,
  // which sits only fractionally below where the Inputs section starts — so a section route whose
  // own scroll effect never fired at all would *still* read a top within a pixel or two of the
  // accepted range, not obviously wrong. Starting from the top of the page instead means a section
  // route that does nothing reads a top hundreds of pixels out of range, and one that works reads
  // the same settled position either way.
  await devtools.evaluate<null>(`(window.scrollTo({ top: 0, behavior: "instant" }), null)`)
  await devtools.evaluate<null>(`(location.hash = "#/inputs", null)`)
  const SECTION_SCROLL_DEADLINE_MS = 3_000
  let section = { sectionTopRaw: NaN, sectionTop: NaN, sectionMarked: -1, sectionTitle: "" }
  const sectionInRange = await poll(async () => {
    section = await devtools.evaluate<typeof section>(
      `(() => {
        const top = document.getElementById("inputs").getBoundingClientRect().top
        return {
          sectionTopRaw: top,
          sectionTop: Math.round(top),
          sectionMarked: document.querySelectorAll("[data-deep-link]").length,
          sectionTitle: document.title,
        }
      })()`,
    )
    return section.sectionTop >= 0 && section.sectionTop < 200
  }, SECTION_SCROLL_DEADLINE_MS)

  // Mark a card again before the unknown route, so the assertion below is a *transition* — the mark
  // has to be there first and gone after — and not something a host with no listener at all would
  // satisfy by never marking anything.
  const rest = await devtools.evaluate<{
    markedBeforeUnknown: number
    unknownMarked: number
    unknownTitle: string
    unknownChipCurrent: string
  }>(
    `(async () => {
      const settle = () => new Promise((done) => setTimeout(done, 400))
      const marked = () => document.querySelectorAll("[data-deep-link]").length
      const current = () => document.querySelector('a[aria-current="true"]')?.textContent ?? ""

      location.hash = "#/inputs/toggle-switch"
      await settle()
      const markedBeforeUnknown = marked()

      location.hash = "#/nonsense"
      await settle()

      return {
        markedBeforeUnknown,
        unknownMarked: marked(),
        unknownTitle: document.title,
        unknownChipCurrent: current(),
      }
    })()`,
  )

  const routes = { ...legacy, ...section, ...rest }
  check(
    "the legacy fragment still resolves to the same card",
    routes.legacyMarked && routes.legacyCurrent === "ToggleSwitch" &&
      routes.legacyTitle.startsWith("ToggleSwitch"),
    `#toggle-switch → ${routes.legacyTitle}, chip "${routes.legacyCurrent}"`,
  )
  check(
    "the section route scrolls to its section and clears the card's mark",
    sectionInRange && routes.sectionMarked === 0 && routes.sectionTitle.startsWith("Inputs"),
    `#/inputs → ${routes.sectionTitle}, section top ${routes.sectionTop}px ` +
      `(raw ${routes.sectionTopRaw.toFixed(3)}px), ${routes.sectionMarked} cards marked` +
      (sectionInRange
        ? ""
        : ` — never reached the expected range within ${SECTION_SCROLL_DEADLINE_MS}ms`),
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
