import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { effect, signal } from "@preact/signals-core"
import { patchSignal } from "./patch-signal.ts"

describe("patchSignal", () => {
  it("merges the patch into the signal's value", () => {
    const s = signal({ name: "Ann", age: 30 })
    patchSignal(s, { age: 31 })
    expect(s.value).toEqual({ name: "Ann", age: 31 })
  })

  it("preserves keys the patch does not mention", () => {
    const s = signal({ a: 1, b: 2, c: 3 })
    patchSignal(s, { b: 9 })
    expect(s.value).toEqual({ a: 1, b: 9, c: 3 })
  })

  it("writes a new object rather than mutating the old one", () => {
    const before = { count: 1 }
    const s = signal(before)
    patchSignal(s, { count: 2 })
    expect(s.value).not.toBe(before)
    expect(before).toEqual({ count: 1 })
  })

  it("notifies subscribers exactly once per call", () => {
    const s = signal({ count: 0 })
    let calls = 0
    const unsubscribe = s.subscribe(() => {
      calls++
    })
    calls = 0 // subscribe() itself fires once with the current value; count only the patch
    patchSignal(s, { count: 1 })
    unsubscribe()
    expect(calls).toBe(1)
  })

  it("still writes and notifies once for an empty patch", () => {
    const before = { a: 1 }
    const s = signal(before)
    let calls = 0
    const unsubscribe = s.subscribe(() => {
      calls++
    })
    calls = 0
    patchSignal(s, {})
    unsubscribe()
    expect(s.value).toEqual({ a: 1 })
    expect(s.value).not.toBe(before)
    expect(calls).toBe(1)
  })

  it("refuses a null value", () => {
    const s = signal(null as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("refuses an array value", () => {
    const s = signal([1, 2, 3] as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("refuses a primitive value", () => {
    const s = signal("hello" as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("refuses a Date value", () => {
    const s = signal(new Date() as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("refuses a Map value", () => {
    const s = signal(new Map() as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("refuses a user-defined class instance", () => {
    class Point {
      x = 0
      y = 0
    }
    const s = signal(new Point() as unknown as Record<string, unknown>)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
  })

  it("does not write when it refuses", () => {
    const before = new Date(2020, 0, 1) as unknown as Record<string, unknown>
    const s = signal(before)
    expect(() => patchSignal(s, { a: 1 })).toThrow(TypeError)
    expect(s.value).toBe(before)
  })

  it("accepts a value created with Object.create(null), merging into an ordinary object", () => {
    const before = Object.assign(Object.create(null), { a: 1 }) as { a: number }
    const s = signal(before)
    patchSignal(s, { a: 2 })
    expect(s.value).toEqual({ a: 2 })
    // The null prototype is not carried forward: the spread always builds an ordinary object.
    expect(Object.getPrototypeOf(s.value)).toBe(Object.prototype)
  })

  it("refuses a null patch", () => {
    const s = signal({ a: 1 })
    expect(() => patchSignal(s, null as unknown as Partial<{ a: number }>)).toThrow(TypeError)
  })

  it("refuses an array patch", () => {
    const s = signal({ a: 1 })
    expect(() => patchSignal(s, [7, 8] as unknown as Partial<{ a: number }>)).toThrow(TypeError)
  })

  it("does not write when the patch is refused", () => {
    const before = { a: 1 }
    const s = signal(before)
    expect(() => patchSignal(s, [7, 8] as unknown as Partial<{ a: number }>)).toThrow(TypeError)
    expect(s.value).toBe(before)
  })

  it("does not throw when called inside an effect reacting to another signal", () => {
    const trigger = signal(0)
    const s = signal({ n: 0 })
    let runs = 0
    const dispose = effect(() => {
      runs++
      // Reads trigger.value (tracked) and writes s through patchSignal, which reads s untracked
      // (signal.peek()). A tracked read of s here would subscribe this effect to its own write and
      // throw "Cycle detected" after Preact's re-run limit.
      patchSignal(s, { n: trigger.value })
    })
    runs = 0 // effect() itself runs once on creation; count only the reactions below
    trigger.value = 1
    trigger.value = 2
    dispose()
    expect(runs).toBe(2)
    expect(s.value).toEqual({ n: 2 })
  })
})
