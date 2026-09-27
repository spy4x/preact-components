import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { h } from "preact"
import { render } from "preact-render-to-string"
import { type HotkeyBinding, type HotkeyPress, pickHotkey, useHotkeys } from "./hotkeys.ts"

/** A binding that does nothing, overridden field by field. */
function binding(keys: string, fields: Partial<HotkeyBinding> = {}): HotkeyBinding {
  return { keys, handler: () => {}, ...fields }
}

/** A key press outside any field or dialog with no modifier held, overridden field by field. */
function press(key: string, fields: Partial<HotkeyPress> = {}): HotkeyPress {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    typing: false,
    inDialog: false,
    ...fields,
  }
}

describe("pickHotkey", () => {
  it("runs the first binding whose combination matches", () => {
    const first = binding("?")
    const second = binding("?")
    expect(pickHotkey([binding("/"), first, second], press("?", { shiftKey: true }), false))
      .toBe(first)
  })

  it("tells a modifier combination from the plain key of the same letter", () => {
    const plain = binding("i")
    const combo = binding("mod+i")
    expect(pickHotkey([plain, combo], press("i"), false)).toBe(plain)
    expect(pickHotkey([plain, combo], press("i", { ctrlKey: true }), false)).toBe(combo)
    expect(pickHotkey([plain, combo], press("i", { metaKey: true }), true)).toBe(combo)
  })

  it("leaves a key press in a text field alone unless the binding opts in", () => {
    expect(pickHotkey([binding("?")], press("?", { typing: true }), false)).toBeUndefined()
    const opted = binding("esc", { inFields: true })
    expect(pickHotkey([opted], press("Escape", { typing: true }), false)).toBe(opted)
  })

  it("leaves a key press inside a dialog alone unless the binding opts in", () => {
    expect(pickHotkey([binding("?")], press("?", { inDialog: true }), false)).toBeUndefined()
    const opted = binding("?", { inDialogs: true })
    expect(pickHotkey([opted], press("?", { inDialog: true }), false)).toBe(opted)
  })

  it("throws on a binding whose combination cannot be read", () => {
    expect(() => pickHotkey([binding("g i")], press("g"), false)).toThrow("sequence")
  })
})

describe("useHotkeys", () => {
  it("throws during render on a combination it cannot read, before any key is pressed", () => {
    function Page() {
      useHotkeys([binding("mod+k"), binding("g i")])
      return h("p", null, "page")
    }
    expect(() => render(h(Page, null))).toThrow('The hotkey "g i" holds a sequence')
  })
})
