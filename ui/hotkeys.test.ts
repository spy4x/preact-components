import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { h } from "preact"
import { render } from "preact-render-to-string"
import {
  ariaKeyShortcuts,
  clickByHotkey,
  type HotkeyBinding,
  type HotkeyPress,
  pickHotkey,
  useHotkeys,
} from "./hotkeys.ts"

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

describe("ariaKeyShortcuts", () => {
  it("writes a letter in upper case, as aria-keyshortcuts names it", () => {
    expect(ariaKeyShortcuts("n", false)).toBe("N")
  })

  it("writes mod as Control outside Apple platforms and as Meta on them", () => {
    expect(ariaKeyShortcuts("mod+k", false)).toBe("Control+K")
    expect(ariaKeyShortcuts("mod+k", true)).toBe("Meta+K")
  })

  it("puts the modifiers first, in the order Control, Alt, Shift, Meta", () => {
    expect(ariaKeyShortcuts("meta+shift+alt+ctrl+s", false)).toBe("Control+Alt+Shift+Meta+S")
  })

  it("names keys the way KeyboardEvent.key spells them", () => {
    expect(ariaKeyShortcuts("esc", false)).toBe("Escape")
    expect(ariaKeyShortcuts("shift+pagedown", false)).toBe("Shift+PageDown")
    expect(ariaKeyShortcuts("up", false)).toBe("ArrowUp")
    expect(ariaKeyShortcuts("f2", false)).toBe("F2")
  })

  it("writes the space bar as Space and the plus key as Plus", () => {
    expect(ariaKeyShortcuts("shift+space", false)).toBe("Shift+Space")
    expect(ariaKeyShortcuts("mod++", false)).toBe("Control+Plus")
  })

  it("keeps a symbol as it is", () => {
    expect(ariaKeyShortcuts("?", false)).toBe("?")
  })

  it("throws on a combination useHotkeys could not read either", () => {
    expect(() => ariaKeyShortcuts("g i", false)).toThrow("sequence")
  })
})

/** What a fake button records and how it answers the questions `clickByHotkey` asks. */
interface FakeButton {
  clicks: number
  connected: boolean
  disabled: boolean
  inert: boolean
  rendered: boolean
}

/** A stand-in for a rendered, enabled button, overridden field by field. */
function fakeButton(fields: Partial<FakeButton> = {}): FakeButton & { element: HTMLElement } {
  const state: FakeButton = {
    clicks: 0,
    connected: true,
    disabled: false,
    inert: false,
    rendered: true,
    ...fields,
  }
  const element = {
    get isConnected() {
      return state.connected
    },
    matches: () => state.disabled,
    closest: (selector: string) => selector === "[inert]" && state.inert ? {} : null,
    getClientRects: () => state.rendered ? [{}] : [],
    contains: () => true,
    click: () => void state.clicks++,
  }
  return Object.assign(state, { element: element as unknown as HTMLElement })
}

/** A key press whose target sits in no dialog; `prevented` says whether it was cancelled. */
function keyEvent(target: unknown = null): KeyboardEvent & { prevented: boolean } {
  const event = {
    target,
    prevented: false,
    preventDefault: () => void (event.prevented = true),
  }
  return event as unknown as KeyboardEvent & { prevented: boolean }
}

describe("clickByHotkey", () => {
  it("clicks a rendered, enabled button and cancels the key press", () => {
    const button = fakeButton()
    const event = keyEvent()
    expect(clickByHotkey(button.element, event)).toBe(true)
    expect([button.clicks, event.prevented]).toEqual([1, true])
  })

  it("does nothing for an unmounted button, or none at all", () => {
    const button = fakeButton({ connected: false })
    const event = keyEvent()
    expect(clickByHotkey(button.element, event)).toBe(false)
    expect(clickByHotkey(null, event)).toBe(false)
    expect([button.clicks, event.prevented]).toEqual([0, false])
  })

  it("does nothing for a disabled button and leaves the key press alone", () => {
    const button = fakeButton({ disabled: true })
    const event = keyEvent()
    expect(clickByHotkey(button.element, event)).toBe(false)
    expect([button.clicks, event.prevented]).toEqual([0, false])
  })

  it("does nothing for a button inside inert content or not rendered", () => {
    for (const fields of [{ inert: true }, { rendered: false }]) {
      const button = fakeButton(fields)
      expect(clickByHotkey(button.element, keyEvent())).toBe(false)
      expect(button.clicks).toBe(0)
    }
  })

  it("does nothing for a button outside the dialog the key was pressed in", () => {
    const button = fakeButton()
    const dialog = { contains: () => false }
    const event = keyEvent({ closest: () => dialog })
    expect(clickByHotkey(button.element, event)).toBe(false)
    expect(button.clicks).toBe(0)
  })
})
