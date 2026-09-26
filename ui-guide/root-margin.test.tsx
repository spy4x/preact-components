/**
 * The "no outer margin" rule (#331): a component's root element carries no margin utility, so the
 * space between siblings is always the parent's gap, never a margin the component brought along.
 *
 * Every component the guide demonstrates is rendered through its demo, with Preact's `vnode` option
 * wrapping each exported component so the test sees what the component itself returns. The root's
 * classes minus the ones the caller passed in `class` are the component's own; a margin utility
 * among them fails, naming the component and the class. `auto` and `0` are not outer margins —
 * `mx-auto` centres, `mx-0` clears — so both are allowed. A margin a parent component passes to a
 * child it renders is the parent's inner spacing, which the rule allows; it is subtracted the same
 * way, because it arrives in the child's `class`.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type ComponentChildren, type ComponentType, Fragment, options, type VNode } from "preact"
import { render } from "preact-render-to-string"
import { isComponent, packageExports } from "./coverage.ts"
import { catalogueSections, demoRegistry, packageIds } from "./registry.ts"

/** A margin utility that pushes neighbours away: any variant, any side, not `auto` or `0`. */
const OUTER_MARGIN = /^!?(?:[^:\s]+:)*!?-?m[xytblrse]?-(?!auto!?$|0!?$)\S+$/

/** The classes in a `class` or `className` prop, one per entry. */
function classesOf(props: Record<string, unknown> | undefined): string[] {
  const value = props?.class ?? props?.className
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : []
}

/**
 * The class lists a component's output puts on its root: one per top-level element, looking
 * through fragments and arrays. A root that is another component contributes the `class` it is
 * given, since that is what lands on the inner component's root.
 */
function rootClassLists(out: ComponentChildren): string[][] {
  if (out === null || out === undefined || typeof out !== "object") return []
  if (Array.isArray(out)) return out.flatMap(rootClassLists)
  const vnode = out as VNode<Record<string, unknown>>
  if (vnode.type === Fragment) return rootClassLists(vnode.props.children as ComponentChildren)
  return [classesOf(vnode.props)]
}

/** One component that rendered a margin on its root. */
interface RootMargin {
  component: string
  className: string
}

/** What one render of a tree showed: the margins found, and every component that rendered. */
interface Observation {
  margins: RootMargin[]
  rendered: Set<string>
}

/**
 * Renders `tree` with every function in `components` observed, and returns each margin utility a
 * component put on its own root, with the names of the components that rendered at all. Class
 * components are left alone; the library has none.
 */
function observe(
  tree: () => ComponentChildren,
  components: ReadonlyMap<unknown, string>,
): Observation {
  const found: RootMargin[] = []
  const rendered = new Set<string>()
  const wrappers = new Map<unknown, unknown>()
  const wrap = (original: (props: Record<string, unknown>) => ComponentChildren, name: string) => {
    function Observed(this: unknown, props: Record<string, unknown>): ComponentChildren {
      const out = original.call(this, props)
      rendered.add(name)
      const callers = new Set(classesOf(props))
      for (const list of rootClassLists(out)) {
        for (const className of list) {
          if (!callers.has(className) && OUTER_MARGIN.test(className)) {
            found.push({ component: name, className })
          }
        }
      }
      return out
    }
    // Keeps the markers other `options` hooks look for, such as `forwardRef`'s symbol.
    return Object.assign(Observed, original)
  }
  const previous = options.vnode
  options.vnode = (vnode) => {
    const name = components.get(vnode.type)
    if (name !== undefined && typeof vnode.type === "function" && !vnode.type.prototype?.render) {
      if (!wrappers.has(vnode.type)) {
        wrappers.set(vnode.type, wrap(vnode.type as never, name))
      }
      ;(vnode as { type: unknown }).type = wrappers.get(vnode.type)
    }
    previous?.(vnode)
  }
  try {
    render(<>{tree()}</>)
  } finally {
    options.vnode = previous
  }
  return { margins: found, rendered }
}

/** The margins {@link observe} finds. */
function findRootMargins(
  tree: () => ComponentChildren,
  components: ReadonlyMap<unknown, string>,
): RootMargin[] {
  return observe(tree, components).margins
}

/**
 * Cards whose own component a server render never calls, so this test cannot see their root. Each
 * is held to the rule by review instead; the list is checked both ways, so an entry whose
 * component starts rendering fails until it is removed.
 */
const NOT_RENDERED_ON_THE_SERVER: Record<string, string> = {
  "ui/Modal": "its demo mounts the dialog only after a click opens it",
  "ui/ConfirmDialog": "its demo mounts the dialog only after a click opens it",
  "charts/D3LineChart": "the guide loads the d3 island only in the browser",
  "charts/CompareChart": "the guide loads the d3 island only in the browser",
  "map/Map": "the guide loads the Leaflet island only in the browser",
  "system/SEOHead": "its card prints the tag data instead of rendering a second <title>",
}

/** Every component the guide's component packages export, by function, with its package. */
async function libraryComponents(): Promise<Map<unknown, string>> {
  const exports = await packageExports()
  const components = new Map<unknown, string>()
  for (const id of packageIds) {
    for (const [name, value] of Object.entries(exports[id])) {
      if (isComponent(name, value)) components.set(value, `${id}/${name}`)
    }
  }
  return components
}

describe("no outer margin on a component's root", () => {
  it("finds no margin on the root of any component the guide demonstrates", async () => {
    const components = await libraryComponents()
    const names = catalogueSections.filter((section) => section.kind === "component")
      .flatMap((section) => section.names)
    const found = names.flatMap((name) =>
      findRootMargins(demoRegistry[name].render, components).map((margin) =>
        `${margin.component} renders ${margin.className} on its root (demo ${name})`
      )
    )
    expect([...new Set(found)]).toEqual([])
  })

  it("sees each card's own component render, bar the listed server-only ones", async () => {
    const components = await libraryComponents()
    const unseen = catalogueSections.filter((section) => section.kind === "component")
      .flatMap((section) =>
        section.names.filter((name) =>
          !observe(demoRegistry[name].render, components).rendered.has(`${section.package}/${name}`)
        ).map((name) => `${section.package}/${name}`)
      )
    expect(unseen).toEqual(Object.keys(NOT_RENDERED_ON_THE_SERVER))
  })
})

describe("findRootMargins", () => {
  const Spaced = (props: { class?: string }) => <div class={`my-4 p-4 ${props.class ?? ""}`} />
  const Centred = () => <div class="mx-auto max-w-md mt-0" />
  const Pair = () => (
    <>
      <p class="text-sm" />
      <p class="sm:-mt-2" />
    </>
  )
  const Inner = (props: { class?: string }) => <div class={props.class} />
  const Outer = () => (
    <div class="flex flex-col">
      <Inner class="mt-4" />
    </div>
  )
  const Wrapping = () => <Inner class="mb-6" />
  const components = new Map<unknown, string>([
    [Spaced, "Spaced"],
    [Centred, "Centred"],
    [Pair, "Pair"],
    [Inner, "Inner"],
    [Outer, "Outer"],
    [Wrapping, "Wrapping"],
  ] as [ComponentType<never>, string][])

  it("reports a margin a component puts on its own root", () => {
    expect(findRootMargins(() => <Spaced />, components)).toEqual([
      { component: "Spaced", className: "my-4" },
    ])
  })

  it("leaves auto and zero margins alone", () => {
    expect(findRootMargins(() => <Centred />, components)).toEqual([])
  })

  it("reads every top-level element of a fragment, variants included", () => {
    expect(findRootMargins(() => <Pair />, components)).toEqual([
      { component: "Pair", className: "sm:-mt-2" },
    ])
  })

  it("does not blame a component for a margin its caller passed in class", () => {
    expect(findRootMargins(() => <Spaced class="mt-8" />, components)).toEqual([
      { component: "Spaced", className: "my-4" },
    ])
    expect(findRootMargins(() => <Outer />, components)).toEqual([])
  })

  it("blames a component whose root is another component given a margin", () => {
    expect(findRootMargins(() => <Wrapping />, components)).toEqual([
      { component: "Wrapping", className: "mb-6" },
    ])
  })
})
