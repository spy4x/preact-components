import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { join } from "./join.ts"

describe("join", () => {
  it("joins class names in order", () => {
    expect(join("p-2", "text-sm")).toBe("p-2 text-sm")
  })

  it("drops false, null, undefined and empty inputs", () => {
    expect(join("p-2", false, null, undefined, "", "text-sm")).toBe("p-2 text-sm")
  })

  it("keeps both of two conflicting utilities, in order", () => {
    expect(join("p-2", "p-4")).toBe("p-2 p-4")
  })

  it("returns an empty string when nothing survives", () => {
    expect(join(false, null, undefined)).toBe("")
  })
})
