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
      centred: true,
    })
  })

  it("sits on each side the app asks for", () => {
    expect(placeCoachmark("top", target, 200, 100, view)).toEqual({
      top: 300 - COACHMARK_GAP - 100,
      left: 350,
      side: "top",
      centred: true,
    })
    expect(placeCoachmark("left", target, 200, 100, view)).toEqual({
      top: 270,
      left: 400 - COACHMARK_GAP - 200,
      side: "left",
      centred: true,
    })
    expect(placeCoachmark("right", target, 200, 100, view)).toEqual({
      top: 270,
      left: 500 + COACHMARK_GAP,
      side: "right",
      centred: true,
    })
  })

  it("flips to the opposite side when the asked side has no room", () => {
    const nearBottom = { ...target, top: 720 }
    expect(placeCoachmark("bottom", nearBottom, 200, 100, view)).toEqual({
      top: 720 - COACHMARK_GAP - 100,
      left: 350,
      side: "top",
      centred: true,
    })
    const nearLeft = { ...target, left: 20 }
    expect(placeCoachmark("left", nearLeft, 200, 100, view).side).toBe("right")
  })

  it("flips when the asked side has less room than the surface and its 8 px gutter", () => {
    // 104 px below the target: the surface and its gap fit, the gutter under it does not.
    const lowish = { ...target, top: 648 }
    expect(placeCoachmark("bottom", lowish, 200, 100, view).side).toBe("top")
    expect(placeCoachmark("bottom", { ...target, top: 644 }, 200, 100, view).side).toBe("bottom")
  })

  it("stays on the asked side, moved over the target into the viewport, when neither side has room", () => {
    const tall = { top: 50, left: 400, width: 100, height: 700 }
    expect(placeCoachmark("bottom", tall, 200, 100, view)).toEqual({
      top: 800 - 8 - 100,
      left: 350,
      side: "bottom",
      centred: false,
    })
    const wide = { top: 300, left: 50, width: 900, height: 40 }
    expect(placeCoachmark("left", wide, 200, 100, view)).toEqual({
      top: 270,
      left: 8,
      side: "left",
      centred: false,
    })
  })

  it("shifts along the other axis to keep an 8 px gutter from the viewport edge", () => {
    const atLeftEdge = { ...target, left: 0 }
    expect(placeCoachmark("bottom", atLeftEdge, 200, 100, view).left).toBe(8)
    const atRightEdge = { ...target, left: 960, width: 40 }
    expect(placeCoachmark("top", atRightEdge, 200, 100, view).left).toBe(1000 - 8 - 200)
    const atTop = { ...target, top: 0 }
    expect(placeCoachmark("right", atTop, 200, 100, view).top).toBe(8)
    const atBottom = { ...target, top: 760 }
    expect(placeCoachmark("left", atBottom, 200, 100, view).top).toBe(800 - 8 - 100)
  })

  it("keeps the whole surface inside the viewport beside a target in each corner, on every side", () => {
    for (const top of [4, 756]) {
      for (const left of [4, 896]) {
        for (const side of ["top", "right", "bottom", "left"] as const) {
          const spot = placeCoachmark(side, { top, left, width: 100, height: 40 }, 200, 100, view)
          const at = `${side} of ${left},${top}: ${spot.left},${spot.top}`
          expect(spot.left >= 8 && spot.left + 200 <= 992 ? "inside" : at).toBe("inside")
          expect(spot.top >= 8 && spot.top + 100 <= 792 ? "inside" : at).toBe("inside")
          expect(spot.centred).toBe(false)
        }
      }
    }
  })

  it("says the surface is centred only when it was not shifted", () => {
    expect(placeCoachmark("right", target, 200, 100, view).centred).toBe(true)
    expect(placeCoachmark("right", { ...target, top: 30 }, 200, 100, view).centred).toBe(false)
    // Flipped to the left, and centred there.
    const nearRight = { ...target, left: 850 }
    expect(placeCoachmark("right", nearRight, 200, 100, view)).toEqual({
      top: 270,
      left: 850 - COACHMARK_GAP - 200,
      side: "left",
      centred: true,
    })
  })

  it("rounds to whole pixels", () => {
    const odd = { top: 300.4, left: 400.3, width: 101, height: 40 }
    const { top, left } = placeCoachmark("bottom", odd, 200, 100, view)
    expect(Number.isInteger(top) && Number.isInteger(left)).toBe(true)
  })
})
