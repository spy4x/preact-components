import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { deleteMapEntry, setMapEntry } from "./map-entry.ts"

describe("setMapEntry", () => {
  it("returns a new map holding the entry", () => {
    const before = new Map([["a", 1]])
    const after = setMapEntry(before, "b", 2)
    expect(after.get("b")).toBe(2)
    expect(after).not.toBe(before)
  })

  it("leaves the input map untouched", () => {
    const before = new Map([["a", 1]])
    setMapEntry(before, "b", 2)
    expect([...before.keys()]).toEqual(["a"])
  })

  it("replaces an existing key without disturbing the others", () => {
    const before = new Map([["a", 1], ["b", 2]])
    const after = setMapEntry(before, "a", 9)
    expect([...after]).toEqual([["a", 9], ["b", 2]])
    expect(before.get("a")).toBe(1)
  })

  it("starts an empty map from nothing", () => {
    expect(setMapEntry(new Map<string, number>(), "a", 1).get("a")).toBe(1)
  })
})

describe("deleteMapEntry", () => {
  it("returns a new map without the key", () => {
    const before = new Map([["a", 1], ["b", 2]])
    const after = deleteMapEntry(before, "a")
    expect([...after.keys()]).toEqual(["b"])
    expect([...before.keys()]).toEqual(["a", "b"])
  })

  it("is a no-op for a key that was never there", () => {
    const before = new Map([["a", 1]])
    expect([...deleteMapEntry(before, "zzz").keys()]).toEqual(["a"])
  })
})
