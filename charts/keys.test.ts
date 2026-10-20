import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { stepIndex } from "./keys.ts"

describe("stepIndex", () => {
  it("moves to the next item on ArrowDown and ArrowRight, stopping at the last", () => {
    expect(stepIndex("ArrowDown", 1, 4)).toBe(2)
    expect(stepIndex("ArrowRight", 1, 4)).toBe(2)
    expect(stepIndex("ArrowDown", 3, 4)).toBe(3)
    expect(stepIndex("ArrowDown", null, 4)).toBe(0)
  })

  it("moves to the previous item on ArrowUp and ArrowLeft, stopping at the first", () => {
    expect(stepIndex("ArrowUp", 2, 4)).toBe(1)
    expect(stepIndex("ArrowLeft", 2, 4)).toBe(1)
    expect(stepIndex("ArrowUp", 0, 4)).toBe(0)
    expect(stepIndex("ArrowUp", null, 4)).toBe(3)
  })

  it("jumps to the ends on Home and End, and clears on Escape", () => {
    expect(stepIndex("Home", 2, 4)).toBe(0)
    expect(stepIndex("End", 0, 4)).toBe(3)
    expect(stepIndex("Escape", 2, 4)).toBeNull()
  })

  it("ignores other keys, and every key when there is nothing to step through", () => {
    expect(stepIndex("Enter", 1, 4)).toBeUndefined()
    expect(stepIndex("ArrowDown", null, 0)).toBeUndefined()
  })
})
