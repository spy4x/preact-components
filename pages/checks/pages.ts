import { centreInView, check, type Devtools, poll, settledScroll } from "./harness.ts"
import { PAGE_TITLE } from "../src/site.ts"

/**
 * `pages/`'s own browser checks: the hash-routing grammar the host page's island wires up — the
 * canonical deep link, the legacy fragment, a section route, an unknown route keeping the page it
 * lands on — and the deep-link outline rule that depends on it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function pagesChecks(devtools: Devtools): Promise<void> {
  // The deep link, driven in the canonical form the navigation now writes: `#/inputs/toggle-switch`,
  // not the `#toggle-switch` this page shipped before hash routing. The hashchange listener is what
  // turns that hash into a mark, a scroll and a title, so removing the listener reds this check —
  // which is what makes it a detection rather than a restatement of the markup.
  //
  // The check polls for the state it asserts rather than reading it after a fixed wait: an 800ms
  // wait failed once under `--cpu-throttle=4` (#466). The page starts at its top, so `scrolled`
  // can only come from this route's own scroll, and the scroll is waited out before the next step.
  await devtools.evaluate<null>(`(window.scrollTo({ top: 0, behavior: "instant" }), null)`)
  await devtools.evaluate<null>(`(location.hash = "#/inputs/toggle-switch", null)`)
  const DEEP_LINK_DEADLINE_MS = 10_000
  let deepLink = { marked: false, current: "", title: "", scrolled: false }
  const deepLinkShown = await poll(async () => {
    deepLink = await devtools.evaluate<typeof deepLink>(`(() => ({
      marked: document.querySelector("#demo-ToggleSwitch").hasAttribute("data-deep-link"),
      current: document.querySelector('a[aria-current="true"]')?.textContent ?? "",
      title: document.title,
      scrolled: document.documentElement.scrollTop > 0,
    }))()`)
    return deepLink.marked && deepLink.scrolled && deepLink.current === "ToggleSwitch" &&
      deepLink.title.startsWith("ToggleSwitch")
  }, DEEP_LINK_DEADLINE_MS)
  check(
    "a deep link marks, scrolls to and titles its demo",
    deepLinkShown,
    `#/inputs/toggle-switch → ${deepLink.title}; marked ${deepLink.marked}, scrolled ` +
      `${deepLink.scrolled}, current "${deepLink.current}"`,
  )
  await settledScroll(devtools, { from: 0 })

  // The rest of the grammar, driven the way a reader drives it: the legacy bare fragment this page
  // shipped before hash routing and still resolves, a section route, and an unknown route falling
  // back to the landing page. The resolver's own unit tests cannot prove the island wired any of it.
  //
  // Every step below polls for the state it asserts, like the deep link above, instead of reading
  // the page a fixed 400ms after the hash changes: delaying the route by 1.5s made those fixed reads
  // fail (#501). A poll only proves something when the page starts somewhere else, so each step
  // starts from a state its own route has to change: the legacy fragment from an unknown route,
  // which clears the mark the deep link above left on the same card.
  const ROUTE_DEADLINE_MS = 5_000
  const routeState = () =>
    devtools.evaluate<{ marked: number; current: string; title: string; page: string }>(`({
      marked: document.querySelectorAll("[data-deep-link]").length,
      current: document.querySelector('a[aria-current="true"]')?.textContent ?? "",
      title: document.title,
      page: document.querySelector("[data-guide-page]")?.dataset.guidePage ?? "",
    })`)
  await devtools.evaluate<null>(`(location.hash = "#/nonsense", null)`)
  const clearedBeforeLegacy = await poll(
    async () => (await routeState()).marked === 0,
    ROUTE_DEADLINE_MS,
  )
  await devtools.evaluate<null>(`(location.hash = "#toggle-switch", null)`)
  let legacyState = await routeState()
  await poll(async () => {
    legacyState = await routeState()
    return legacyState.marked === 1 && legacyState.current === "ToggleSwitch" &&
      legacyState.title.startsWith("ToggleSwitch")
  }, ROUTE_DEADLINE_MS)
  const legacy = {
    legacyMarked: clearedBeforeLegacy &&
      await devtools.evaluate<boolean>(
        `document.querySelector("#demo-ToggleSwitch").hasAttribute("data-deep-link")`,
      ),
    legacyCurrent: legacyState.current,
    legacyTitle: legacyState.title,
  }

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
    return section.sectionTop >= 0 && section.sectionTop < 200 && section.sectionMarked === 0 &&
      section.sectionTitle.startsWith("Inputs")
  }, SECTION_SCROLL_DEADLINE_MS)

  // Mark a card again before the unknown route, so the assertion below is a *transition* — the mark
  // has to be there first and gone after — and not something a host with no listener at all would
  // satisfy by never marking anything.
  await devtools.evaluate<null>(`(location.hash = "#/inputs/toggle-switch", null)`)
  await poll(async () => (await routeState()).marked === 1, ROUTE_DEADLINE_MS)
  const markedBeforeUnknown = (await routeState()).marked

  await devtools.evaluate<null>(`(location.hash = "#/nonsense", null)`)
  let unknown = await routeState()
  await poll(async () => {
    unknown = await routeState()
    return unknown.marked === 0 && unknown.current === "" && unknown.page === "ui" &&
      unknown.title === `UI — ${PAGE_TITLE}`
  }, ROUTE_DEADLINE_MS)
  const rest = {
    markedBeforeUnknown,
    unknownMarked: unknown.marked,
    unknownTitle: unknown.title,
    unknownChipCurrent: unknown.current,
    unknownPage: unknown.page,
  }

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
  // A hash that names no route is not the guide's: an in-page link on a card (`#inputs`, `#crud`)
  // sets one, so the page it points into has to stay. The title follows the page, not the card.
  check(
    "an unknown route keeps the page showing, titles it, and clears the mark",
    routes.markedBeforeUnknown === 1 && routes.unknownMarked === 0 &&
      routes.unknownChipCurrent === "" && routes.unknownPage === "ui" &&
      routes.unknownTitle === `UI — ${PAGE_TITLE}`,
    `#/nonsense → page "${routes.unknownPage}", "${routes.unknownTitle}", ` +
      `${routes.markedBeforeUnknown} marked before → ${routes.unknownMarked} after`,
  )

  // This check used to share one `evaluate` call with `theme.ts`'s Tailwind/`tokens.css` checks —
  // both needed the canonical route as the last hash, so the original code set it once and read
  // everything off that one settled page. Splitting the checks across files splits that call too:
  // this is the routing half, so it sets the hash itself rather than trusting a file it does not
  // import to have left it there. `routes` above already ends on `#/nonsense`, which clears every
  // mark, so this also re-proves the canonical route marks a card again after that.
  await devtools.evaluate<null>(`(location.hash = "#/inputs/toggle-switch", null)`)
  const readOutline = () =>
    devtools.evaluate<string>(
      `getComputedStyle(document.querySelector("#demo-ToggleSwitch")).outlineWidth`,
    )
  const outline = { outline: await readOutline() }
  await poll(async () => (outline.outline = await readOutline()) === "2px", ROUTE_DEADLINE_MS)
  check(
    "the deep link outlines its card",
    outline.outline === "2px",
    `outline-width ${outline.outline} from styles.css, with the canonical route as the last hash`,
  )

  // Every aim in `checks/ui.ts` and `checks/map.ts` starts with `centreInView`, which works out
  // where the page's own smooth scroll will stop and waits for the page to get there (#269). Proven
  // here, on this page and its scrollbar, because a target that was a few pixels out would not fail
  // any of those checks: the wait would run out its budget, return `false` to callers that do not
  // read it, and let them aim at a page that had stopped anyway — a full run measured every call
  // doing exactly that, 8px short, before the viewport height excluded the horizontal scrollbar.
  // The page is sent to the top first, so the scroll is a long one and still running when the
  // first reads arrive.
  const CONTACT = `#demo-EnhancedForm [data-e2e="contact-form"]`
  const AIM = `document.querySelector('${CONTACT} form button[type="submit"]')`
  await devtools.evaluate<null>(`(globalThis.scrollTo({ top: 0, behavior: "instant" }), null)`)
  const centreStarted = Date.now()
  const centred = await centreInView(devtools, AIM)
  const centreMs = Date.now() - centreStarted
  const placed = await devtools.evaluate<{ found: boolean; offset: number; scrollY: number }>(
    `(() => {
      const element = ${AIM}
      if (element === null) return { found: false, offset: Number.NaN, scrollY: -1 }
      const box = element.getBoundingClientRect()
      return {
        found: true,
        offset: Math.round(box.top + box.height / 2 - document.documentElement.clientHeight / 2),
        scrollY: Math.round(globalThis.scrollY),
      }
    })()`,
  )
  check(
    "centreInView settles on the target it worked out, with the element in the middle",
    centred && placed.found && Math.abs(placed.offset) <= 1 && placed.scrollY > 0,
    !placed.found
      ? "the EnhancedForm card has no contact-form submit button to centre"
      : `${centred ? "settled" : "did not settle on its target"} after ${centreMs}ms, at ` +
        `scrollY ${placed.scrollY}, with the button's centre ${placed.offset}px from the middle`,
  )

  await llmsTxtChecks(devtools)
}

/**
 * The generated `llms.txt` and `llms-full.txt` are served at the site root, next to the page: the
 * build copies both from the repository root, and a static host serves a file it holds. Each is
 * fetched by its address relative to the page, so the check follows whatever base the site is
 * built for. The catalogue's `index.html` also answers a wrong path with a 200 on some hosts, so
 * the body is checked too: the header's first line, and a package section (`llms.txt`) or the
 * package README (`llms-full.txt`).
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function llmsTxtChecks(devtools: Devtools): Promise<void> {
  const served = await devtools.evaluate<
    Record<string, { status: number; type: string; text: string }>
  >(
    `(async () => {
      const read = async (name) => {
        const response = await fetch(new URL(name, document.baseURI))
        return {
          status: response.status,
          type: response.headers.get("content-type") ?? "",
          text: await response.text(),
        }
      }
      return { llms: await read("llms.txt"), full: await read("llms-full.txt") }
    })()`,
  )
  const llms = served.llms
  const full = served.full
  check(
    "the site serves llms.txt at its root, as plain text listing the packages' exports",
    llms.status === 200 && llms.type.startsWith("text/plain") &&
      llms.text.startsWith("# preact-components") &&
      llms.text.includes("## @spy4x/preact-ui") && llms.text.includes("`Badge` (component)"),
    `${llms.status} ${llms.type}, ${llms.text.length} characters`,
  )
  check(
    "the site serves llms-full.txt at its root, with the package READMEs after the header",
    full.status === 200 && full.type.startsWith("text/plain") &&
      full.text.startsWith("# preact-components") && full.text.includes("## Components") &&
      full.text.length > llms.text.length,
    `${full.status} ${full.type}, ${full.text.length} characters`,
  )
}
