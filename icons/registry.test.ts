import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { CATEGORY_ICONS, type IconName, ICONS } from "./registry.tsx"

/** A glyph returns a plain Preact vnode: its root `<svg>`'s props are all a test needs. */
interface VNode {
  props: Record<string, unknown>
}

const ids = Object.keys(ICONS) as IconName[]

describe("ICONS", () => {
  it("keys every glyph by a kebab-case id", () => {
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("gives every glyph an English name and lower-case aliases", () => {
    for (const id of ids) {
      const { name, aliases } = ICONS[id]
      expect(name.trim(), id).not.toBe("")
      expect(aliases.length, id).toBeGreaterThan(0)
      for (const alias of aliases) expect(alias, id).toBe(alias.toLowerCase().trim())
    }
  })

  it("draws every glyph at Lucide's stroke 2, never mirrored under right to left", () => {
    for (const id of ids) {
      const svg = (ICONS[id].Icon as unknown as (props: object) => VNode)({}).props
      expect(svg["stroke-width"], id).toBe("2")
      expect(String(svg.class), id).not.toContain("scaleX(-1)")
    }
  })
})

describe("CATEGORY_ICONS", () => {
  it("lists only ids that are in ICONS", () => {
    for (const id of CATEGORY_ICONS) expect(Object.hasOwn(ICONS, id), id).toBe(true)
  })

  it("lists 42 distinct ids", () => {
    expect(CATEGORY_ICONS).toHaveLength(42)
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length)
  })
})

describe("lucide.tsx", () => {
  it("names the pack and version in every glyph's JSDoc", async () => {
    const source = await Deno.readTextFile(new URL("./lucide.tsx", import.meta.url))
    const glyphs = [...source.matchAll(/\/\*\*([^*]*)\*\/\s*export function (\w+)/g)]
    expect(glyphs.length).toBeGreaterThan(0)
    for (const [, doc, name] of glyphs) expect(doc, name).toContain("lucide-static@1.47.0")
  })
})
