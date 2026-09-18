import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { cn } from "./cn.ts"

describe("cn", () => {
  it("joins plain class names in order", () => {
    expect(cn("p-2", "text-sm")).toBe("p-2 text-sm")
  })

  it("drops false, null and undefined inputs", () => {
    expect(cn("p-2", false, null, undefined, "text-sm")).toBe("p-2 text-sm")
  })

  it("keeps a conditionally included class", () => {
    const isActive = true
    const isDisabled = false
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active")
  })

  it("keeps utilities from different groups", () => {
    expect(cn("p-2", "m-4", "text-sm")).toBe("p-2 m-4 text-sm")
  })

  it("lets a later conflicting spacing utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })

  it("lets a later conflicting colour win", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("lets a caller override beat the default it was merged into", () => {
    expect(cn("px-2 py-1 rounded", "px-4")).toBe("py-1 rounded px-4")
  })

  it("returns an empty string when nothing survives", () => {
    expect(cn(false, null, undefined)).toBe("")
  })
})
