import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { loadMetricSeries, MetricPanel } from "./metric-panel.tsx"
import type { DateRange } from "./payload.ts"

const range: DateRange = {
  from: new Date("2024-03-05T12:00:00Z"),
  to: new Date("2024-03-05T13:00:00Z"),
}

const payload = {
  data: [{ timeGroup: "2024-03-05T12:00:00Z", value: 4_200 }],
  timeFrame: "hours",
}

describe("loadMetricSeries", () => {
  it("returns the series untouched at the default scale", async () => {
    const state = await loadMetricSeries({ loadStats: () => Promise.resolve(payload), range })

    expect(state.error).toBe(null)
    expect(state.timeFrame).toBe("hours")
    expect(state.data[0].value).toBe(4_200)
  })

  it("scales the values, which is how power becomes kW", async () => {
    const state = await loadMetricSeries({
      loadStats: () => Promise.resolve(payload),
      range,
      scale: 0.001,
    })

    expect(state.data[0].value).toBeCloseTo(4.2)
    expect(state.data[0].timeGroup).toBe(payload.data[0].timeGroup)
  })

  it("keeps the caller's time frame when the loader supplies one", async () => {
    const state = await loadMetricSeries({
      loadStats: () => Promise.resolve(payload),
      range,
      fallbackTimeFrame: "days",
    })

    expect(state.timeFrame).toBe("hours")
  })

  it("falls back to the requested time frame for an empty result", async () => {
    const state = await loadMetricSeries({
      loadStats: () => Promise.resolve({ data: [], timeFrame: "days" }),
      range,
      fallbackTimeFrame: "days",
    })

    expect(state.data).toEqual([])
    expect(state.timeFrame).toBe("days")
    expect(state.error).toBe(null)
  })

  it("turns an invalid payload into a metric error", async () => {
    const state = await loadMetricSeries({
      loadStats: () => Promise.resolve({ data: "nope" }),
      range,
    })

    expect(state.data).toEqual([])
    expect(state.error?.message).toContain("data")
  })

  it("turns a rejected loader into a metric error", async () => {
    const state = await loadMetricSeries({
      loadStats: () => Promise.reject(new Error("sensor unreachable")),
      range,
    })

    expect(state.error?.message).toBe("sensor unreachable")
    expect(state.data).toEqual([])
  })
})

describe("MetricPanel", () => {
  it("renders the heading with its unit", () => {
    const html = render(
      <MetricPanel title="Power" unit="kW">
        <span>chart</span>
      </MetricPanel>,
    )

    expect(html).toContain("Power, kW")
    expect(html).toContain("<span>chart</span>")
  })

  it("renders the heading without a unit", () => {
    expect(render(<MetricPanel title="Uptime">{null}</MetricPanel>)).toContain(">Uptime</h2>")
  })

  it("shows the error message and its instruction", () => {
    const html = render(
      <MetricPanel
        title="Energy"
        unit="kWh"
        error={{ message: "Gateway did not reply", instruction: "Try a shorter range" }}
      >
        {null}
      </MetricPanel>,
    )

    expect(html).toContain("Gateway did not reply")
    expect(html).toContain("Try a shorter range")
  })

  it("omits the error box when there is no error", () => {
    const html = render(
      <MetricPanel title="Energy" error={{ message: "unused" }}>{null}</MetricPanel>,
    )
    const withoutError = render(<MetricPanel title="Energy">{null}</MetricPanel>)

    expect(html).toContain("unused")
    expect(withoutError).not.toContain("bg-red-50")
  })

  it("renders the actions port", () => {
    const html = render(
      <MetricPanel title="Power" actions={<button type="button">CSV</button>}>
        {null}
      </MetricPanel>,
    )

    expect(html).toContain('<button type="button">CSV</button>')
  })

  it("keeps the caller's class", () => {
    expect(render(<MetricPanel title="Power" class="xl:col-span-2">{null}</MetricPanel>)).toContain(
      "xl:col-span-2",
    )
  })
})
