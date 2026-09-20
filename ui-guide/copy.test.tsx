/**
 * The copy control on every usage block — issue #30, and every snippet block #29 added with it.
 *
 * `ui/CopyButton` does the copying; what this suite checks is the wiring `ui-guide` owns: that every
 * card renders a copy control, that the control is handed that card's own snippet, and that the
 * caller's clipboard port reaches it. There is no DOM harness in this repository, so the assertions
 * are made on the element tree a card returns — the props level — rather than by clicking. The
 * handler `CopyButton` builds from those props belongs to `ui/copy-button.test.tsx`, and the browser
 * phase of `pages/checks/ui-guide.ts` is what proves a real click writes the block's text.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { CopyButton, copyToClipboard } from "@preact-components/ui/copy-button"
import { render } from "preact-render-to-string"
import { DemoCard, type DemoCardProps, UIGuide } from "./+index.tsx"
import { catalogueNames, classDemos, demoRegistry } from "./registry.ts"

/** A clipboard port, in the shape `UIGuideProps.copy` takes. */
type CopyPort = (text: string) => void | Promise<void>

/** One element of a vnode tree, reduced to what these assertions read. */
interface Element {
  type: unknown
  props: Record<string, unknown>
}

/**
 * The props of one element, in the shape its component declares.
 *
 * A vnode tree carries no types of its own, so the gap is closed here once instead of at every use:
 * the walk cannot know that a `DemoCard` element's props are {@link DemoCardProps}.
 *
 * @param element Element found by {@link elementsIn}.
 * @returns Its props, typed as the caller knows them to be.
 */
function propsOf<T>(element: Element): T {
  return element.props as unknown as T
}

/**
 * Every element in a vnode tree, depth-first, without rendering anything.
 *
 * A component element's own children exist only once that component runs, so the walk stops at each
 * card and the card is invoked explicitly — which is what makes this an assertion about what
 * `ui-guide` passes down rather than a render of the whole page.
 *
 * @param node A vnode, or an array of them, as a component returns.
 * @returns The elements found, parents before children.
 */
function elementsIn(node: unknown): Element[] {
  const found: Element[] = []

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      for (const child of current) visit(child)
      return
    }
    if (typeof current !== "object" || current === null) return

    const element = current as { type?: unknown; props?: Record<string, unknown> }
    if (element.type === undefined || element.props === undefined) return

    found.push({ type: element.type, props: element.props })
    visit(element.props.children)
  }

  visit(node)
  return found
}

/** One card's copy control, and what the card handed it. */
interface WiredCopy {
  name: string
  /** The text the control was handed. */
  textToCopy: string
  /** The port the control was handed; `undefined` when the guide was rendered without one. */
  copy: unknown
}

/**
 * The copy control of every card the catalogue renders, read off the element tree.
 *
 * @param copy Clipboard port to hand the guide, as a host app would.
 * @returns One entry per card, in render order.
 */
function wiredCopies(copy?: CopyPort): WiredCopy[] {
  return elementsIn(UIGuide({ copy }))
    .filter((element) => element.type === DemoCard)
    .flatMap((card) => {
      const props = propsOf<DemoCardProps>(card)
      const control = elementsIn(DemoCard(props)).find((element) => element.type === CopyButton)
      if (!control) return []

      const controlProps = propsOf<{ textToCopy: string; copy: unknown }>(control)
      return [{ name: props.name, textToCopy: controlProps.textToCopy, copy: controlProps.copy }]
    })
}

/** Undo the entity encoding `preact-render-to-string` applies to an attribute value. */
function decodeAttribute(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
}

describe("usage block copy controls", () => {
  it("gives every catalogue card a copy control", () => {
    const wired = wiredCopies(() => {})

    expect(catalogueNames.length).toBeGreaterThan(30)
    expect(wired.map((entry) => entry.name)).toEqual(catalogueNames)
  })

  it("hands each control its own card's block text", () => {
    for (const { name, textToCopy } of wiredCopies(() => {})) {
      expect(textToCopy, name).toBe(demoRegistry[name].snippet)
      expect(textToCopy.length, name).toBeGreaterThan(10)
    }
  })

  it("threads the clipboard port the guide was rendered with into every control", () => {
    const port: CopyPort = () => {}
    const other: CopyPort = () => {}

    for (const { name, copy } of wiredCopies(port)) {
      expect(copy, `${name} did not get the port`).toBe(port)
      expect(copy, `${name} got a port nobody passed`).not.toBe(other)
    }
  })

  it("leaves the control to the library's own clipboard fallback without a port", () => {
    // The deployed page renders `<UIGuide />` with no port; `CopyButton` then uses
    // `navigator.clipboard`, which is what makes copying work there without host wiring.
    for (const { name, copy } of wiredCopies()) {
      expect(copy, name).toBeUndefined()
    }
  })

  it("routes a card's block text through the port unchanged", () => {
    // The pairing a click makes: `CopyButton` calls `copyToClipboard(textToCopy, copy)`. Driving it
    // with the two values read off the element tree is what turns those props into a clipboard call.
    const copied: string[] = []
    const port: CopyPort = (text) => void copied.push(text)

    for (const { name, textToCopy } of wiredCopies(port)) {
      copied.length = 0
      copyToClipboard(textToCopy, port)
      expect(copied, name).toEqual([demoRegistry[name].snippet])
    }
  })

  it("labels every control for assistive tech with the card it belongs to", () => {
    const html = render(<UIGuide />)
    const labels = [...html.matchAll(/aria-label="Copy the ([^"]*) snippet"/g)]
      .map((match) => decodeAttribute(match[1]))

    expect(labels.length).toBe(catalogueNames.length)
    for (const name of catalogueNames) {
      // A component card names the component, a class card its title; either way no control is one
      // of thirty identical "Copy" buttons to a screen reader.
      expect(labels, name).toContain(classDemos[name]?.title ?? `<${name} />`)
    }
  })
})
