import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { inlineStep } from "./direction.ts"

describe("inlineStep", () => {
  it("steps Right toward the end of a left-to-right line and Left toward its start", () => {
    expect(inlineStep("ArrowRight", false)).toBe(1)
    expect(inlineStep("ArrowLeft", false)).toBe(-1)
  })

  it("steps Left toward the end of a right-to-left line and Right toward its start", () => {
    expect(inlineStep("ArrowLeft", true)).toBe(1)
    expect(inlineStep("ArrowRight", true)).toBe(-1)
  })

  it("does not step for any other key", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Home", "End", "a"]) {
      expect(inlineStep(key, false), key).toBe(0)
      expect(inlineStep(key, true), key).toBe(0)
    }
  })
})
