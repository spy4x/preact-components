import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { scrollFade } from "./scroll-fade.ts"

describe("scrollFade", () => {
  it("fades nothing when the row fits, sub-pixel rounding included", () => {
    expect(scrollFade(0, 0, false)).toBe(undefined)
    expect(scrollFade(0, 0.5, false)).toBe(undefined)
  })

  it("fades the right edge of a left-to-right row at its start and the left edge at its end", () => {
    expect(scrollFade(0, 200, false)).toBe("right")
    expect(scrollFade(80, 200, false)).toBe("both")
    expect(scrollFade(200, 200, false)).toBe("left")
  })

  it("fades the left edge of a right-to-left row at its start and the right edge at its end", () => {
    expect(scrollFade(0, 200, true)).toBe("left")
    expect(scrollFade(-80, 200, true)).toBe("both")
    expect(scrollFade(-200, 200, true)).toBe("right")
  })
})
