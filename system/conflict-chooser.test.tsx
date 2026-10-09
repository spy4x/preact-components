import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ConflictChooser, type ConflictItem } from "./conflict-chooser.tsx"

const noop = () => {}

/** The visible label of each button inside the item with `id`, in order. */
function buttonsOf(html: string, id: string): string[] {
  const item = html.match(new RegExp(`data-conflict-id="${id}".*?</li>`))?.[0] ?? ""
  return [...item.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "")
  )
}

const conflicts: ConflictItem[] = [
  { id: "1", label: "Buy milk", reason: "version" },
  { id: "2", label: "Call Ana", reason: "gone" },
  { id: "3", label: "Pay rent", reason: "rejected", message: "You can no longer edit this list." },
]

describe("ConflictChooser", () => {
  it("explains each reason in plain words", () => {
    const html = render(
      <ConflictChooser conflicts={conflicts} onKeepMine={noop} onUseTheirs={noop} />,
    )

    expect(html).toContain("3 changes need your choice")
    expect(html).toContain("Changed elsewhere while you were offline.")
    expect(html).toContain("Deleted elsewhere while you were offline.")
    expect(html).toContain("You can no longer edit this list.")
  })

  it("offers keep mine and use theirs for a change made elsewhere", () => {
    const html = render(
      <ConflictChooser conflicts={conflicts} onKeepMine={noop} onUseTheirs={noop} />,
    )

    expect(buttonsOf(html, "1")).toEqual(["Keep mine", "Use theirs"])
  })

  it("offers only to discard an item deleted elsewhere", () => {
    const html = render(
      <ConflictChooser conflicts={conflicts} onKeepMine={noop} onUseTheirs={noop} />,
    )

    expect(buttonsOf(html, "2")).toEqual(["Discard mine"])
  })

  it("offers to restore a deleted item that opts in with canKeepMine", () => {
    const html = render(
      <ConflictChooser
        conflicts={[{ ...conflicts[1], canKeepMine: true }]}
        onKeepMine={noop}
        onUseTheirs={noop}
      />,
    )

    expect(buttonsOf(html, "2")).toEqual(["Restore mine", "Discard mine"])
  })

  it("renders its heading at the level asked for", () => {
    const html = render(
      <ConflictChooser
        conflicts={conflicts}
        onKeepMine={noop}
        onUseTheirs={noop}
        headingLevel={3}
      />,
    )

    expect(html).toMatch(/<h3 id="[^"]+" tabindex="-1"[^>]*>3 changes need your choice<\/h3>/)
    expect(html).not.toContain("<h2")
  })

  it("offers only to discard a change the server refused", () => {
    const html = render(
      <ConflictChooser conflicts={conflicts} onKeepMine={noop} onUseTheirs={noop} />,
    )

    expect(buttonsOf(html, "3")).toEqual(["Discard mine"])
  })

  it("names the list by its heading and merges the caller's words per reason", () => {
    const html = render(
      <ConflictChooser
        conflicts={conflicts.slice(0, 1)}
        onKeepMine={noop}
        onUseTheirs={noop}
        labels={{ useTheirs: { version: "Take the server's" } }}
      />,
    )

    const labelledBy = html.match(/<section aria-labelledby="([^"]+)"/)?.[1]
    expect(html).toContain(`<h2 id="${labelledBy}"`)
    expect(buttonsOf(html, "1")).toEqual(["Keep mine", "Take the server's"])
  })

  it("says nothing in its live region on a first render with nothing to resolve", () => {
    const html = render(<ConflictChooser conflicts={[]} onKeepMine={noop} onUseTheirs={noop} />)

    expect(html).toContain('<p role="status" aria-live="polite" class="sr-only"></p>')
    expect(html).not.toContain("<ul")
  })
})
