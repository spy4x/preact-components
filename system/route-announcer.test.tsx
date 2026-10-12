import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { pageHeading, useRouteAnnouncer } from "./route-announcer.ts"

/** A layout the way an app calls the hook: once, above the page, with the router's path. */
function Layout({ path }: { path: string }) {
  useRouteAnnouncer({ path, title: "Inbox — Acme" })
  return (
    <main>
      <h1>Inbox</h1>
    </main>
  )
}

describe("useRouteAnnouncer", () => {
  it("renders on a server, where there is no document", () => {
    expect("document" in globalThis).toBe(false)
    expect(render(<Layout path="/inbox?filter=open" />)).toBe("<main><h1>Inbox</h1></main>")
  })
})

/**
 * The few element methods `pageHeading` calls, on a tree built by hand: these tests run where
 * there is no document. `pages/e2e/system.spec.ts` proves the same in a browser.
 */
class FakeElement {
  readonly attributes = new Map<string, string>()
  readonly children: FakeElement[]
  constructor(readonly tag: string, ...children: FakeElement[]) {
    this.children = children
  }
  querySelector(tag: string): FakeElement | null {
    for (const child of this.children) {
      const found = child.tag === tag ? child : child.querySelector(tag)
      if (found) return found
    }
    return null
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }
}

/** Run `body` with `root` as the document, then take the document away again. */
function withDocument(root: FakeElement, body: () => void): void {
  const scope = globalThis as { document?: unknown }
  scope.document = root
  try {
    body()
  } finally {
    delete scope.document
  }
}

/** `pageHeading()` as the fake element it found. */
const found = (main?: FakeElement) =>
  pageHeading(main as unknown as HTMLElement | undefined) as unknown as FakeElement | null

describe("pageHeading", () => {
  it("returns the first h1 inside main and makes it focusable from script", () => {
    const heading = new FakeElement("h1")
    const main = new FakeElement("main", new FakeElement("div", heading), new FakeElement("h1"))
    withDocument(new FakeElement("body", main), () => {
      expect(found()).toBe(heading)
      expect(heading.attributes.get("tabindex")).toBe("-1")
      expect(main.hasAttribute("tabindex")).toBe(false)
    })
  })

  it("returns main while the page has no h1", () => {
    const main = new FakeElement("main", new FakeElement("p"))
    withDocument(new FakeElement("body", main), () => {
      expect(found()).toBe(main)
      expect(main.attributes.get("tabindex")).toBe("-1")
    })
  })

  it("returns null when the document has no main", () => {
    withDocument(new FakeElement("body", new FakeElement("h1")), () => {
      expect(found()).toBe(null)
    })
  })

  it("keeps a tabindex the heading already has", () => {
    const heading = new FakeElement("h1")
    heading.setAttribute("tabindex", "0")
    withDocument(new FakeElement("body", new FakeElement("main", heading)), () => {
      expect(found()).toBe(heading)
      expect(heading.attributes.get("tabindex")).toBe("0")
    })
  })

  it("ignores an h1 outside main", () => {
    const outside = new FakeElement("h1")
    const main = new FakeElement("main")
    withDocument(new FakeElement("body", new FakeElement("header", outside), main), () => {
      expect(found()).toBe(main)
      expect(outside.hasAttribute("tabindex")).toBe(false)
    })
  })

  it("looks inside the element it is given instead of the document's main", () => {
    const heading = new FakeElement("h1")
    const region = new FakeElement("div", heading)
    const main = new FakeElement("main", new FakeElement("h1"), region)
    withDocument(new FakeElement("body", main), () => {
      expect(found(region)).toBe(heading)
    })
  })

  it("returns null on a server, where there is no document", () => {
    expect("document" in globalThis).toBe(false)
    expect(pageHeading()).toBe(null)
  })
})
