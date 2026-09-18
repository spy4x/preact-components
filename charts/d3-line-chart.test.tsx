import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  D3LineChart,
  DEFAULT_D3_LINE_CHART_COLORS,
  defaultTooltipFormat,
  formatTimeTick,
  type TimeSeriesPoint,
  yDomainFor,
} from "./d3-line-chart.tsx"

/** Built in local time, because `d3.timeFormat` formats in the machine's timezone. */
const noon = new Date(2024, 2, 5, 13, 45)

const series: TimeSeriesPoint[] = [
  { timeGroup: "2024-03-05T12:00:00Z", value: 4 },
  { timeGroup: "2024-03-05T12:15:00Z", value: 0 },
  { timeGroup: "2024-03-05T12:30:00Z", value: 8 },
]

describe("yDomainFor", () => {
  it("always includes zero and adds headroom above the maximum", () => {
    const [min, max] = yDomainFor([{ timeGroup: 0, value: 1 }, { timeGroup: 1, value: 3 }])

    expect(min).toBe(0)
    expect(max).toBeCloseTo(3.6)
  })

  it("includes a reference value above every data point", () => {
    const [min, max] = yDomainFor([{ timeGroup: 0, value: 2 }], { referenceValue: 10 })

    expect(min).toBe(0)
    expect(max).toBe(12)
  })

  it("drops the zero baseline when zeroes are ignored", () => {
    const sparse: TimeSeriesPoint[] = [
      { timeGroup: 0, value: 0 },
      { timeGroup: 1, value: 5 },
      { timeGroup: 2, value: 7 },
    ]

    const [min, max] = yDomainFor(sparse, { ignoreZeroes: true })

    expect(min).toBe(5)
    expect(max).toBeCloseTo(8.4)
  })

  it("keeps the baseline when every value is zero", () => {
    expect(yDomainFor([{ timeGroup: 0, value: 0 }])).toEqual([0, 1])
    expect(yDomainFor([{ timeGroup: 0, value: 0 }], { ignoreZeroes: true })).toEqual([0, 1])
  })

  it("covers negative values without clipping them", () => {
    expect(yDomainFor([{ timeGroup: 0, value: -5 }, { timeGroup: 1, value: -1 }])).toEqual([-5, 0])
  })

  it("returns a plottable domain for an empty series", () => {
    expect(yDomainFor([])).toEqual([0, 1])
  })

  it("ignores non-finite values", () => {
    expect(yDomainFor([{ timeGroup: 0, value: NaN }, { timeGroup: 1, value: Infinity }])).toEqual([
      0,
      1,
    ])
  })

  it("honours a custom headroom and rejects a nonsensical one", () => {
    expect(yDomainFor([{ timeGroup: 0, value: 10 }], { headroom: 2 })).toEqual([0, 20])
    expect(yDomainFor([{ timeGroup: 0, value: 10 }], { headroom: 0 })).toEqual([0, 12])
  })
})

describe("formatTimeTick", () => {
  it("formats an hour and minute for minute buckets", () => {
    expect(formatTimeTick(noon, "minutes")).toBe("13:45")
  })

  it("formats on the hour for hourly buckets", () => {
    expect(formatTimeTick(noon, "hours")).toBe("13:00")
  })

  it("formats a day and month for daily buckets", () => {
    expect(formatTimeTick(noon, "days")).toBe("05.03")
  })
})

describe("defaultTooltipFormat", () => {
  it("shows the full timestamp and the value", () => {
    expect(defaultTooltipFormat({ timeGroup: "2024-03-05T13:45:00Z", value: 12.5 })).toContain(
      "12.5",
    )
    expect(defaultTooltipFormat({ timeGroup: "2024-03-05T13:45:00Z", value: 12.5 })).toContain(
      "Value:",
    )
  })

  it("accepts a Date and falls back to the epoch for garbage", () => {
    expect(defaultTooltipFormat({ timeGroup: noon, value: 1 })).toContain("05.03.2024")
    expect(defaultTooltipFormat({ timeGroup: "not a date", value: 1 })).toContain("01.01.1970")
  })
})

describe("D3LineChart", () => {
  it("server-renders an empty labelled svg and fills it on the client", () => {
    const html = render(<D3LineChart data={series} timeFrame="minutes" ariaLabel="Power, kW" />)

    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Power, kW"')
    expect(html).toContain("<svg")
  })

  it("renders the empty state when there is no data", () => {
    const html = render(<D3LineChart data={[]} timeFrame="hours" emptyLabel="Nothing to plot" />)

    expect(html).toContain("Nothing to plot")
    expect(html).not.toContain("Loading…")
  })

  it("shows the loading overlay over the chart", () => {
    const html = render(
      <D3LineChart data={series} timeFrame="days" isLoading loadingLabel="Fetching…" />,
    )

    expect(html).toContain("Fetching…")
    expect(html).toContain('aria-busy="true"')
  })

  it("explains the gap legend when zeroes are ignored", () => {
    const withNote = render(<D3LineChart data={series} timeFrame="days" ignoreZeroes />)
    const withoutNote = render(<D3LineChart data={series} timeFrame="days" />)

    expect(withNote).toContain("Red line indicates missing values.")
    expect(withoutNote).not.toContain("Red line indicates missing values.")
  })

  it("takes its colours from props, defaulting to theme tokens", () => {
    const html = render(
      <D3LineChart
        data={series}
        timeFrame="days"
        colors={{ surface: "#123456", tooltipText: "#654321" }}
      />,
    )

    expect(html).toContain("background:#123456")
    expect(html).toContain("color:#654321")
    expect(DEFAULT_D3_LINE_CHART_COLORS.line).toContain("var(--color-primary")
  })

  it("keeps the caller's class", () => {
    expect(render(<D3LineChart data={series} timeFrame="days" class="mt-6" />)).toContain("mt-6")
  })
})
