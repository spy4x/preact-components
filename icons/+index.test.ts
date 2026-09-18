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
    expect(names.length).toBe(101)
    expect(new Set(names).size).toBe(names.length)
  })

  it("ships no two exports with the same glyph", () => {
    const keys = iconEntries.map(([name]) => glyphKey(vnodeOf(name, {})))
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

  it("keeps animated icons spinning whatever class the caller passes", () => {
    for (const name of ["IconLoading", "IconSpinner"]) {
      const className = vnodeOf(name, { class: "size-8" }).props.class as string
      expect(className).toContain("animate-spin")
      expect(className).toContain("size-8")
    }
  })
})
