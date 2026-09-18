import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LineChart, type LineSeries } from "./line-chart.tsx"

const twoPoints: LineSeries[] = [
  { name: "Runs", points: [{ x: "Jan", y: 0 }, { x: "Feb", y: 10 }] },
]

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe("LineChart", () => {
  it("renders one path per series with positions from the scales", () => {
    const html = render(
      <LineChart series={twoPoints} yDomain={[0, 10]} title="Runs" />,
    )

    // 800×280 viewBox, 56/16/24/36 padding → 728×220 plot area at (56, 24).
    expect(html).toContain("M56.0,244.0 L784.0,24.0")
    expect(count(html, "<path")).toBe(1)
    expect(html).toContain('viewBox="0 0 800 280"')
  })

  it("draws one dot per point with a hover tooltip", () => {
    const html = render(<LineChart series={twoPoints} title="Runs" />)

    expect(count(html, "<circle")).toBe(2)
    expect(html).toContain("<title>Runs Jan: 0.00</title>")
    expect(html).toContain("<title>Runs Feb: 10.00</title>")
  })

  it("renders a grid line and a label per Y tick", () => {
    const html = render(<LineChart series={twoPoints} yDomain={[0, 10]} />)

    // ticks(0, 10) → 0, 2, 4, 6, 8, 10
    expect(count(html, "<line")).toBe(7)
    expect(count(html, "<text")).toBe(8)
    expect(html).toContain(">0.00</text>")
    expect(html).toContain(">10.00</text>")
  })

  it("thins the X labels to the requested stride and keeps the last one", () => {
    const points = Array.from({ length: 20 }, (_, index) => ({
      x: `d${index}`,
      y: index,
    }))
    const html = render(<LineChart series={[{ name: "s", points }]} xStride={5} />)

    expect(count(html, 'text-anchor="middle"')).toBe(5)
    expect(html).toContain(">d0</text>")
    expect(html).toContain(">d19</text>")
    expect(html).not.toContain(">d1</text>")
  })

  it("strides X labels automatically for a dense axis", () => {
    const points = Array.from({ length: 100 }, (_, index) => ({ x: `d${index}`, y: index }))
    const html = render(<LineChart series={[{ name: "s", points }]} />)

    // 100 points, budget of 8 labels → every 13th, plus the last one.
    expect(count(html, 'text-anchor="middle"')).toBe(9)
  })

  it("omits the dots when a series asks for a line only", () => {
    const html = render(
      <LineChart series={[{ name: "s", points: twoPoints[0].points, showPoints: false }]} />,
    )

    expect(count(html, "<circle")).toBe(0)
    expect(count(html, "<path")).toBe(1)
  })

  it("renders the empty state without a chart", () => {
    const html = render(<LineChart series={[]} emptyLabel="Nothing here" />)

    expect(html).toContain("Nothing here")
    expect(html).not.toContain("<svg")
  })

  it("ignores series whose values cannot be plotted", () => {
    const html = render(
      <LineChart
        series={[
          { name: "broken", points: [{ x: "a", y: NaN }, { x: "b", y: Infinity }] },
          { name: "good", points: [{ x: "a", y: 1 }] },
        ]}
      />,
    )

    expect(count(html, "<path")).toBe(1)
    expect(html).toContain("good")
    expect(html).not.toContain(">NaN<")
  })

  it("renders a single point without NaN geometry", () => {
    const html = render(
      <LineChart series={[{ name: "one", points: [{ x: "only", y: 42 }] }]} />,
    )

    expect(count(html, "<circle")).toBe(1)
    expect(html).not.toContain("NaN")
    // A degenerate X domain centres the point in the plot area.
    expect(html).toContain('cx="420"')
  })

  it("renders an all-equal series on a padded domain", () => {
    const html = render(
      <LineChart series={[{ name: "flat", points: [{ x: "a", y: 5 }, { x: "b", y: 5 }] }]} />,
    )

    expect(html).not.toContain("NaN")
    expect(html).toContain("4.40")
    expect(html).toContain("5.60")
  })

  it("uses the palette by series index and honours a per-series colour", () => {
    const html = render(
      <LineChart
        series={[
          { name: "a", points: [{ x: "x", y: 1 }] },
          { name: "b", points: [{ x: "x", y: 2 }] },
          { name: "c", points: [{ x: "x", y: 3 }], color: "#123456" },
        ]}
        colors={["#111111", "#222222"]}
      />,
    )

    expect(html).toContain("#111111")
    expect(html).toContain("#222222")
    expect(html).toContain("#123456")
  })

  it("wraps the palette around more series than colours", () => {
    const html = render(
      <LineChart
        series={[
          { name: "a", points: [{ x: "x", y: 1 }] },
          { name: "b", points: [{ x: "x", y: 2 }] },
          { name: "c", points: [{ x: "x", y: 3 }] },
        ]}
        colors={["#111111", "#222222"]}
      />,
    )

    // a and c share the first palette entry: path, dot and legend swatch each.
    expect(count(html, "#111111")).toBe(6)
    expect(count(html, "#222222")).toBe(3)
  })

  it("shows the legend for multiple series and hides it for one", () => {
    const single = render(<LineChart series={[{ name: "s", points: twoPoints[0].points }]} />)
    const multiple = render(
      <LineChart
        series={[
          { name: "first", points: [{ x: "x", y: 1 }] },
          { name: "second", points: [{ x: "x", y: 2 }] },
        ]}
      />,
    )

    expect(single).not.toContain(">s</span>")
    expect(multiple).toContain("first")
    expect(multiple).toContain("second")
  })

  it("lets the caller force the legend either way", () => {
    const forced = render(
      <LineChart series={[{ name: "solo", points: [{ x: "x", y: 1 }] }]} showLegend />,
    )
    const hidden = render(
      <LineChart
        series={[
          { name: "a", points: [{ x: "x", y: 1 }] },
          { name: "b", points: [{ x: "x", y: 2 }] },
        ]}
        showLegend={false}
      />,
    )

    expect(forced).toContain("solo</span>")
    expect(hidden).not.toContain("legend-a")
  })

  it("exposes the chart as a labelled image", () => {
    const named = render(<LineChart series={twoPoints} title="Runs per month" />)
    const overridden = render(
      <LineChart series={twoPoints} title="Runs" ariaLabel="Monthly run totals" />,
    )
    const anonymous = render(<LineChart series={twoPoints} />)

    expect(named).toContain('role="img"')
    expect(named).toContain('aria-label="Runs per month"')
    expect(overridden).toContain('aria-label="Monthly run totals"')
    expect(anonymous).toContain('aria-label="Line chart with 1 series"')
  })

  it("takes axis, grid and text colours as props", () => {
    const html = render(
      <LineChart
        series={twoPoints}
        axisColor="#010101"
        gridColor="#020202"
        textColor="#030303"
      />,
    )

    expect(html).toContain("#010101")
    expect(html).toContain("#020202")
    expect(html).toContain("#030303")
  })

  it("defaults the colours to theme custom properties", () => {
    const html = render(<LineChart series={twoPoints} />)

    expect(html).toContain("var(--color-primary-muted, oklch(0.558 0.288 302.321))")
    expect(html).toContain("var(--color-border-subtle, oklch(0.928 0.006 264.531))")
  })

  it("renders the chart title and a caller class", () => {
    const html = render(<LineChart series={twoPoints} title="Runs" class="mt-4" />)

    expect(html).toContain(">Runs</h3>")
    expect(html).toContain("overflow-x-auto mt-4")
  })

  it("formats Y tick labels through the yFormat port", () => {
    const html = render(
      <LineChart
        series={twoPoints}
        yDomain={[0, 10]}
        yFormat={(value) => `${value} kg`}
      />,
    )

    expect(html).toContain(">0 kg</text>")
    expect(html).toContain(">10 kg</text>")
  })
})
