import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { stepRowCursor } from "./row-cursor.ts"

describe("stepRowCursor", () => {
  it("lands on the first row from no row, for j and for k", () => {
    expect(stepRowCursor(-1, 1, 3)).toBe(0)
    expect(stepRowCursor(-1, -1, 3)).toBe(0)
  })

  it("moves one row down for j and one up for k", () => {
    expect(stepRowCursor(0, 1, 3)).toBe(1)
    expect(stepRowCursor(2, -1, 3)).toBe(1)
  })

  it("stops at the last row and at the first", () => {
    expect(stepRowCursor(2, 1, 3)).toBe(2)
    expect(stepRowCursor(0, -1, 3)).toBe(0)
  })

  it("lands on no row in an empty list", () => {
    expect(stepRowCursor(-1, 1, 0)).toBe(-1)
    expect(stepRowCursor(4, -1, 0)).toBe(-1)
  })

  it("counts from the new last row when the list shrank under the cursor", () => {
    expect(stepRowCursor(5, -1, 3)).toBe(1)
    expect(stepRowCursor(5, 1, 3)).toBe(2)
  })
})
