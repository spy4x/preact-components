import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { matchLines, wordBoundaryPattern } from "./private-names.ts"

describe("matchLines", () => {
  it("finds a name that is the whole line", () => {
    expect(matchLines("acmecorp", ["acmecorp"])).toEqual([1])
  })

  it("finds a name inside a longer line", () => {
    expect(matchLines("Ported from acmecorp's helpers.", ["acmecorp"])).toEqual([1])
  })

  it("reports every matching line, by 1-based number", () => {
    const text = ["one", "from acmecorp", "two", "acmecorp again"].join("\n")
    expect(matchLines(text, ["acmecorp"])).toEqual([2, 4])
  })

  it("does not match a name that is only a substring of a longer word", () => {
    expect(matchLines("locale: widgetcorp", ["gb"])).toEqual([])
    expect(matchLines("640 megabytes", ["gb"])).toEqual([])
  })

  it("is case-sensitive, so an unrelated all-caps token does not match", () => {
    // The real false positive this avoids: a short lowercase name like "gb" would also match
    // inside an all-caps locale code such as "en-GB" if the search ignored case. Every private
    // name in this repository was written lowercase, so matching case-sensitively finds the same
    // real occurrences while skipping that class of false positive.
    expect(matchLines("toLocaleDateString('en-GB')", ["gb"])).toEqual([])
    expect(matchLines("the gb helpers", ["gb"])).toEqual([1])
  })

  it("matches a hyphenated name as one whole word", () => {
    expect(matchLines("extracted from widget-tracker", ["widget-tracker"])).toEqual([1])
  })

  it("does not match a name glued to more letters on either side", () => {
    // A hyphen is itself a word boundary, so "widget-tracker" still matches inside
    // "widget-tracker-labs" — the boundary sits at the second hyphen. What it must not do is match
    // inside a longer run of letters with no boundary at all, such as a plural with no separator.
    expect(matchLines("extracted from widget-trackers", ["widget-tracker"])).toEqual([])
  })

  it("matches any name out of several", () => {
    const text = ["from acmecorp", "from widgetco", "from neither"].join("\n")
    expect(matchLines(text, ["acmecorp", "widgetco"])).toEqual([1, 2])
  })

  it("finds nothing when the file contains none of the names", () => {
    expect(matchLines("nothing private here", ["acmecorp", "widgetco"])).toEqual([])
  })

  it("finds nothing for an empty name list, without throwing", () => {
    expect(matchLines("acmecorp", [])).toEqual([])
  })

  it("treats regex metacharacters in a name literally", () => {
    // A name containing regex-special characters must not be interpreted as a pattern.
    expect(matchLines("see widget.io for details", ["widget.io"])).toEqual([1])
    expect(matchLines("see widgetXio for details", ["widget.io"])).toEqual([])
  })
})

describe("wordBoundaryPattern", () => {
  it("requires a word boundary on both sides", () => {
    const pattern = wordBoundaryPattern(["gb"])
    expect(pattern.test("megabytes")).toBe(false)
    expect(pattern.test("gb")).toBe(true)
    expect(pattern.test("the gb helpers")).toBe(true)
  })

  it("is case-sensitive", () => {
    const pattern = wordBoundaryPattern(["Acme"])
    expect(pattern.test("Acme corp")).toBe(true)
    expect(pattern.test("acme corp")).toBe(false)
  })
})
