import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { COACHMARK_GAP, placeCoachmark } from "./coachmark-place.ts"

const view = { width: 1000, height: 800 }
const target = { top: 300, left: 400, width: 100, height: 40 }

describe("placeCoachmark", () => {
  it("sits below the target, centred on it, one gap away", () => {
    expect(placeCoachmark("bottom", target, 200, 100, view)).toEqual({
      top: 340 + COACHMARK_GAP,
      left: 350,
      side: "bottom",
    })
  })

  it("sits on each side the app asks for", () => {
    expect(placeCoachmark("top", target, 200, 100, view)).toEqual({
      top: 300 - COACHMARK_GAP - 100,
      left: 350,
      side: "top",
    })
    expect(placeCoachmark("left", target, 200, 100, view)).toEqual({
      top: 270,
      left: 400 - COACHMARK_GAP - 200,
      side: "left",
    })
    expect(placeCoachmark("right", target, 200, 100, view)).toEqual({
      top: 270,
      left: 500 + COACHMARK_GAP,
      side: "right",
    })
  })

  it("flips to the opposite side when the asked side has no room", () => {
    const nearBottom = { ...target, top: 720 }
    expect(placeCoachmark("bottom", nearBottom, 200, 100, view)).toEqual({
      top: 720 - COACHMARK_GAP - 100,
      left: 350,
      side: "top",
    })
    const nearLeft = { ...target, left: 20 }
    expect(placeCoachmark("left", nearLeft, 200, 100, view).side).toBe("right")
  })

  it("stays on the asked side when neither side has room", () => {
    const tall = { top: 50, left: 400, width: 100, height: 700 }
    expect(placeCoachmark("bottom", tall, 200, 100, view).side).toBe("bottom")
  })

  it("shifts along the other axis to keep an 8 px gutter from the viewport edge", () => {
    const atLeftEdge = { ...target, left: 0 }
    expect(placeCoachmark("bottom", atLeftEdge, 200, 100, view).left).toBe(8)
    const atRightEdge = { ...target, left: 960, width: 40 }
    expect(placeCoachmark("top", atRightEdge, 200, 100, view).left).toBe(1000 - 8 - 200)
    const atTop = { ...target, top: 0 }
    expect(placeCoachmark("right", atTop, 200, 100, view).top).toBe(8)
  })

  it("rounds to whole pixels", () => {
    const odd = { top: 300.4, left: 400.3, width: 101, height: 40 }
    const { top, left } = placeCoachmark("bottom", odd, 200, 100, view)
    expect(Number.isInteger(top) && Number.isInteger(left)).toBe(true)
  })
})
