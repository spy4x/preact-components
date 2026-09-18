import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  parseSort,
  removeSortRule,
  serializeSort,
  sortRows,
  type SortRule,
  toggleSort,
} from "./table-state.ts"

interface Row {
  name: string
  spawns: number
  kills: number
}

const rows: Row[] = [
  { name: "B", spawns: 10, kills: 3 },
  { name: "A", spawns: 10, kills: 7 },
  { name: "C", spawns: 20, kills: 1 },
]

describe("toggleSort", () => {
  it("appends a new column as the least significant rule", () => {
    const rules = toggleSort(toggleSort<"spawns" | "kills">([], "spawns"), "kills")
    expect(rules).toEqual([
      { key: "spawns", direction: "asc" },
      { key: "kills", direction: "asc" },
    ])
  })

  it("cycles a column asc, desc, off", () => {
    let rules: SortRule<"spawns" | "kills">[] = toggleSort([], "spawns")
    expect(rules[0].direction).toBe("asc")
    rules = toggleSort(rules, "spawns")
    expect(rules[0].direction).toBe("desc")
    rules = toggleSort(rules, "spawns")
    expect(rules).toEqual([])
  })

  it("leaves other priorities where they were", () => {
    const rules = toggleSort<"spawns" | "kills">([
      { key: "spawns", direction: "asc" },
      { key: "kills", direction: "asc" },
    ], "spawns")
    expect(rules).toEqual([
      { key: "spawns", direction: "desc" },
      { key: "kills", direction: "asc" },
    ])
  })

  it("does not mutate the rules it was given", () => {
    const before: SortRule<"spawns">[] = [{ key: "spawns", direction: "asc" }]
    toggleSort(before, "spawns")
    expect(before).toEqual([{ key: "spawns", direction: "asc" }])
  })
})

describe("removeSortRule", () => {
  it("removes only the requested priority", () => {
    expect(
      removeSortRule<"spawns" | "kills" | "name">([
        { key: "spawns", direction: "asc" },
        { key: "kills", direction: "desc" },
        { key: "name", direction: "asc" },
      ], "kills"),
    ).toEqual([
      { key: "spawns", direction: "asc" },
      { key: "name", direction: "asc" },
    ])
  })
})

describe("sortRows", () => {
  it("keeps the input order when there are no rules", () => {
    expect(sortRows(rows, []).map((row) => row.name)).toEqual(["B", "A", "C"])
  })

  it("applies every rule in priority order", () => {
    expect(
      sortRows(rows, [
        { key: "spawns", direction: "asc" },
        { key: "kills", direction: "desc" },
      ] as SortRule<keyof Row & string>[]).map((row) => row.name),
    ).toEqual(["A", "B", "C"])
  })

  it("reverses a descending rule", () => {
    expect(
      sortRows(rows, [{ key: "spawns", direction: "desc" } as SortRule<keyof Row & string>])
        .map((row) => row.name),
    ).toEqual(["C", "B", "A"])
  })

  it("compares strings case-insensitively and numerically", () => {
    const items = [{ name: "item 10" }, { name: "Item 2" }, { name: "item 1" }]
    expect(
      sortRows(items, [
        { key: "name", direction: "asc" } as SortRule<keyof typeof items[0] & string>,
      ])
        .map((item) => item.name),
    ).toEqual(["item 1", "Item 2", "item 10"])
  })

  it("is stable for rows that tie", () => {
    const tied: Row[] = [
      { name: "first", spawns: 1, kills: 0 },
      { name: "second", spawns: 1, kills: 0 },
      { name: "third", spawns: 1, kills: 0 },
    ]
    expect(sortRows(tied, [{ key: "spawns", direction: "asc" }]).map((row) => row.name))
      .toEqual(["first", "second", "third"])
  })

  it("does not reorder the input array", () => {
    const input = [...rows]
    sortRows(input, [{ key: "spawns", direction: "asc" } as SortRule<keyof Row & string>])
    expect(input.map((row) => row.name)).toEqual(["B", "A", "C"])
  })
})

describe("parseSort", () => {
  const allowed = ["name", "spawns", "kills"] as const
  const fallback: SortRule<typeof allowed[number]>[] = [{ key: "spawns", direction: "desc" }]

  it("reads a well-formed value", () => {
    expect(parseSort("spawns:asc,kills:desc", allowed, fallback)).toEqual([
      { key: "spawns", direction: "asc" },
      { key: "kills", direction: "desc" },
    ])
  })

  it("rejects unknown keys, duplicates and invalid directions", () => {
    expect(parseSort("kills:asc,nope:desc,kills:desc,name:up", allowed, fallback)).toEqual([
      { key: "kills", direction: "asc" },
    ])
  })

  it("falls back when nothing survives", () => {
    expect(parseSort("bad:value", allowed, fallback)).toEqual(fallback)
  })

  it("reads an absent value as 'not in the URL yet'", () => {
    expect(parseSort(null, allowed, fallback)).toEqual(fallback)
    expect(parseSort("", allowed, fallback)).toEqual(fallback)
  })

  it("reads the literal 'none' as sorting switched off", () => {
    expect(parseSort("none", allowed, fallback)).toEqual([])
  })

  it("ignores a direction with no key", () => {
    expect(parseSort(":asc", allowed, fallback)).toEqual(fallback)
  })
})

describe("serializeSort", () => {
  it("writes rules in priority order", () => {
    expect(serializeSort([
      { key: "spawns", direction: "asc" },
      { key: "kills", direction: "desc" },
    ])).toBe("spawns:asc,kills:desc")
  })

  it("writes 'none' for no rules, never an empty string", () => {
    expect(serializeSort([])).toBe("none")
  })

  it("round-trips through parseSort", () => {
    const rules: SortRule<"spawns" | "kills">[] = [
      { key: "spawns", direction: "asc" },
      { key: "kills", direction: "desc" },
    ]
    expect(parseSort(serializeSort(rules), ["spawns", "kills"], [])).toEqual(rules)
  })

  it("round-trips the switched-off state", () => {
    expect(parseSort(serializeSort([]), ["spawns"], [{ key: "spawns", direction: "desc" }]))
      .toEqual([])
  })
})
