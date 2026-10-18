import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type Focusable, focusBefore, focusOnClose } from "./palette-focus.ts"

/** A stand-in element that records what was done to it. */
function element(name: string, log: string[], drawn = true, connected = true): Focusable {
  return {
    focus: () => void log.push(`focus ${name}`),
    blur: () => void log.push(`blur ${name}`),
    getClientRects: () => ({ length: drawn ? 1 : 0 }),
    isConnected: connected,
  }
}

describe("focusOnClose", () => {
  it("gives focus back to the trigger while it is drawn", () => {
    const log: string[] = []
    focusOnClose(element("trigger", log), element("before", log), element("field", log))
    expect(log).toEqual(["focus trigger"])
  })

  it("gives focus back to what had it before the palette opened while the trigger is hidden", () => {
    const log: string[] = []
    focusOnClose(element("trigger", log, false), element("before", log), element("field", log))
    expect(log).toEqual(["focus before"])
  })

  it("takes focus off the field when the trigger is hidden and nothing in the page had it", () => {
    for (const before of [null, element("gone", [], true, false)]) {
      const log: string[] = []
      focusOnClose(element("trigger", log, false), before, element("field", log))
      expect(log).toEqual(["blur field"])
    }
  })
})

describe("focusBefore", () => {
  it("keeps the focused element, and nothing when only the page's body had focus", () => {
    const body = {}
    const button = {}
    expect(focusBefore(button, body)).toBe(button)
    expect(focusBefore(body, body)).toBeNull()
    expect(focusBefore(null, body)).toBeNull()
  })
})
