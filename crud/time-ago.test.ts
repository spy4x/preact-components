import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { formatTimestamp, timeAgo } from "./time-ago.ts"

const now = new Date("2025-03-04T12:00:00Z")

describe("timeAgo", () => {
  it("renders an unset column as a dash", () => {
    expect(timeAgo(null, now)).toBe("-")
    expect(timeAgo(undefined, now)).toBe("-")
  })

  it("renders an unparsable value as a dash", () => {
    expect(timeAgo("not a date", now)).toBe("-")
  })

  it("calls anything under ten seconds a moment", () => {
    expect(timeAgo(new Date(now.getTime() - 5_000), now)).toBe("a moment ago")
  })

  it("counts seconds, then minutes, then hours", () => {
    expect(timeAgo(new Date(now.getTime() - 30_000), now)).toBe("30 seconds ago")
    expect(timeAgo(new Date(now.getTime() - 60_000), now)).toBe("1 minute ago")
    expect(timeAgo(new Date(now.getTime() - 7_200_000), now)).toBe("2 hours ago")
  })

  it("singularises a count of one", () => {
    expect(timeAgo(new Date(now.getTime() - 86_400_000), now)).toBe("1 day ago")
  })

  it("counts days, months and years", () => {
    expect(timeAgo(new Date(now.getTime() - 10 * 86_400_000), now)).toBe("10 days ago")
    expect(timeAgo(new Date(now.getTime() - 60 * 86_400_000), now)).toBe("2 months ago")
    expect(timeAgo(new Date(now.getTime() - 800 * 86_400_000), now)).toBe("2 years ago")
  })

  it("never reports zero years for something under a year old", () => {
    expect(timeAgo(new Date(now.getTime() - 360 * 86_400_000), now)).toBe("12 months ago")
  })

  it("accepts a string or a timestamp as well as a Date", () => {
    expect(timeAgo("2025-03-04T11:00:00Z", now)).toBe("1 hour ago")
    expect(timeAgo(now.getTime() - 3_600_000, now)).toBe("1 hour ago")
  })
})

describe("formatTimestamp", () => {
  it("renders an unset column as a dash", () => {
    expect(formatTimestamp(null)).toBe("-")
  })

  it("renders an unparsable value as a dash", () => {
    expect(formatTimestamp("")).toBe("-")
  })

  it("marks today, so a table does not repeat the date on every row", () => {
    expect(formatTimestamp(new Date())).toContain("Today")
  })

  it("prints the full date when asked", () => {
    expect(formatTimestamp(new Date(), { full: true })).not.toContain("Today")
  })

  it("prints an older timestamp without the today marker", () => {
    expect(formatTimestamp(new Date("2020-01-02T03:04:00Z"))).not.toContain("Today")
  })
})
