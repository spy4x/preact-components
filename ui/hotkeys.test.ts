import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { h } from "preact"
import { render } from "preact-render-to-string"
import {
  activeShortcuts,
  ariaKeyShortcuts,
  clickByHotkey,
  createHotkeyListener,
  firesInFields,
  type HotkeyBinding,
  hotkeyClickBinding,
  type HotkeyPress,
  isSingleKey,
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

  it("skips a sequence, which needs the presses before this one", () => {
    expect(pickHotkey([binding("g i")], press("i"), false)).toBeUndefined()
  })

  it("throws on a binding whose combination cannot be read", () => {
    expect(() => pickHotkey([binding("ctrl+")], press("g"), false)).toThrow("empty part")
  })
})

describe("useHotkeys", () => {
  it("renders with a sequence, and throws on a sequence with a press it cannot read", () => {
    const Bound = ({ keys }: { keys: string }) => {
      useHotkeys([binding(keys)])
      return null
    }
    expect(render(h(Bound, { keys: "g i" }))).toBe("")
    expect(() => render(h(Bound, { keys: "g ctrl+" }))).toThrow("empty part")
  })

  it("throws during render on a combination it cannot read, before any key is pressed", () => {
    function Page() {
      useHotkeys([binding("mod+k"), binding("ctrl+")])
      return h("p", null, "page")
    }
    expect(() => render(h(Page, null))).toThrow("empty part")
  })
})

/** A press for {@link createHotkeyListener}, with what it ran and whether it was cancelled. */
interface ListenerPress {
  key: string
  ctrlKey?: boolean
  target?: unknown
  timeStamp?: number
  defaultPrevented?: boolean
}

/**
 * A listener over `bindings`, each recording its keys when it runs. `press` sends one key press and
 * returns whether the listener cancelled it.
 */
function listen(bindings: HotkeyBinding[]) {
  const ran: string[] = []
  let current = bindings.map((b) => ({ ...b, handler: () => void ran.push(b.keys) }))
  const listener = createHotkeyListener(() => current, false)
  const send = (
    { key, ctrlKey = false, target = null, timeStamp = 0, defaultPrevented = false }: ListenerPress,
  ): boolean => {
    let cancelled = false
    listener({
      key,
      code: "",
      ctrlKey,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      isComposing: false,
      keyCode: 0,
      target,
      timeStamp,
      defaultPrevented,
      preventDefault: () => void (cancelled = true),
    } as unknown as KeyboardEvent)
    return cancelled
  }
  const replace = (next: HotkeyBinding[]) => {
    current = next.map((b) => ({ ...b, handler: () => void ran.push(b.keys) }))
  }
  return { ran, send, replace }
}

/** A target inside an element that `selector`-matching `closest` reports for `part`. */
function inside(part: string): unknown {
  return { closest: (selector: string) => selector.includes(part) ? {} : null }
}

describe("createHotkeyListener", () => {
  it("runs a single key and cancels its default action", () => {
    const { ran, send } = listen([binding("n")])
    expect(send({ key: "n" })).toBe(true)
    expect(send({ key: "x" })).toBe(false)
    expect(ran).toEqual(["n"])
  })

  it("runs a sequence on its second key, and its first key alone runs nothing", () => {
    const { ran, send } = listen([binding("g i")])
    expect(send({ key: "g", timeStamp: 0 })).toBe(false)
    expect(ran).toEqual([])
    expect(send({ key: "i", timeStamp: 500 })).toBe(true)
    expect(ran).toEqual(["g i"])
    expect(send({ key: "i", timeStamp: 600 })).toBe(false)
    expect(ran).toEqual(["g i"])
  })

  it("drops a first key the second one follows more than a second later", () => {
    const { ran, send } = listen([binding("g i")])
    send({ key: "g", timeStamp: 0 })
    send({ key: "i", timeStamp: 1500 })
    expect(ran).toEqual([])
  })

  it("lets a completed sequence win over a binding of its last key", () => {
    const { ran, send } = listen([binding("i"), binding("g i")])
    send({ key: "g", timeStamp: 0 })
    send({ key: "i", timeStamp: 100 })
    send({ key: "i", timeStamp: 200 })
    expect(ran).toEqual(["g i", "i"])
  })

  it("runs no sequence while the reader types in a field, even with inFields", () => {
    const field = { tagName: "INPUT", type: "text", closest: () => null }
    const { ran, send } = listen([binding("g i", { inFields: true })])
    send({ key: "g", target: field })
    send({ key: "i", target: field, timeStamp: 100 })
    expect(ran).toEqual([])
  })

  it("runs nothing inside a menu unless the binding opts in, sequences never", () => {
    const menu = inside("[role='menu']")
    const { ran, send } = listen([
      binding("n"),
      binding("g i", { inDialogs: true }),
      binding("?", { inDialogs: true }),
    ])
    send({ key: "n", target: menu })
    send({ key: "g", target: menu })
    send({ key: "i", target: menu, timeStamp: 100 })
    send({ key: "?", target: menu })
    expect(ran).toEqual(["?"])
  })

  it("runs nothing while a modal dialog is open unless the binding opts in", () => {
    const own = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: (selector: string) => selector === "dialog:modal" ? {} : null },
    })
    try {
      const { ran, send } = listen([
        binding("n"),
        binding("g i"),
        binding("?", { inDialogs: true }),
      ])
      send({ key: "n" })
      send({ key: "g" })
      send({ key: "i", timeStamp: 100 })
      send({ key: "?" })
      expect(ran).toEqual(["?"])
    } finally {
      if (own) Object.defineProperty(globalThis, "document", own)
      else delete (globalThis as { document?: unknown }).document
    }
  })

  it("leaves a press another handler cancelled alone", () => {
    const { ran, send } = listen([binding("n")])
    send({ key: "n", defaultPrevented: true })
    expect(ran).toEqual([])
  })

  it("reads the latest bindings on each press, sequences included", () => {
    const { ran, send, replace } = listen([binding("g i")])
    send({ key: "x", timeStamp: 0 })
    replace([binding("g t")])
    send({ key: "g", timeStamp: 100 })
    send({ key: "i", timeStamp: 200 })
    expect(ran).toEqual([])
    send({ key: "g", timeStamp: 300 })
    send({ key: "t", timeStamp: 400 })
    expect(ran).toEqual(["g t"])
  })
})

describe("isSingleKey", () => {
  it("is true for plain keys and sequences of them", () => {
    expect(["?", "/", "n", "shift+n", "g i"].map(isSingleKey)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it("is false for Control, Command, mod or Alt, and for Escape and Enter", () => {
    expect(["mod+k", "ctrl+g", "meta+g", "alt+n", "esc", "enter", "g mod+i"].map(isSingleKey))
      .toEqual([false, false, false, false, false, false, false])
  })
})

describe("activeShortcuts", () => {
  const rows = [{ keys: "?" }, { keys: "mod+k" }, { keys: "g i" }, { keys: "esc" }]

  it("keeps every shortcut while single keys are on", () => {
    expect(activeShortcuts(rows, true)).toEqual(rows)
  })

  it("drops the single keys while they are off", () => {
    expect(activeShortcuts(rows, false)).toEqual([{ keys: "mod+k" }, { keys: "esc" }])
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
function keyEvent(target: unknown = null, repeat = false): KeyboardEvent & { prevented: boolean } {
  const event = {
    target,
    repeat,
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

  it("clicks a hidden element while the element shown for it is rendered", () => {
    const item = fakeButton({ rendered: false })
    const trigger = fakeButton()
    expect(clickByHotkey(item.element, keyEvent(), trigger.element)).toBe(true)
    expect(item.clicks).toBe(1)
    const hiddenTrigger = fakeButton({ rendered: false })
    expect(clickByHotkey(item.element, keyEvent(), hiddenTrigger.element)).toBe(false)
    expect(clickByHotkey(item.element, keyEvent(), null)).toBe(false)
    expect(item.clicks).toBe(1)
  })

  it("does nothing for a disabled element even while the element shown for it is rendered", () => {
    const item = fakeButton({ disabled: true, rendered: false })
    expect(clickByHotkey(item.element, keyEvent(), fakeButton().element)).toBe(false)
    expect(item.clicks).toBe(0)
  })

  it("cancels a held key's repeats without clicking again", () => {
    const button = fakeButton()
    const event = keyEvent(null, true)
    expect(clickByHotkey(button.element, event)).toBe(true)
    expect([button.clicks, event.prevented]).toEqual([0, true])
  })

  it("clicks only a button inside the open modal dialog for a press on the page body", () => {
    const outside = fakeButton()
    const inside = fakeButton()
    const modal = { contains: (node: unknown) => node === inside.element }
    const body = { closest: () => null }
    const saved = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: (selector: string) => selector === "dialog:modal" ? modal : null },
    })
    try {
      expect(clickByHotkey(outside.element, keyEvent(body))).toBe(false)
      expect(clickByHotkey(inside.element, keyEvent(body))).toBe(true)
    } finally {
      if (saved === undefined) delete (globalThis as { document?: unknown }).document
      else Object.defineProperty(globalThis, "document", saved)
    }
    expect([outside.clicks, inside.clicks]).toEqual([0, 1])
  })

  it("does nothing for a button outside the dialog the key was pressed in", () => {
    const button = fakeButton()
    const dialog = { contains: () => false }
    const event = keyEvent({ closest: () => dialog })
    expect(clickByHotkey(button.element, event)).toBe(false)
    expect(button.clicks).toBe(0)
  })
})

describe("firesInFields", () => {
  it("lets a Control, Command or mod chord fire in a text field", () => {
    for (const keys of ["mod+k", "ctrl+k", "meta+k", "mod+shift+p", "ctrl+alt+k"]) {
      expect([keys, firesInFields(keys)]).toEqual([keys, true])
    }
  })

  it("keeps a plain key and an Alt chord out of a text field, since both type text", () => {
    for (const keys of ["/", "k", "shift+k", "alt+p", "alt+shift+p"]) {
      expect([keys, firesInFields(keys)]).toEqual([keys, false])
    }
  })

  it("leaves the field its editing chords, such as mod+z", () => {
    for (const keys of ["mod+a", "mod+c", "mod+v", "mod+x", "mod+z", "mod+y", "mod+shift+z"]) {
      expect([keys, firesInFields(keys)]).toEqual([keys, false])
    }
  })
})

describe("hotkeyClickBinding", () => {
  it("fires in a text field for a combination holding Control, Command or mod", () => {
    for (const keys of ["mod+enter", "ctrl+s", "meta+k"]) {
      const bound = hotkeyClickBinding(keys, () => null)
      const key = keys.endsWith("enter") ? "Enter" : keys.slice(-1)
      const held = { ctrlKey: !keys.startsWith("meta"), metaKey: keys.startsWith("meta") }
      expect(pickHotkey([bound], press(key, { typing: true, ...held }), false)).toBe(bound)
    }
  })

  it("leaves the field's editing chords such as mod+z to the field", () => {
    for (const keys of ["mod+z", "mod+shift+z", "ctrl+c", "meta+v", "mod+x", "mod+a", "mod+y"]) {
      const bound = hotkeyClickBinding(keys, () => null)
      const key = keys.slice(-1)
      const held = {
        ctrlKey: !keys.startsWith("meta"),
        metaKey: keys.startsWith("meta"),
        shiftKey: keys.includes("shift"),
      }
      expect(pickHotkey([bound], press(key, { typing: true, ...held }), false)).toBeUndefined()
      expect(pickHotkey([bound], press(key, held), false)).toBe(bound)
    }
    const send = hotkeyClickBinding("mod+enter", () => null)
    expect(pickHotkey([send], press("Enter", { typing: true, ctrlKey: true }), false)).toBe(send)
  })

  it("leaves a plain key or an Alt combination typed in a text field alone", () => {
    for (const keys of ["n", "shift+n", "alt+n"]) {
      const bound = hotkeyClickBinding(keys, () => null)
      const held = { shiftKey: keys.startsWith("shift"), altKey: keys.startsWith("alt") }
      expect(pickHotkey([bound], press("n", { typing: true, ...held }), false)).toBeUndefined()
      expect(pickHotkey([bound], press("n", held), false)).toBe(bound)
    }
  })

  it("fires inside a dialog and leaves the key press for clickByHotkey to cancel", () => {
    const bound = hotkeyClickBinding("n", () => null)
    expect(pickHotkey([bound], press("n", { inDialog: true }), false)).toBe(bound)
    expect(bound.preventDefault).toBe(false)
  })

  it("clicks the element it reads when the key is pressed", () => {
    const button = fakeButton()
    const bound = hotkeyClickBinding("n", () => button.element)
    bound.handler(keyEvent())
    expect(button.clicks).toBe(1)
  })

  it("clicks a hidden element through the element it reads as shown", () => {
    const item = fakeButton({ rendered: false })
    const trigger = fakeButton()
    hotkeyClickBinding("n", () => item.element)
      .handler(keyEvent())
    hotkeyClickBinding("n", () => item.element, () => trigger.element).handler(keyEvent())
    expect(item.clicks).toBe(1)
  })
})
