import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { encodeHex } from "@std/encoding/hex"
import { buttonClassesJoined, type ButtonSize, type ButtonVariant } from "./button-classes.ts"
import { buttonClasses } from "./button.tsx"

const VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "icon",
  "danger",
  "danger-ghost",
]
const SIZES: Array<ButtonSize | "none"> = ["sm", "md", "lg", "none"]
/** No class, a class that conflicts with none, padding and box size and text size that do. */
const CALLER_CLASSES = [undefined, "mt-2", "px-8", "size-12 text-lg"]

/**
 * SHA-256 of `buttonClasses` for every variant, size and caller class above, one per line, as
 * `ui/button.tsx` composed them before the tables moved to `button-classes.ts` (#1367). Recompute it
 * only for a deliberate change to a button's look.
 */
const CLASSES_BEFORE_THE_MOVE = "74547b9c972c183c3472213bc4fc1b02e05c0083a8565eb5b8d5e4b13c99a8ba"

describe("buttonClasses", () => {
  it("composes every variant, size and caller class as it did before the move", async () => {
    const lines: string[] = []
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        for (const className of CALLER_CLASSES) {
          lines.push(buttonClasses(variant, size, className))
        }
      }
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(lines.join("\n")),
    )
    expect(lines.length).toBe(112)
    expect(encodeHex(digest)).toBe(CLASSES_BEFORE_THE_MOVE)
  })
})

describe("buttonClassesJoined", () => {
  it("gives the same classes as buttonClasses when the caller adds none", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(buttonClassesJoined(variant, size)).toBe(buttonClasses(variant, size))
      }
    }
  })

  it("defaults to the primary variant at the md size", () => {
    expect(buttonClassesJoined()).toBe(buttonClassesJoined("primary", "md"))
    expect(buttonClassesJoined().split(" ")).toEqual(
      expect.arrayContaining(["bg-accent-900", "px-3", "text-sm", "gap-2"]),
    )
  })

  it("gives the icon variant a square box instead of padding", () => {
    const classes = buttonClassesJoined("icon", "sm").split(" ")
    expect(classes).toContain("size-8")
    expect(classes).not.toContain("px-2")
  })

  it("adds no gap, padding, text size or box size at the none size", () => {
    for (const variant of ["primary", "icon"] as const) {
      const classes = buttonClassesJoined(variant, "none").split(" ")
      for (const absent of ["gap-2", "px-3", "py-2", "text-sm", "size-9"]) {
        expect(classes).not.toContain(absent)
      }
    }
  })

  it("appends a conflicting caller class instead of replacing the button's own", () => {
    const classes = buttonClassesJoined("primary", "md", "px-8").split(" ")
    expect(classes).toContain("px-3")
    expect(classes.at(-1)).toBe("px-8")
    expect(buttonClasses("primary", "md", "px-8").split(" ")).not.toContain("px-3")
  })

  it("leaves no trailing space when the caller adds no class", () => {
    expect(buttonClassesJoined("ghost", "sm")).not.toMatch(/\s$/)
  })
})
