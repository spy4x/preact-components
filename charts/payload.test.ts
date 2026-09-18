import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type DateRange, loadChartPayload, previousPeriod } from "./payload.ts"

const range: DateRange = {
  from: new Date("2024-03-05T12:00:00Z"),
  to: new Date("2024-03-05T13:00:00Z"),
}

describe("previousPeriod", () => {
  it("ends where the current window starts", () => {
    const previous = previousPeriod(range)

    expect(previous.to.toISOString()).toBe(range.from.toISOString())
    expect(previous.from.toISOString()).toBe("2024-03-05T11:00:00.000Z")
  })

  it("walks back more than one window", () => {
    const previous = previousPeriod(range, 3)

    // The third window back: two hours before the current one.
    expect(previous.to.toISOString()).toBe("2024-03-05T10:00:00.000Z")
    expect(previous.from.toISOString()).toBe("2024-03-05T09:00:00.000Z")
  })

  it("keeps the window length", () => {
    const previous = previousPeriod({ from: new Date(0), to: new Date(90 * 60 * 1000) })

    expect(previous.to.getTime() - previous.from.getTime()).toBe(90 * 60 * 1000)
  })

  it("falls back to one hour when the range has no span", () => {
    const sameInstant = { from: new Date(1_000), to: new Date(1_000) }
    const previous = previousPeriod(sameInstant)

    expect(previous.to.getTime()).toBe(1_000)
    expect(previous.from.getTime()).toBe(1_000 - 60 * 60 * 1000)
  })

  it("falls back to one hour for an inverted or invalid range", () => {
    const inverted = previousPeriod({ from: new Date(5_000), to: new Date(1_000) })
    const invalid = previousPeriod({ from: new Date("nope"), to: new Date("nope") })

    expect(inverted.from.getTime()).toBe(5_000 - 60 * 60 * 1000)
    expect(inverted.to.getTime()).toBe(5_000)
    expect(Number.isNaN(invalid.from.getTime())).toBe(false)
    expect(invalid.to.getTime()).toBe(0)
  })

  it("rejects a nonsensical step count", () => {
    expect(previousPeriod(range, 0).to.toISOString()).toBe(
      previousPeriod(range, 1).to.toISOString(),
    )
    expect(previousPeriod(range, NaN).to.toISOString()).toBe(range.from.toISOString())
  })
})

describe("loadChartPayload", () => {
  const valid = {
    data: [{ timeGroup: "2024-03-05T12:00:00Z", value: 1.5 }],
    timeFrame: "hours",
  }

  it("returns the validated payload", async () => {
    const result = await loadChartPayload(() => Promise.resolve(valid), range)

    expect(result.error).toBe(null)
    expect(result.payload?.timeFrame).toBe("hours")
    expect(result.payload?.data.length).toBe(1)
  })

  it("accepts a Date and an epoch number for the bucket", async () => {
    const result = await loadChartPayload(
      () =>
        Promise.resolve({
          data: [{ timeGroup: new Date(0), value: 1 }, { timeGroup: 1_700_000_000, value: 2 }],
          timeFrame: "days",
        }),
      range,
    )

    expect(result.error).toBe(null)
    expect(result.payload?.data.length).toBe(2)
  })

  it("reports an invalid payload instead of throwing", async () => {
    const result = await loadChartPayload(
      () => Promise.resolve({ data: [{ timeGroup: "x" }], timeFrame: "weeks" }),
      range,
    )

    expect(result.payload).toBe(null)
    expect(result.error).toContain("timeFrame")
  })

  it("reports a rejection with the loader's message", async () => {
    const result = await loadChartPayload(() => Promise.reject(new Error("gateway offline")), range)

    expect(result.payload).toBe(null)
    expect(result.error).toBe("gateway offline")
  })

  it("stringifies a non-Error rejection", async () => {
    const result = await loadChartPayload(() => Promise.reject("boom"), range)

    expect(result.error).toBe("boom")
  })

  it("passes the range through to the loader untouched", async () => {
    let seen: DateRange | null = null
    await loadChartPayload((sought) => {
      seen = sought
      return Promise.resolve(valid)
    }, range)

    expect(seen).toBe(range)
  })
})
