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

/** The `d` of every series path, in order, leaving out the dashed bridges over missing values. */
function linePaths(html: string): string[] {
  return [...html.matchAll(/<path d="([^"]+)"(?![^>]*data-chart-bridge)[^>]*>/g)].map(([, d]) => d)
}

/** The `left` of every X label, with its text. */
function xLabels(html: string): string[] {
  const row = html.slice(html.lastIndexOf(`class="absolute inset-y-0 inset-x-3"`))
  return [...row.matchAll(/style="left:([^;"]+);?">([^<]+)</g)].map(([, left, text]) =>
    `${left} ${text}`
  )
}

describe("LineChart", () => {
  it("draws each series as a path across the plot, scaled to the Y domain", () => {
    const html = render(<LineChart series={twoPoints} yDomain={[0, 10]} title="Runs" />)

    expect(linePaths(html)).toEqual(["M0.0,1000.0 L1000.0,0.0"])
    expect(html).toContain(`preserveAspectRatio="none"`)
  })

  it("draws one dot per point whose native tooltip names the series, the X and the value", () => {
    const html = render(<LineChart series={twoPoints} title="Runs" />)

    expect(count(html, `title="Runs `)).toBe(2)
    expect(html).toContain(`title="Runs Jan: 0"`)
    expect(html).toContain(`title="Runs Feb: 10"`)
  })

  it("prints a Y label and a grid line per tick", () => {
    const html = render(<LineChart series={twoPoints} yDomain={[0, 10]} yTicks={2} />)

    expect(count(html, "border-t border-dashed")).toBe(3)
    for (const label of [">0<", ">5<", ">10<"]) expect(html).toContain(label)
  })

  it("labels every n-th category and always the last one", () => {
    const series: LineSeries[] = [{
      name: "Load",
      points: ["a", "b", "c", "d", "e"].map((x, index) => ({ x, y: index })),
    }]
    const html = render(<LineChart series={series} xStride={3} />)

    expect(xLabels(html)).toEqual(["0% a", "75% d", "100% e"])
  })

  it("thins a dense category axis to about six labels on its own", () => {
    const series: LineSeries[] = [{
      name: "Hourly",
      points: Array.from({ length: 24 }, (_, index) => ({ x: `h${index}`, y: index })),
    }]
    const labels = xLabels(render(<LineChart series={series} />))

    expect(labels.length).toBeLessThanOrEqual(7)
    expect(labels.at(-1)).toBe("100% h23")
  })

  it("leaves the dots out when a series asks for a line only", () => {
    const html = render(<LineChart series={[{ ...twoPoints[0], showPoints: false }]} />)

    expect(count(html, `title="Runs `)).toBe(0)
    expect(linePaths(html).length).toBe(1)
  })

  it("renders the empty label instead of a plot when nothing can be drawn", () => {
    const html = render(
      <LineChart series={[{ name: "Gone", points: [{ x: "a", y: null }] }]} emptyLabel="Nothing" />,
    )

    expect(html).toContain("Nothing")
    expect(html).not.toContain("<svg")
  })

  it("breaks the line at a missing value and bridges the gap with a dashed segment and a note", () => {
    const series: LineSeries[] = [{
      name: "Sensor",
      points: [{ x: "a", y: 1 }, { x: "b", y: 2 }, { x: "c", y: null }, { x: "d", y: 4 }],
    }]
    const html = render(<LineChart series={series} yDomain={[0, 4]} />)

    expect(linePaths(html)).toEqual([
      "M0.0,750.0 L333.3,500.0",
      "M1000.0,0.0 L1000.0,0.0",
    ])
    expect(html).toMatch(/<path d="M333.3,500.0 L1000.0,0.0"[^>]*stroke-dasharray="2 3"/)
    expect(html).toContain("Dashed grey segments bridge missing values.")
  })

  it("treats a zero as missing when asked to ignore zeroes", () => {
    const series: LineSeries[] = [{
      name: "Meter",
      points: [{ x: "a", y: 2 }, { x: "b", y: 0 }, { x: "c", y: 2 }],
    }]
    const drawn = render(<LineChart series={series} yDomain={[0, 4]} />)
    const ignored = render(<LineChart series={series} yDomain={[0, 4]} ignoreZeroes />)

    expect(linePaths(drawn)).toEqual(["M0.0,500.0 L500.0,1000.0 L1000.0,500.0"])
    expect(linePaths(ignored)).toEqual(["M0.0,500.0 L0.0,500.0", "M1000.0,500.0 L1000.0,500.0"])
    expect(ignored).toContain("data-chart-bridge")
  })

  it("places points by time on a time axis and labels round instants in UTC", () => {
    const series: LineSeries[] = [{
      name: "Revenue",
      points: [
        { x: "2026-03-01T00:00:00Z", y: 1 },
        { x: Date.UTC(2026, 2, 1, 1), y: 2 },
        { x: new Date("2026-03-01T04:00:00Z"), y: 3 },
      ],
    }]
    const html = render(<LineChart series={series} xAxis="time" yDomain={[0, 4]} />)

    expect(linePaths(html)).toEqual(["M0.0,750.0 L250.0,500.0 L1000.0,250.0"])
    expect(xLabels(html)).toEqual(["0% 1 Mar", "25% 01:00", "50% 02:00", "75% 03:00", "100% 04:00"])
    expect(html).toContain(`title="Revenue 1 Mar 2026, 01:00: 2"`)
  })

  it("prints time labels in the zone it is given", () => {
    const series: LineSeries[] = [{
      name: "Revenue",
      points: [{ x: "2026-03-01T00:00:00Z", y: 1 }, { x: "2026-03-01T04:00:00Z", y: 3 }],
    }]
    const html = render(<LineChart series={series} xAxis="time" timeZone="Asia/Tokyo" />)

    expect(xLabels(html)[0]).toBe("0% 09:00")
  })

  it("keeps the hour in a point's heading when points are hourly, though the axis steps in days", () => {
    const start = Date.UTC(2026, 2, 1)
    const series: LineSeries[] = [{
      name: "Load",
      points: Array.from({ length: 240 }, (_, hour) => ({ x: start + hour * 3_600_000, y: hour })),
    }]
    const html = render(<LineChart series={series} xAxis="time" />)

    expect(html).toContain(`title="Load 1 Mar 2026, 03:00: 3"`)
    expect(html).toContain(`title="Load 1 Mar 2026, 21:00: 21"`)
    expect(xLabels(html)[0]).toMatch(/Mar$/)
  })

  it("leaves the clock out of a point's heading when every point is a midnight", () => {
    const series: LineSeries[] = [{
      name: "Sales",
      points: [1, 2, 3].map((day) => ({ x: Date.UTC(2026, 2, day), y: day })),
    }]
    const html = render(<LineChart series={series} xAxis="time" />)

    expect(html).toContain(`title="Sales 2 Mar 2026: 2"`)
  })

  it("dashes a series marked dashed, in the plot and in the legend", () => {
    const series: LineSeries[] = [twoPoints[0], {
      ...twoPoints[0],
      name: "Last year",
      dashed: true,
    }]
    const html = render(<LineChart series={series} />)

    expect(html).toMatch(/<path d="[^"]+"[^>]*stroke-dasharray="6 4"/)
    expect(count(html, 'stroke-dasharray="6 4"')).toBe(1)
    expect(html).toContain("inline-block w-3 border-t-2 border-dashed")
  })

  it("draws the reference line inside the Y domain even above every value", () => {
    const html = render(
      <LineChart series={twoPoints} referenceValue={30} referenceLabel="Target" />,
    )

    const top = html.match(/style="top:([\d.]+)%;[^"]*" data-chart-reference/)?.[1]
    // 30 sits in the top half of a domain padded around it, not above the plot at a negative top.
    expect(Number(top)).toBeGreaterThan(0)
    expect(Number(top)).toBeLessThan(50)
    expect(html).toContain(">Target<")
  })

  it("covers the plot with the loading label and marks the chart busy while loading", () => {
    const html = render(<LineChart series={[]} isLoading loadingLabel="Fetching" />)

    expect(html).toContain(`aria-busy="true"`)
    expect(html).toContain(">Fetching<")
    expect(html).not.toContain("No data")
  })

  it("colours series from the palette by index unless a series brings its own", () => {
    const series: LineSeries[] = [
      twoPoints[0],
      { ...twoPoints[0], name: "B" },
      { ...twoPoints[0], name: "C", color: "red" },
    ]
    const html = render(<LineChart series={series} colors={["tomato", "teal"]} />)

    expect(html).toContain("stroke:tomato")
    expect(html).toContain("stroke:teal")
    expect(html).toContain("stroke:red")
  })

  it("shows a legend for several series, not for one, unless told otherwise", () => {
    const two = [twoPoints[0], { ...twoPoints[0], name: "Walks" }]

    expect(render(<LineChart series={two} />)).toContain(">Walks</span>")
    expect(render(<LineChart series={twoPoints} />)).not.toContain(">Runs</span>")
    expect(render(<LineChart series={twoPoints} showLegend />)).toContain(">Runs</span>")
  })

  it("names the plot as an image and takes focus only once it runs in a browser", () => {
    const html = render(<LineChart series={twoPoints} title="Weekly runs" />)

    expect(html).toContain(`role="img" aria-label="Weekly runs"`)
    expect(html).not.toContain("tabindex")
    expect(render(<LineChart series={twoPoints} ariaLabel="Runs, km" />)).toContain(
      `aria-label="Runs, km"`,
    )
  })

  it("serves an empty, hidden tooltip for the browser to fill", () => {
    const html = render(<LineChart series={twoPoints} />)

    expect(html).toMatch(
      /class="[^"]*\binvisible\b[^"]*"[^>]*role="status" data-chart-tooltip><\/div>/,
    )
  })

  it("takes its axis, grid and text colours from props", () => {
    const html = render(
      <LineChart series={twoPoints} axisColor="navy" gridColor="silver" textColor="plum" />,
    )

    expect(html).toContain("border-color:navy")
    expect(html).toContain("border-color:silver")
    expect(html).toContain("color:plum")
  })

  it("prints Y values through yFormat, and by default with no trailing zeros", () => {
    expect(render(<LineChart series={twoPoints} yFormat={(value) => `${value} km`} />))
      .toContain(`title="Runs Feb: 10 km"`)
    const html = render(<LineChart series={[{ name: "R", points: [{ x: "a", y: 1 / 3 }] }]} />)
    expect(html).toContain(`title="R a: 0.33"`)
  })

  it("draws a single point in the middle without NaN", () => {
    const html = render(<LineChart series={[{ name: "One", points: [{ x: "a", y: 5 }] }]} />)

    expect(html).not.toContain("NaN")
    expect(linePaths(html)[0]).toMatch(/^M500.0,[\d.]+ L500.0,[\d.]+$/)
  })

  it("puts the palette's custom properties on its root so the colours follow the theme", () => {
    const html = render(<LineChart series={twoPoints} />)

    expect(html).toContain("[--chart-1:#2a78d6]")
    expect(html).toContain("dark:[--chart-1:#3987e5]")
    expect(html).toContain("var(--color-chart-1, var(--chart-1, #2a78d6))")
  })
})
