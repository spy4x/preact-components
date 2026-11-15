import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { rangeFromSearch, rangeToSearch } from "./date-range-search.ts"

const options = {
  now: new Date("2026-10-21T10:00:00Z"),
  timeZone: "Europe/London",
  defaultPreset: "last-30-days",
} as const

const read = (query: string, extra: Partial<Parameters<typeof rangeFromSearch>[1]> = {}) =>
  rangeFromSearch(new URLSearchParams(query), { ...options, ...extra })

describe("rangeFromSearch", () => {
  it("reads no range as the default preset's days", () => {
    expect(read("")).toEqual({
      preset: "last-30-days",
      range: { from: "2026-09-22", to: "2026-10-21" },
    })
  })

  it("reads a preset by its id", () => {
    expect(read("range=last-7-days")).toEqual({
      preset: "last-7-days",
      range: { from: "2026-10-15", to: "2026-10-21" },
    })
  })

  it("reads from and to as a custom range", () => {
    expect(read("from=2026-10-01&to=2026-10-05")).toEqual({
      preset: "custom",
      range: { from: "2026-10-01", to: "2026-10-05" },
    })
  })

  it("reads an unknown preset, a reversed range or a malformed day as the default", () => {
    for (
      const query of ["range=forever", "from=2026-10-05&to=2026-10-01", "from=1st&to=2026-10-01"]
    ) {
      expect(read(query).preset).toBe("last-30-days")
    }
  })

  it("reads a preset or a custom range the page does not offer as the default", () => {
    const presets = ["last-30-days", "last-90-days"] as const
    expect(read("range=last-7-days", { presets }).preset).toBe("last-30-days")
    expect(read("from=2026-10-01&to=2026-10-05", { presets }).preset).toBe("last-30-days")
  })
})

describe("rangeToSearch", () => {
  const range = { from: "2026-10-01", to: "2026-10-05" }

  it("leaves the default preset out and keeps every other parameter", () => {
    const next = rangeToSearch(
      new URLSearchParams("tab=a&range=last-7-days"),
      { preset: "last-30-days", range },
      "last-30-days",
    )
    expect(next.toString()).toBe("tab=a")
  })

  it("writes another preset as range, dropping an earlier custom range", () => {
    const next = rangeToSearch(
      new URLSearchParams("from=2026-01-01&to=2026-01-02"),
      { preset: "last-90-days", range },
      "last-30-days",
    )
    expect(next.toString()).toBe("range=last-90-days")
  })

  it("writes a custom range as from and to, which reads back the same", () => {
    const next = rangeToSearch(new URLSearchParams(), { preset: "custom", range }, "last-30-days")
    expect(next.toString()).toBe("from=2026-10-01&to=2026-10-05")
    expect(rangeFromSearch(next, options)).toEqual({ preset: "custom", range })
  })
})
