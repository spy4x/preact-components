import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DonutChart, type DonutDatum, donutGeometry } from "./donut-chart.tsx"

const data: DonutDatum[] = [
  { label: "fighters", value: 3, color: "#111111" },
  { label: "bombers", value: 1, color: "#222222" },
]

describe("donutGeometry", () => {
  it("turns values into cumulative shares", () => {
    const geometry = donutGeometry(data)

    expect(geometry.total).toBe(4)
    expect(geometry.segments[0].share).toBe(0.75)
    expect(geometry.segments[0].startPercent).toBe(0)
    expect(geometry.segments[0].endPercent).toBe(75)
    expect(geometry.segments[1].startPercent).toBe(75)
    expect(geometry.segments[1].endPercent).toBe(100)
    expect(geometry.gradient).toBe(
      "conic-gradient(#111111 0% 75%, #222222 75% 100%)",
    )
  })

  it("formats each share as a one-decimal percentage", () => {
    const geometry = donutGeometry([
      { label: "a", value: 1, color: "#a" },
      { label: "b", value: 1, color: "#b" },
      { label: "c", value: 1, color: "#c" },
    ])

    expect(geometry.segments[1].percent).toBe("33.3%")
    expect(geometry.segments[1].endPercent).toBe(66.67)
  })

  it("falls back to the palette when a datum has no colour", () => {
    const geometry = donutGeometry([{ label: "a", value: 1 }], { colors: ["#abcabc"] })

    expect(geometry.segments[0].color).toBe("#abcabc")
  })

  it("renders an empty ring when nothing is positive", () => {
    const geometry = donutGeometry(
      [{ label: "a", value: 0 }, { label: "b", value: -5 }],
      { emptyColor: "#eeeeee" },
    )

    expect(geometry.total).toBe(0)
    expect(geometry.gradient).toBe("conic-gradient(#eeeeee 0% 100%)")
    expect(geometry.segments.every((segment) => segment.share === 0)).toBe(true)
    expect(geometry.segments.every((segment) => segment.percent === "0.0%")).toBe(true)
  })

  it("treats non-finite values as zero without poisoning the total", () => {
    const geometry = donutGeometry([
      { label: "a", value: NaN, color: "#a" },
      { label: "b", value: Infinity, color: "#b" },
      { label: "c", value: 2, color: "#c" },
    ])

    expect(geometry.total).toBe(2)
    expect(geometry.segments[2].share).toBe(1)
    expect(geometry.gradient).toBe("conic-gradient(#a 0% 0%, #b 0% 0%, #c 0% 100%)")
  })

  it("returns an empty geometry for an empty dataset", () => {
    const geometry = donutGeometry([])

    expect(geometry.segments).toEqual([])
    expect(geometry.total).toBe(0)
  })
})

describe("DonutChart", () => {
  it("paints the ring with the geometry gradient", () => {
    const html = render(<DonutChart data={data} centerValue="4" centerLabel="matches" />)

    expect(html).toContain("conic-gradient(#111111 0% 75%, #222222 75% 100%)")
    expect(html).toContain(">4</strong>")
    expect(html).toContain(">matches</span>")
  })

  it("lists the legend with one entry per slice", () => {
    const html = render(<DonutChart data={data} />)

    expect(html.split("<li").length - 1).toBe(2)
    expect(html).toContain(">fighters</span>")
    expect(html).toContain(">75.0%</strong>")
    expect(html).toContain(">25.0%</strong>")
  })

  it("links a legend entry when the datum carries an href", () => {
    const html = render(
      <DonutChart data={[{ label: "planes", value: 1, href: "/planes" }]} />,
    )

    expect(html).toContain('href="/planes"')
  })

  it("drops the legend on request", () => {
    const html = render(<DonutChart data={data} showLegend={false} />)

    expect(html).not.toContain("<li")
    expect(html).toContain("conic-gradient")
  })

  it("renders an empty state without a ring", () => {
    const html = render(<DonutChart data={[]} emptyLabel="No slices" />)

    expect(html).toContain("No slices")
    expect(html).not.toContain("conic-gradient")
  })

  it("keeps a ring for an all-zero dataset", () => {
    const html = render(<DonutChart data={[{ label: "none", value: 0 }]} />)

    expect(html).toContain("conic-gradient")
    expect(html).toContain(">0.0%</strong>")
    expect(html).not.toContain("NaN")
  })

  it("names the ring for assistive tech", () => {
    const titled = render(<DonutChart data={data} title="Matches" />)
    const anonymous = render(<DonutChart data={data} />)

    expect(titled).toContain('aria-label="Matches"')
    expect(anonymous).toContain('aria-label="Donut chart of 2 slices"')
  })

  it("takes the slice colours from the colors prop", () => {
    const html = render(
      <DonutChart
        data={[{ label: "a", value: 1 }, { label: "b", value: 1 }]}
        colors={["#010101", "#020202"]}
      />,
    )

    expect(html).toContain("#010101")
    expect(html).toContain("#020202")
  })

  it("uses the track and surface colours for the empty ring and the centre", () => {
    const html = render(
      <DonutChart data={[{ label: "a", value: 0 }]} trackColor="#999999" surfaceColor="#888888" />,
    )

    expect(html).toContain("#999999 0% 100%")
    expect(html).toContain("background:#888888")
  })
})
