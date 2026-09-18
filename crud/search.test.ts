import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { filterRows, search, searchWords } from "./search.ts"

describe("searchWords", () => {
  it("splits on whitespace and drops the empties", () => {
    expect(searchWords("  north   gate ")).toEqual(["north", "gate"])
  })

  it("reads an empty box as no filter", () => {
    expect(searchWords("   ")).toEqual([])
  })
})

describe("search", () => {
  it("matches a string case-insensitively on a substring", () => {
    expect(search("North Gate", "gate")).toBe(true)
  })

  it("matches a number by equality, not by substring", () => {
    expect(search(12, "12")).toBe(true)
    expect(search(120, "12")).toBe(false)
  })

  it("matches nothing a row does not have", () => {
    expect(search(null, "12")).toBe(false)
    expect(search(undefined, "gate")).toBe(false)
    expect(search({ id: 1 }, "1")).toBe(false)
  })
})

describe("filterRows", () => {
  const rows = [{ name: "North Gate" }, { name: "South Gate" }, { name: "River" }]
  const match = (row: { name: string }, word: string) => search(row.name, word)

  it("returns the input array untouched for an empty query", () => {
    expect(filterRows(rows, "  ", match)).toBe(rows)
  })

  it("keeps the rows every word matches", () => {
    expect(filterRows(rows, "north gate", match).map((row) => row.name)).toEqual(["North Gate"])
  })

  it("drops the rows a later word excludes", () => {
    expect(filterRows(rows, "gate river", match)).toEqual([])
  })
})
