import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { groupShortcuts, type Shortcut, ShortcutsDialog } from "./shortcuts-dialog.tsx"

const shortcuts: Shortcut[] = [
  { keys: "?", description: "Show shortcuts" },
  { keys: "mod+k", description: "Search", group: "Navigation" },
  { keys: "x" },
  { keys: "n", description: "New task" },
]

describe("groupShortcuts", () => {
  it("groups in first-seen order, puts ungrouped rows in the default group, drops undescribed", () => {
    expect(groupShortcuts(shortcuts, "General")).toEqual([
      {
        title: "General",
        shortcuts: [
          { keys: "?", description: "Show shortcuts" },
          { keys: "n", description: "New task" },
        ],
      },
      {
        title: "Navigation",
        shortcuts: [{ keys: "mod+k", description: "Search", group: "Navigation" }],
      },
    ])
  })
})

describe("ShortcutsDialog", () => {
  it("names the dialog and its close button with English defaults", () => {
    const html = render(<ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts} />)
    expect(html).toMatch(/<h2 id="[^"]+" class="[^"]*">Keyboard shortcuts<\/h2>/)
    expect(html).toContain('aria-label="Close"')
  })

  it("takes its title, close label and default group from props", () => {
    const html = render(
      <ShortcutsDialog
        open
        onClose={() => {}}
        shortcuts={shortcuts}
        title="Tastenkürzel"
        closeLabel="Schließen"
        defaultGroup="Allgemein"
      />,
    )
    expect(html).toContain(">Tastenkürzel</h2>")
    expect(html).toContain('aria-label="Schließen"')
    expect(html).toContain(">Allgemein</h3>")
  })

  it("lists each described shortcut as a term and its keys", () => {
    const html = render(
      <ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts} apple={false} />,
    )
    expect(html).toMatch(/<dt class="[^"]*">Search<\/dt><dd><kbd[^>]*><kbd[^>]*>Ctrl<\/kbd>/)
    expect(html).not.toContain(">X</kbd>")
  })

  it("shows group headings only when there is more than one group", () => {
    const grouped = render(<ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts} />)
    expect(grouped).toContain(">General</h3>")
    expect(grouped).toContain(">Navigation</h3>")
    const single = render(
      <ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts.slice(0, 1)} />,
    )
    expect(single).not.toContain("<h3")
  })
})
