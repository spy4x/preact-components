/**
 * The pure decisions behind the interactive demos in this directory.
 *
 * The guide's own suite renders markup with `preact-render-to-string` and this repository has no DOM
 * harness, so nothing here clicks, types or hovers. What *can* be asserted is the decision each
 * browser-only interaction turns on: which values a caller ends up holding after a port fires, how
 * many placeholder cells a skeleton reserves, and whether a draft range is committable. Those are
 * the parts the cards print, so a card whose helper is wrong would be caught here rather than
 * described as verified.
 *
 * Every expectation is bidirectional with the component it describes, and that is the property worth
 * checking when reading this file. There are two ways a test like this goes blind, and the first
 * revision of it had both:
 *
 * 1. **A helper that reimplements the component's rule** — the test then measures the copy and stays
 *    green while the component changes underneath it. `skeletonWidthReport` delegates to
 *    `textGeometry` and `skeletonTableNote` to `tableGeometry` for that reason, and
 *    `dateRangeTouched` delegates to the picker's own `isValidDateRange`.
 * 2. **A literal pinned to the wrong answer** — the test agrees with the copy and disagrees with the
 *    component. The `["full", 70]` case below is the one that caught it: the card printed `full`
 *    where the component resolves `100`, and the expectation had baked in `full`.
 *
 * Neither shape is visible from inside this file; the defence is that every literal here is the
 * component's own output, which a mutation of that component flips.
 *
 * Nothing here reads the clock: every input is a literal, which is the same rule the cards follow
 * when they pass an injected `now` instead of letting the picker call `new Date()`.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { paginationNote } from "./display.tsx"
import { skeletonTableNote, skeletonWidthReport } from "./feedback.tsx"
import { comboboxStatusLabel, dateRangeTouched } from "./inputs.tsx"

describe("comboboxStatusLabel", () => {
  it("reports the selection while no query is typed", () => {
    expect(comboboxStatusLabel("BTC", "")).toBe("selected BTC")
  })

  it("reports the query alongside the selection", () => {
    // The pair is the whole contract of a controlled combobox: `value` in, `onQueryChange` out.
    expect(comboboxStatusLabel("BTC", "eth")).toBe('selected BTC · query "eth"')
  })

  it("reports a cleared selection as nothing selected", () => {
    expect(comboboxStatusLabel(null, "")).toBe("nothing selected")
  })

  it("keeps a query that is only whitespace out of the report", () => {
    // Trimmed for display only: the component matches on the raw string, and `fold` is what makes a
    // padded query behave — this helper must not imply otherwise.
    expect(comboboxStatusLabel(null, "   ")).toBe("nothing selected")
  })
})

describe("dateRangeTouched", () => {
  it("reports an ordered range as its two ends", () => {
    expect(dateRangeTouched({ from: "2026-02-09", to: "2026-02-15" })).toBe(
      "2026-02-09 → 2026-02-15",
    )
  })

  it("reports a single-day range as its two equal ends", () => {
    expect(dateRangeTouched({ from: "2026-02-15", to: "2026-02-15" })).toBe(
      "2026-02-15 → 2026-02-15",
    )
  })

  it("refuses a reversed range", () => {
    expect(dateRangeTouched({ from: "2026-03-31", to: "2026-03-01" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a half-filled range", () => {
    expect(dateRangeTouched({ from: "2026-03-01", to: "" })).toBe(
      "incomplete — Apply stays disabled",
    )
    expect(dateRangeTouched({ from: "", to: "2026-03-01" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a range the picker cannot parse", () => {
    // Where a raw string compare and the component's rule part ways, and why the helper delegates to
    // `isValidDateRange`: `"nonsense" <= "nonsense"` is true, while `parseIsoDate` throws on both and
    // the picker's Apply button stays disabled. Asserted against the input the probe used, so a
    // helper that goes back to comparing strings fails here.
    expect(dateRangeTouched({ from: "nonsense", to: "nonsense" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a padded month a string compare would accept", () => {
    // `"2026-2-15" <= "2026-9-01"` is true lexically and the range is genuinely ordered, but the
    // panel's Apply gate is `parseIsoDate`, which rejects the unpadded month outright.
    expect(dateRangeTouched({ from: "2026-2-15", to: "2026-9-01" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a date the calendar does not have", () => {
    // `parseIsoDate` round-trips through `formatIsoDate` rather than trusting `Date.parse`, because
    // `Date.parse("2026-02-31")` rolls into March and would look like a valid ordered range.
    expect(dateRangeTouched({ from: "2026-02-31", to: "2026-03-01" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })
})

describe("skeletonWidthReport", () => {
  it("reports three full lines when no widths were given", () => {
    // `full` is what the card's copy says, and `100` is what the component resolves. The number is
    // the one that matters here: the string is a label, the percentage is the rendered width.
    expect(skeletonWidthReport(undefined)).toBe("100 / 100 / 100")
  })

  it("reports three full lines for an empty list, as `textGeometry` does", () => {
    // `[]` and `undefined` are one case in the component, and the card must not imply they differ.
    expect(skeletonWidthReport([])).toBe("100 / 100 / 100")
  })

  it("cycles a list shorter than the line count", () => {
    expect(skeletonWidthReport([90, 40])).toBe("90 / 40 / 90")
  })

  it("prints the keyword as the percentage the component resolves", () => {
    // The case that exposed the local copy: `linePercent("full")` is `100`, not the word. An earlier
    // helper of this file's own printed `full` here, and this expectation repeated it — two wrongs
    // agreeing. Delegating to `textGeometry` is what makes both the card and this line right.
    expect(skeletonWidthReport(["full", 70])).toBe("100 / 70 / 100")
  })

  it("clamps a percentage outside 0…100, as the component does", () => {
    // The floor and the ceiling of the same rule, taken from the component rather than restated.
    expect(skeletonWidthReport([140, -20])).toBe("100 / 0 / 100")
  })
})

describe("paginationNote", () => {
  it("lists a range short enough to render whole", () => {
    expect(paginationNote(1, 5)).toBe("1 2 3 4 5")
  })

  it("collapses the runs on either side of a long range", () => {
    // The two ends are always shown and the window keeps the current page mid-span, which is the
    // rule `pageRange` scores its candidates for.
    expect(paginationNote(12, 24)).toBe("1 … 10 11 12 13 14 … 24")
  })

  it("drops the leading mark when the window reaches the first page", () => {
    expect(paginationNote(1, 24)).toBe("1 2 3 4 5 … 24")
  })

  it("renders nothing for an empty result set", () => {
    // The same `pageCount` that makes `Pagination` itself render `null`.
    expect(paginationNote(1, 0)).toBe("nothing rendered")
  })

  it("clamps a page past the end into the range it renders", () => {
    expect(paginationNote(99, 5)).toBe("1 2 3 4 5")
  })
})

describe("skeletonTableNote", () => {
  it("counts the placeholder cells as rows times columns", () => {
    expect(skeletonTableNote(4, 3)).toBe("4 × 3 = 12 placeholder cells, each row 53px tall")
  })

  it("reserves no cells for a table with no columns", () => {
    expect(skeletonTableNote(1, 0)).toBe("1 × 0 = 0 placeholder cells, each row 53px tall")
  })

  it("floors a fractional row count rather than reserving half a row", () => {
    // The count comes from `tableGeometry`, so a change to the component's own rounding shows up
    // here instead of only on the card.
    expect(skeletonTableNote(2.7, 2)).toBe("2 × 2 = 4 placeholder cells, each row 53px tall")
  })
})
