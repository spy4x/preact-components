/**
 * The pure decisions behind the interactive demos in this directory.
 *
 * The guide's own suite renders markup with `preact-render-to-string` and this repository has no DOM
 * harness, so nothing here clicks, types or hovers. What *can* be asserted is the decision each
 * browser-only interaction turns on: which values a caller ends up holding after a port fires, and
 * whether a draft range is committable. Those are the parts the cards print, so a card whose helper
 * is wrong would be caught here rather than described as verified.
 *
 * Every expectation is bidirectional with the component it describes, and that is the property worth
 * checking when reading this file. There are two ways a test like this goes blind, and the first
 * revision of it had both:
 *
 * 1. **A helper that reimplements the component's rule** — the test then measures the copy and stays
 *    green while the component changes underneath it. `dateRangeTouched` delegates to the
 *    picker's own `isValidDateRange` for that reason.
 * 2. **A literal pinned to the wrong answer** — the test agrees with the copy and disagrees with the
 *    component. A card that printed `full` where the component resolved `100`, with an expectation
 *    that had baked in `full`, is the case that caught it.
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
import { comboboxStatusLabel, dateRangeTouched, dateTimeRangeTouched } from "./inputs.tsx"

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

describe("dateTimeRangeTouched", () => {
  it("reports an ordered timed range as its two ends", () => {
    expect(dateTimeRangeTouched({ from: "2026-02-09T14:00", to: "2026-02-09T18:00" })).toBe(
      "2026-02-09T14:00 → 2026-02-09T18:00",
    )
  })

  it("reports a range whose ends read the same minute, the ambiguous-hour case", () => {
    // `withTime`'s own edge case: `rangeForTimePreset`'s `"last-hour"` can answer a from and a to
    // that print the identical minute on the day a zone falls back, and `isValidDateTimeRange`
    // still accepts the pair — see `date-range.ts`'s own note on `DateTimeRange`.
    expect(dateTimeRangeTouched({ from: "2026-10-25T02:30", to: "2026-10-25T02:30" })).toBe(
      "2026-10-25T02:30 → 2026-10-25T02:30",
    )
  })

  it("refuses a reversed timed range", () => {
    expect(dateTimeRangeTouched({ from: "2026-02-09T18:00", to: "2026-02-09T14:00" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a half-filled timed range", () => {
    expect(dateTimeRangeTouched({ from: "2026-02-09T14:00", to: "" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })

  it("refuses a value with no time of day", () => {
    // Where this and `dateRangeTouched` part ways: a bare calendar date is exactly what the day
    // picker's Apply button accepts and this one's does not — `withTime`'s fields are always
    // `datetime-local`, so a value with no time never reaches this helper from the real component.
    expect(dateTimeRangeTouched({ from: "2026-02-09", to: "2026-02-09" })).toBe(
      "incomplete — Apply stays disabled",
    )
  })
})

describe("paginationNote", () => {
  it("lists a range short enough to render whole", () => {
    expect(paginationNote(1, 5)).toBe("1 2 3 4 5")
  })

  it("collapses the runs on either side of a long range", () => {
    // The two ends are always shown and the current page keeps two neighbours on each side, which
    // is the window `pageRange` centres on it.
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
