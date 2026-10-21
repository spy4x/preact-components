import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  LayoutCustomiser,
  mergeLayout,
  moveLayoutEntry,
  setLayoutHidden,
} from "./layout-customiser.tsx"

describe("mergeLayout", () => {
  it("gives every available part, shown, in its default order when nothing is saved", () => {
    expect(mergeLayout(undefined, ["a", "b"])).toEqual([
      { id: "a", hidden: false },
      { id: "b", hidden: false },
    ])
  })

  it("keeps the saved order and hidden flags", () => {
    expect(mergeLayout([{ id: "b", hidden: true }, { id: "a", hidden: false }], ["a", "b"]))
      .toEqual([{ id: "b", hidden: true }, { id: "a", hidden: false }])
  })

  it("drops an id that no longer exists, a repeat and an entry that is not one", () => {
    const saved = [{ id: "gone", hidden: true }, { id: "a", hidden: true }, { id: "a" }, 7, null, {
      id: 3,
    }]
    expect(mergeLayout(saved, ["a"])).toEqual([{ id: "a", hidden: true }])
  })

  it("adds a part the saved layout does not name at the end, shown", () => {
    expect(mergeLayout([{ id: "b", hidden: true }], ["a", "b", "c"])).toEqual([
      { id: "b", hidden: true },
      { id: "a", hidden: false },
      { id: "c", hidden: false },
    ])
  })

  it("reads a saved value that is not a list as nothing saved", () => {
    expect(mergeLayout({ id: "a" }, ["a"])).toEqual([{ id: "a", hidden: false }])
  })
})

describe("layout changes", () => {
  const layout = [{ id: "a", hidden: false }, { id: "b", hidden: false }, { id: "c", hidden: true }]

  it("hides or shows one entry and leaves the rest", () => {
    expect(setLayoutHidden(layout, "b", true).map((entry) => entry.hidden)).toEqual([
      false,
      true,
      true,
    ])
    expect(setLayoutHidden(layout, "c", false)[2]).toEqual({ id: "c", hidden: false })
  })

  it("moves an entry from one index to another", () => {
    expect(moveLayoutEntry(layout, 2, 0).map((entry) => entry.id)).toEqual(["c", "a", "b"])
    expect(moveLayoutEntry(layout, 0, 2).map((entry) => entry.id)).toEqual(["b", "c", "a"])
  })

  it("leaves the layout as it was for an index that does not exist", () => {
    expect(moveLayoutEntry(layout, 5, 0)).toEqual(layout)
  })
})

describe("LayoutCustomiser", () => {
  const items = [
    { id: "a", title: "Notes", hidden: false },
    { id: "b", title: "Notes over time", hidden: true },
  ]
  const html = (error?: string) =>
    render(
      <LayoutCustomiser
        open
        onClose={() => {}}
        title="Customise overview"
        description="Choose which widgets you see."
        items={items}
        onChange={() => {}}
        onReset={() => {}}
        error={error}
        labels={{ list: "Widgets" }}
      />,
    )

  it("names a switch per row by the part it shows, on for a shown part and off for a hidden one", () => {
    const markup = html()
    const switches = markup.match(/<button[^>]*role="switch"[^>]*>/g) ?? []
    expect(switches.length).toBe(2)
    expect(switches[0]).toContain('aria-checked="true"')
    expect(switches[0]).toContain('aria-label="Show Notes"')
    expect(switches[1]).toContain('aria-checked="false"')
    expect(markup).toContain("Show Notes over time")
    expect(markup).toContain(">Hidden<")
  })

  it("offers Reset to default and Done, and names the list", () => {
    const markup = html()
    expect(markup).toContain(">Reset to default<")
    expect(markup).toContain(">Done<")
    expect(markup).toContain('aria-label="Widgets"')
  })

  it("shows a failed save as an alert under the list, and nothing when there is none", () => {
    expect(html("We could not save your layout.")).toContain(
      '<p role="alert" class="text-sm text-danger">We could not save your layout.</p>',
    )
    expect(html()).not.toContain("text-danger")
  })
})
