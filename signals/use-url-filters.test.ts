import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type FilterField, resolveFilterValue, shouldPersistFilter } from "./use-url-filters.ts"
import { signal } from "@preact/signals"

function stringField(urlParam: string, initialValue: string): FilterField<string> {
  return { signal: signal(initialValue), urlParam, initialValue }
}

function numberField(urlParam: string, initialValue: number): FilterField<number> {
  return { signal: signal(initialValue), urlParam, initialValue }
}

describe("resolveFilterValue", () => {
  it("falls back to the default for an absent parameter", () => {
    expect(resolveFilterValue(stringField("status", "all"), null)).toBe("all")
    expect(resolveFilterValue(numberField("page", 1), null)).toBe(1)
  })

  it("reads a string parameter", () => {
    expect(resolveFilterValue(stringField("status", "all"), "active")).toBe("active")
  })

  it("treats an empty parameter as the default", () => {
    expect(resolveFilterValue(stringField("status", "all"), "")).toBe("all")
  })

  it("parses a number parameter", () => {
    expect(resolveFilterValue(numberField("page", 1), "7")).toBe(7)
  })

  it("ignores a number parameter that is not a number", () => {
    expect(resolveFilterValue(numberField("page", 1), "abc")).toBe(1)
  })

  it("prefers a custom parser", () => {
    const field: FilterField<string[]> = {
      signal: signal<string[]>([]),
      urlParam: "tags",
      initialValue: [],
      parser: (value) => value ? value.split("|") : [],
    }
    expect(resolveFilterValue(field, "a|b")).toEqual(["a", "b"])
    expect(resolveFilterValue(field, null)).toEqual([])
  })

  it("lets a parser see the raw null for an absent parameter", () => {
    const field: FilterField<number | null> = {
      signal: signal<number | null>(null),
      urlParam: "zoneId",
      initialValue: null,
      parser: (value) => value === null ? null : Number(value),
    }
    expect(resolveFilterValue(field, "3")).toBe(3)
    expect(resolveFilterValue(field, null)).toBeNull()
  })
})

describe("shouldPersistFilter", () => {
  it("keeps a value that differs from the default", () => {
    expect(shouldPersistFilter(stringField("status", "all"), "active")).toBe(true)
    expect(shouldPersistFilter(numberField("page", 1), 2)).toBe(true)
  })

  it("drops the default so the URL stays clean", () => {
    expect(shouldPersistFilter(stringField("status", "all"), "all")).toBe(false)
    expect(shouldPersistFilter(numberField("page", 1), 1)).toBe(false)
  })

  it("drops the empty values", () => {
    expect(shouldPersistFilter(stringField("status", ""), "")).toBe(false)
    expect(shouldPersistFilter(stringField("status", "all"), "")).toBe(false)
  })

  it("drops null", () => {
    const field: FilterField<number | null> = {
      signal: signal<number | null>(null),
      urlParam: "zoneId",
      initialValue: 5,
      parser: (value) => value === null ? null : Number(value),
    }
    expect(shouldPersistFilter(field, null)).toBe(false)
  })

  it("keeps a falsy value that is not the default", () => {
    expect(shouldPersistFilter(numberField("page", 1), 0)).toBe(true)
  })
})
