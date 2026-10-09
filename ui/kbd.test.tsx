import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Kbd, KBD_LABELS, keyFaces } from "./kbd.tsx"
import { sequenceSteps } from "./kbd-keys.tsx"

/** The text of rendered markup with its tags and its hidden glyphs dropped. */
function textWithoutGlyphs(html: string): string {
  return html.replace(/<span aria-hidden="true">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "")
}

describe("sequenceSteps", () => {
  it("splits a sequence at whitespace but keeps spaces around a plus in one combination", () => {
    expect(sequenceSteps("g t")).toEqual(["g", "t"])
    expect(sequenceSteps("  g   mod+shift+k  ")).toEqual(["g", "mod+shift+k"])
    expect(sequenceSteps("mod  + k")).toEqual(["mod  + k"])
    expect(sequenceSteps("mod +  k")).toEqual(["mod +  k"])
    expect(sequenceSteps("mod + k")).toEqual(["mod + k"])
    expect(sequenceSteps("?")).toEqual(["?"])
  })
})

describe("keyFaces", () => {
  it("draws mod as Ctrl outside Apple platforms and as a named ⌘ on them", () => {
    expect(keyFaces("mod+k", false)).toEqual([{ text: "Ctrl" }, { text: "K" }])
    expect(keyFaces("mod+k", true)).toEqual([{ text: "⌘", name: "Command" }, { text: "K" }])
  })

  it("orders the modifiers the way each platform writes them", () => {
    expect(keyFaces("mod+shift+alt+ctrl+p", true).map((face) => face.text))
      .toEqual(["⌃", "⌥", "⇧", "⌘", "P"])
    expect(keyFaces("shift+alt+mod+p", false).map((face) => face.text))
      .toEqual(["Ctrl", "Alt", "Shift", "P"])
  })

  it("names the arrow glyphs and writes other named keys as words", () => {
    expect(keyFaces("up", false)).toEqual([{ text: "↑", name: "Up arrow" }])
    expect(["esc", "space", "enter", "f2", "pagedown", "?"].map((keys) => keyFaces(keys, false)[0]))
      .toEqual([
        { text: "Esc" },
        { text: "Space" },
        { text: "Enter" },
        { text: "F2" },
        { text: "Pagedown" },
        { text: "?" },
      ])
  })

  it("takes its words from the labels it is given", () => {
    const labels = { ...KBD_LABELS, command: "Befehl", ctrl: "Strg" }
    expect(keyFaces("mod+k", true, labels)[0]).toEqual({ text: "⌘", name: "Befehl" })
    expect(keyFaces("mod+k", false, labels)[0]).toEqual({ text: "Strg" })
  })
})

describe("Kbd", () => {
  it("renders a combination as one kbd holding a kbd per key, joined by plus", () => {
    const html = render(<Kbd keys="mod+k" apple={false} />)
    expect(html).toMatch(/^<kbd class="[^"]*"><kbd class="[^"]*">Ctrl<\/kbd><span>\+<\/span><kbd/)
    expect(html).toMatch(/>K<\/kbd><\/kbd>$/)
  })

  it("hides the ⌘ glyph from screen readers and says Command instead", () => {
    const html = render(<Kbd keys="mod+k" apple />)
    expect(html).toContain(
      '<span aria-hidden="true">⌘</span><span class="sr-only">Command</span>',
    )
    expect(html).not.toContain("<span>+</span>")
  })

  it("draws Ctrl on the server when the platform is left to the browser, even on a Mac", () => {
    // Pretend to be a Mac for this render only: a Kbd that read the platform during render would
    // draw ⌘ here, and the browser's first render would then disagree with the server's.
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {
      value: { platform: "MacIntel" },
      configurable: true,
    })
    try {
      const html = render(<Kbd keys="mod+k" />)
      expect(html).toContain(">Ctrl</kbd>")
      expect(html).not.toContain("⌘")
    } finally {
      if (original === undefined) delete (globalThis as { navigator?: unknown }).navigator
      else Object.defineProperty(globalThis, "navigator", original)
    }
  })

  it("renders a single key as one kbd, and children as they are", () => {
    expect(render(<Kbd keys="?" class="extra" />)).toMatch(/^<kbd class="[^"]* extra">\?<\/kbd>$/)
    expect(render(<Kbd>Tab</Kbd>)).toMatch(/^<kbd class="[^"]*">Tab<\/kbd>$/)
  })

  it("reads a sequence as its presses with then between them, spaces included", () => {
    const html = render(<Kbd keys="g t" apple={false} class="extra" />)
    expect(textWithoutGlyphs(html)).toBe("G then T")
    expect(html).toMatch(/^<kbd class="[^"]* extra"><kbd class="[^"]*">G<\/kbd> then <kbd/)
  })

  it("draws each press of a sequence as its own combination, glyph names included", () => {
    expect(textWithoutGlyphs(render(<Kbd keys="g mod+k" apple />))).toBe("G then CommandK")
    expect(textWithoutGlyphs(render(<Kbd keys="g mod+k" apple={false} />))).toBe("G then Ctrl+K")
  })

  it("takes the word between presses from its labels", () => {
    expect(textWithoutGlyphs(render(<Kbd keys="g t" labels={{ then: "dann" }} />))).toBe("G dann T")
  })

  it("throws on a sequence with a press it cannot read", () => {
    expect(() => render(<Kbd keys="g mod+" />)).toThrow()
  })

  it("passes its labels through to the keys", () => {
    expect(render(<Kbd keys="mod+k" apple labels={{ command: "Befehl" }} />))
      .toContain('<span class="sr-only">Befehl</span>')
  })
})
