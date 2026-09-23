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

  it("is case-insensitive, so a capitalised mention is still caught", () => {
    // The leak this check exists to stop: an application named mid-sentence, capitalised because
    // it starts a sentence or is written as a title, would slip past a case-sensitive search.
    expect(matchLines("Acmecorp shipped this component.", ["acmecorp"])).toEqual([1])
    expect(matchLines("built on ACMECORP's platform", ["acmecorp"])).toEqual([1])
  })

  it("does not match a short name inside an unrelated hyphenated token", () => {
    // The real false positive this avoids: a short name like "gb" must not match inside the
    // locale tag "en-GB" — a hyphen counts as part of a word here, not as a separator, so there is
    // no boundary between "-" and "GB".
    expect(matchLines("toLocaleDateString('en-GB')", ["gb"])).toEqual([])
  })

  it("matches a hyphenated name as one whole word", () => {
    expect(matchLines("extracted from widget-tracker", ["widget-tracker"])).toEqual([1])
  })

  it("does not match a name glued to more hyphenated text on either side", () => {
    // Because a hyphen counts as a word character, "widget-tracker" does not match inside
    // "widget-tracker-labs" — the same rule that excludes "en-GB" also excludes this.
    expect(matchLines("extracted from widget-tracker-labs", ["widget-tracker"])).toEqual([])
    expect(matchLines("extracted from acme-widget-tracker", ["widget-tracker"])).toEqual([])
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

  it("is case-insensitive", () => {
    const pattern = wordBoundaryPattern(["acme"])
    expect(pattern.test("Acme corp")).toBe(true)
    expect(pattern.test("acme corp")).toBe(true)
    expect(pattern.test("ACME corp")).toBe(true)
  })

  it("treats a hyphen as part of a word, not as a separator", () => {
    const pattern = wordBoundaryPattern(["gb"])
    // "-" sits right against "GB" on the left, so the boundary check must not treat it as a break.
    expect(pattern.test("en-GB")).toBe(false)

    const hyphenated = wordBoundaryPattern(["widget-tracker"])
    expect(hyphenated.test("used widget-tracker here")).toBe(true)
    expect(hyphenated.test("used widget-tracker-labs here")).toBe(false)
  })
})
