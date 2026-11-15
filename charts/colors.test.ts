import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { CHART_PALETTE_CLASS, DEFAULT_CHART_PALETTE, seriesColor } from "./colors.ts"

const LIGHT = [
  "#2a78d6",
  "#d95926",
  "#15935f",
  "#4a3aa7",
  "#c93f75",
  "#9a5b00",
  "#0b8aa0",
  "#6b7a00",
]
const DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#9085e9",
  "#d55181",
  "#cc8300",
  "#1a9fb5",
  "#8a9a1e",
]

describe("DEFAULT_CHART_PALETTE", () => {
  it("lists eight series colours in draw order, each falling back to its light step", () => {
    expect(DEFAULT_CHART_PALETTE).toEqual(
      LIGHT.map((light, index) =>
        `var(--color-chart-${index + 1}, var(--chart-${index + 1}, ${light}))`
      ),
    )
  })

  it("wraps the ninth series back to the first colour", () => {
    expect(seriesColor(7)).toBe(DEFAULT_CHART_PALETTE[7])
    expect(seriesColor(8)).toBe(DEFAULT_CHART_PALETTE[0])
  })
})

describe("CHART_PALETTE_CLASS", () => {
  it("sets every slot's light step, and its dark step under .dark where the two differ", () => {
    const classes = CHART_PALETTE_CLASS.split(" ")
    for (const [index, light] of LIGHT.entries()) {
      expect(classes).toContain(`[--chart-${index + 1}:${light}]`)
      if (DARK[index] !== light) {
        expect(classes).toContain(`dark:[--chart-${index + 1}:${DARK[index]}]`)
      }
    }
    expect(classes.length).toBe(LIGHT.length + DARK.filter((dark, i) => dark !== LIGHT[i]).length)
  })
})
