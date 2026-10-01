import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { shiftIntoView } from "./hint-bubble.ts"

describe("shiftIntoView", () => {
  it("moves a box that starts past the left edge right, to 8px inside", () => {
    expect(shiftIntoView(-26, 52, 360)).toBe(34)
  })

  it("moves a box that ends past the right edge left, to 8px inside", () => {
    expect(shiftIntoView(300, 380, 360)).toBe(-28)
  })

  it("leaves a box that fits where it is", () => {
    expect(shiftIntoView(249, 327, 360)).toBe(0)
  })

  it("keeps the left edge in view when the box is wider than the viewport", () => {
    expect(shiftIntoView(20, 400, 300)).toBe(-12)
  })
})
