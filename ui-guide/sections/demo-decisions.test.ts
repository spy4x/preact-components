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
})

describe("skeletonWidthReport", () => {
  it("reports three full lines when no widths were given", () => {
    expect(skeletonWidthReport(undefined)).toBe("full / full / full")
  })

  it("reports three full lines for an empty list, as `textGeometry` does", () => {
    // `[]` and `undefined` are one case in the component, and the card must not imply they differ.
    expect(skeletonWidthReport([])).toBe("full / full / full")
  })

  it("cycles a list shorter than the line count", () => {
    expect(skeletonWidthReport([90, 40])).toBe("90 / 40 / 90")
  })

  it("prints the keyword and a percentage side by side", () => {
    expect(skeletonWidthReport(["full", 70])).toBe("full / 70 / full")
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
