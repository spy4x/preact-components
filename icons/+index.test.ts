import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { IconProps } from "./+index.tsx"
import * as icons from "./+index.tsx"

/** Everything these components return is a plain Preact vnode — no renderer needed. */
interface VNode {
  type: unknown
  props: Record<string, unknown>
}

type IconComponent = (props: IconProps) => VNode

const iconEntries = Object.entries(icons).filter(([, value]) => typeof value === "function") as [
  string,
  IconComponent,
][]

const names = iconEntries.map(([name]) => name)

/** The size class every icon falls back to when the caller passes no class. */
const DEFAULT_SIZE = /(?:size-\d+(?:\.\d+)?|h-\d+(?:\.\d+)? w-auto)$/

function vnodeOf(name: string, props: IconProps): VNode {
  const icon = icons[name as keyof typeof icons] as IconComponent
  return icon(props)
}

/** Depth-first walk over a vnode tree, children included. */
function walk(node: unknown, visit: (node: VNode) => void): void {
  if (node === null || typeof node !== "object" || !("type" in node)) return
  const vnode = node as VNode
  visit(vnode)
  const children = vnode.props.children
  for (const child of Array.isArray(children) ? children : [children]) {
    walk(child, visit)
  }
}

function countElements(node: unknown): number {
  let count = 0
  walk(node, () => count++)
  return count
}

/** A canonical key for one glyph: element tree plus attributes, ignoring the class. */
function glyphKey(node: VNode): string {
  const parts: string[] = []
  walk(node, (vnode) => {
    const attributes = Object.entries(vnode.props)
      .filter(([key]) => key !== "class" && key !== "children")
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => `${key}=${value}`)
    parts.push(`<${String(vnode.type)} ${attributes.join(" ")}>`)
  })
  return parts.join("")
}

describe("icon set", () => {
  it("exports only Icon-prefixed components", () => {
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name).toMatch(/^Icon[A-Z0-9]/)
    }
  })

  it("exports the full merged set under unique names", () => {
    // Two same-named `export function`s are rejected at type-check time (TS2393); a name
    // that slipped through would collapse in the module namespace and shrink this count.
    // The number is the documented total in README.md — bump both when adding a glyph.
    // Deliberately a literal, never `Object.keys(icons).length`: a guard derived from the
    // module would shrink with the thing it polices and catch nothing.
    expect(names.length).toBe(122)
    expect(new Set(names).size).toBe(names.length)
  })

  it("ships no two exports with the same glyph", () => {
    const keys = iconEntries.map(([name]) => glyphKey(vnodeOf(name, {})))
    // Grouped by glyph so a failure names the collision instead of only its count: a duplicate
    // body merged under a second name is the one regression this suite exists to stop.
    const byGlyph = new Map<string, string[]>()
    for (const [index, key] of keys.entries()) {
      const group = byGlyph.get(key) ?? []
      group.push(iconEntries[index][0])
      byGlyph.set(key, group)
    }
    const collisions = [...byGlyph.values()].filter((group) => group.length > 1)
    expect(collisions, `duplicate glyph bodies: ${JSON.stringify(collisions)}`).toEqual([])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("renders every icon without throwing", () => {
    for (const [name] of iconEntries) {
      const node = vnodeOf(name, {})
      expect(node.type).toBe("svg")
      expect(node.props.xmlns).toBe("http://www.w3.org/2000/svg")
      expect(node.props.viewBox).toBeTruthy()
      expect(node.props.children).toBeTruthy()
      // the root plus at least one drawing element
      expect(countElements(node)).toBeGreaterThan(1)
    }
  })

  it("defaults every icon to shrink-0 and a size", () => {
    for (const [name] of iconEntries) {
      const className = vnodeOf(name, {}).props.class as string
      expect(className).toContain("shrink-0")
      expect(className).toMatch(DEFAULT_SIZE)
    }
  })

  it("reflects a class prop in the rendered output", () => {
    for (const [name] of iconEntries) {
      const defaultSize = (vnodeOf(name, {}).props.class as string).match(DEFAULT_SIZE)?.[0] ?? ""
      const className = vnodeOf(name, { class: "text-red-500 size-8" }).props.class as string
      expect(className).toContain("shrink-0")
      expect(className).toContain("text-red-500 size-8")
      // a caller override replaces the default size rather than adding to it
      expect(className).not.toContain(defaultSize)
    }
  })

  it("hides every icon from screen readers when the caller gives no name", () => {
    for (const [name] of iconEntries) {
      const { props } = vnodeOf(name, {})
      expect(props["aria-hidden"], name).toBe("true")
      expect(props.role, name).toBeUndefined()
      expect(props["aria-label"], name).toBeUndefined()
    }
  })

  it("turns every icon into a labelled image when given aria-label", () => {
    for (const [name] of iconEntries) {
      const { props } = vnodeOf(name, { "aria-label": "Search" })
      expect(props.role, name).toBe("img")
      expect(props["aria-label"], name).toBe("Search")
      expect(props["aria-hidden"], name).toBeUndefined()
    }
  })

  it("names every icon with a first-child <title> when given title", () => {
    for (const [name] of iconEntries) {
      const { props } = vnodeOf(name, { title: "Delete" })
      expect(props.role, name).toBe("img")
      expect(props["aria-hidden"], name).toBeUndefined()
      const children = props.children as unknown[]
      const first = (Array.isArray(children) ? children[0] : children) as VNode
      expect(first.type, name).toBe("title")
      expect(first.props.children, name).toBe("Delete")
    }
  })

  it("renders no <title> for an icon without a title", () => {
    for (const [name] of iconEntries) {
      const titles: VNode[] = []
      walk(vnodeOf(name, { "aria-label": "Search" }), (vnode) => {
        if (vnode.type === "title") titles.push(vnode)
      })
      expect(titles, name).toEqual([])
    }
  })

  it("still lets a class replace the default size on a labelled icon", () => {
    for (const [name] of iconEntries) {
      const defaultSize = (vnodeOf(name, {}).props.class as string).match(DEFAULT_SIZE)?.[0] ?? ""
      const className = vnodeOf(name, { class: "size-8", "aria-label": "Search" }).props
        .class as string
      expect(className, name).toContain("shrink-0 size-8")
      expect(className, name).not.toContain(defaultSize)
    }
  })

  it("fills the seven solid glyphs and strokes every other one, in the text colour", () => {
    // Paint as the browser resolves it for each drawn element: its own attribute, else the root's
    // (no glyph nests a group), else SVG's defaults — a black fill and no stroke.
    const filled = new Set([
      "IconGitHub",
      "IconTelegram",
      "IconUpwork",
      "IconTwitter",
      "IconYouTube",
      "IconLockClosedFilled",
      "IconPlaySolid",
    ])
    const wrong: string[] = []
    for (const [name] of iconEntries) {
      const root = vnodeOf(name, {})
      const expected = filled.has(name)
        ? { fill: "currentColor", stroke: "none" }
        : { fill: "none", stroke: "currentColor" }
      walk(root, (node) => {
        if (node === root || node.type === "title") return
        const fill = node.props.fill ?? root.props.fill ?? "black"
        const stroke = node.props.stroke ?? root.props.stroke ?? "none"
        if (fill !== expected.fill || stroke !== expected.stroke) {
          wrong.push(`${name} <${String(node.type)}> fill=${fill} stroke=${stroke}`)
        }
      })
    }
    expect(wrong).toEqual([])
  })

  it("fills IconStar solid in the text colour when filled, over the outline's own drawing", () => {
    const outline = icons.IconStar({}) as unknown as VNode
    const solid = icons.IconStar({ filled: true }) as unknown as VNode
    expect(outline.props.fill).toBe("none")
    expect(solid.props.fill).toBe("currentColor")
    // The stroke stays, so the solid star covers the outline's footprint exactly rather than
    // shrinking by half a stroke on every side.
    expect(solid.props.stroke).toBe("currentColor")
    expect(solid.props["stroke-width"]).toBe(outline.props["stroke-width"])
    // Same glyph otherwise: only the root's fill differs.
    const withoutFill = (node: VNode) => glyphKey({ ...node, props: { ...node.props, fill: "" } })
    expect(withoutFill(solid)).toBe(withoutFill(outline))
  })

  it("keeps animated icons spinning whatever class the caller passes", () => {
    for (const name of ["IconLoading", "IconSpinner"]) {
      const className = vnodeOf(name, { class: "size-8" }).props.class as string
      expect(className).toContain("animate-spin")
      expect(className).toContain("size-8")
    }
  })
})
