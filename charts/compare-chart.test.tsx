import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { CompareChart } from "./compare-chart.tsx"
import type { DateRange } from "./payload.ts"

const range: DateRange = {
  from: new Date("2024-03-05T12:00:00Z"),
  to: new Date("2024-03-05T13:00:00Z"),
}

const data = [
  { timeGroup: "2024-03-05T12:00:00Z", value: 4 },
  { timeGroup: "2024-03-05T12:15:00Z", value: 8 },
]

describe("CompareChart", () => {
  it("renders the primary chart and a toggle", () => {
    const html = render(
      <CompareChart
        range={range}
        data={data}
        timeFrame="minutes"
        loadStats={() => Promise.resolve({ data: [], timeFrame: "minutes" })}
        ariaLabel="Power, kW"
      />,
    )

    expect(html).toContain('type="checkbox"')
    expect(html).toContain("Compare with the previous period")
    expect(html).toContain('aria-label="Power, kW"')
  })

  it("stays collapsed until the toggle is on, so no previous window is requested", () => {
    let calls = 0
    const html = render(
      <CompareChart
        range={range}
        data={data}
        timeFrame="minutes"
        loadStats={() => {
          calls++
          return Promise.resolve({ data: [], timeFrame: "minutes" })
        }}
      />,
    )

    expect(calls).toBe(0)
    expect(html.split("<svg").length - 1).toBe(1)
  })

  it("takes a custom toggle label", () => {
    const html = render(
      <CompareChart
        range={range}
        data={data}
        timeFrame="hours"
        compareLabel="Compare"
        loadStats={() => Promise.resolve({ data: [], timeFrame: "hours" })}
      />,
    )

    expect(html).toContain(">Compare</label>")
  })

  it("passes the loading flag to the primary chart", () => {
    const html = render(
      <CompareChart
        range={range}
        data={data}
        timeFrame="days"
        isLoading
        loadingLabel="Fetching…"
        loadStats={() => Promise.resolve({ data: [], timeFrame: "days" })}
      />,
    )

    expect(html).toContain("Fetching…")
    expect(html).toContain('aria-busy="true"')
  })

  it("keeps the caller's class and chart colour props", () => {
    const html = render(
      <CompareChart
        range={range}
        data={data}
        timeFrame="days"
        class="mt-4"
        colors={{ surface: "#abcdef" }}
        loadStats={() => Promise.resolve({ data: [], timeFrame: "days" })}
      />,
    )

    expect(html).toContain("space-y-4 mt-4")
    expect(html).toContain("background:#abcdef")
  })
})
