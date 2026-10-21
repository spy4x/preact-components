import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { changeText } from "./change.ts"

describe("changeText", () => {
  it("writes a rise with a plus sign and the period it compares with", () => {
    expect(changeText({ current: 12, previous: 9 }, "previous 7 days")).toBe(
      "+3 vs previous 7 days",
    )
  })

  it("writes a fall with a typographic minus and grouped digits", () => {
    expect(changeText({ current: 1040, previous: 2041 }, "yesterday")).toBe("−1,001 vs yesterday")
  })

  it("says there was no change when the two values are equal", () => {
    expect(changeText({ current: 5, previous: 5 }, "yesterday")).toBe("No change vs yesterday")
  })

  it("groups digits by the locale it is given", () => {
    expect(changeText({ current: 1500, previous: 0 }, "previous 30 days", "de-DE")).toBe(
      "+1.500 vs previous 30 days",
    )
  })
})
