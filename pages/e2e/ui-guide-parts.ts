/**
 * Which parts of a guide page the contrast scans of `ui-guide.spec.ts` split it into, and the keys
 * their known counts use. Kept apart from the spec so `page-parts.test.ts` can hold the parts to the
 * pages the guide draws without loading Playwright.
 *
 * @module
 */
import type { GuidePageId } from "@spy4x/preact-ui-guide/registry"
import type { PagePart } from "./page-parts.ts"

/** The rule every page's scan is split on: it takes about half the time of the whole scan. */
export const CONTRAST = "color-contrast"

/** Text partly covered by another element: axe cannot see the colour under the covered part. */
export const OBSCURED = "color-contrast: elmPartiallyObscured"
/** Text with another element over it. */
export const OVERLAPPED = "color-contrast: bgOverlap"
/** Text too short for axe to be sure it is text, which it leaves undecided when it reads low. */
export const SHORT = "color-contrast: shortTextContent"
/** A glyph drawn as a character outside the basic plane, which axe does not read as text. */
export const GLYPH = "color-contrast: nonBmp"

/**
 * Pages whose contrast scan is split by part of the page, one spec per part and one for the rest of
 * the page (`page-parts.ts`). The ui page's contrast scan, the slowest of its shares, took 34 to
 * 39 seconds beside three other specs at a fourfold CPU throttle, and 55 to 58 beside seven (two
 * shard lanes at once), past a spec's 60 seconds once the page's load is added. Each part below
 * took 13 to 19 seconds there. `known` is each part's share of the page's counts in
 * `KNOWN_VIOLATIONS` and `KNOWN_INCOMPLETE`; the rest of the page keeps what is left, so the totals
 * stay those tables' own. `region` cannot be split this way: axe runs it only on a whole page.
 */
export const CONTRAST_PARTS: Partial<Record<GuidePageId, readonly PagePart[]>> = {
  ui: [
    {
      what: "the display cards before LookGrid",
      cards: { section: "display", before: "LookGrid" },
      // `MoneyDisplay`'s negative amount.
      known: { [CONTRAST]: [1, 0] },
    },
    {
      what: "the display cards from LookGrid on",
      cards: { section: "display", from: "LookGrid" },
      // The install command in its scroll region, the scroll-snap row's three captions, and the
      // `Kbd` keys.
      known: { [OBSCURED]: [4, 4], [GLYPH]: [6, 6], [SHORT]: [1, 1] },
    },
    {
      what: "the inputs and fields sections",
      sections: ["inputs", "fields"],
      // The disabled `FileInput` zone's lines, and the three disclosure chevrons.
      known: { [CONTRAST]: [2, 1], [GLYPH]: [3, 3] },
    },
    { what: "the feedback and billing sections", sections: ["feedback", "billing"] },
  ],
}
