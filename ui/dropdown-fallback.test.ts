import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { readFallback } from "./dropdown-fallback.ts"

/** A stand-in for a DOM element: only the fields `readFallback` may read, and no DOM global. */
function fakeElement(fields: Record<string, unknown>): Element {
  return fields as unknown as Element
}

describe("readFallback", () => {
  it("runs where the test DOM installs no element constructors as globals", () => {
    // The guard on the test itself: with a DOM library loaded, an `instanceof` check would pass.
    expect("HTMLDetailsElement" in globalThis).toBe(false)
    const summary = fakeElement({})
    const details = fakeElement({ localName: "details", open: true, firstElementChild: summary })

    expect(readFallback(details, null)).toEqual({ open: true, summaryFocused: false })
  })

  it("notices the fallback's summary had focus as it was swapped out", () => {
    const summary = fakeElement({})
    const details = fakeElement({ localName: "details", open: false, firstElementChild: summary })

    expect(readFallback(details, summary)).toEqual({ open: false, summaryFocused: true })
  })

  it("ignores focus outside the fallback's summary", () => {
    const details = fakeElement({
      localName: "details",
      open: false,
      firstElementChild: fakeElement({}),
    })

    expect(readFallback(details, fakeElement({}))?.summaryFocused).toBe(false)
  })

  it("reads nothing from an element that is not a details", () => {
    expect(readFallback(fakeElement({ localName: "div", open: true }), null)).toBeUndefined()
    expect(readFallback(null, null)).toBeUndefined()
  })
})
