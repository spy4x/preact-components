import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { placeTooltip, visibleBounds } from "./tooltip.ts"

const box = { left: 0, top: 0, right: 400, bottom: 300 }
const size = { width: 120, height: 60 }

describe("placeTooltip", () => {
  it("puts the tooltip to the right of the point, centred on it", () => {
    expect(placeTooltip({ x: 100, y: 150 }, size, box)).toEqual({
      left: 112,
      top: 120,
      side: "right",
    })
  })

  it("flips to the left of the point when the right has no room", () => {
    expect(placeTooltip({ x: 350, y: 150 }, size, box)).toEqual({
      left: 218,
      top: 120,
      side: "left",
    })
  })

  it("pushes the tooltip back inside when neither side has room", () => {
    const narrow = { left: 0, top: 0, right: 200, bottom: 300 }

    expect(placeTooltip({ x: 100, y: 150 }, size, narrow)).toEqual({
      left: 0,
      top: 120,
      side: "left",
    })
  })

  it("keeps the tooltip inside the top and bottom edges at the first and last value", () => {
    expect(placeTooltip({ x: 100, y: 5 }, size, box).top).toBe(0)
    expect(placeTooltip({ x: 100, y: 298 }, size, box).top).toBe(240)
  })

  it("keeps the top-left corner in view when the tooltip is larger than the space", () => {
    const tiny = { left: 10, top: 20, right: 60, bottom: 50 }

    expect(placeTooltip({ x: 30, y: 30 }, size, tiny)).toMatchObject({ left: 10, top: 20 })
  })
})

describe("visibleBounds", () => {
  it("is the part of the chart inside the viewport, kept 8 pixels off its edges", () => {
    const chart = { left: -50, top: 100, right: 500, bottom: 900 }

    expect(visibleBounds(chart, { width: 375, height: 812 })).toEqual({
      left: 8,
      top: 100,
      right: 367,
      bottom: 804,
    })
  })
})
