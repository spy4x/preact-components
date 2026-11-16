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

  it("keeps a described row without keys", () => {
    expect(groupShortcuts([{ description: "Export data" }], "General")).toEqual([
      { title: "General", shortcuts: [{ description: "Export data" }] },
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

  it("draws the footer below the list, in the dialog's footer", () => {
    const html = render(
      <ShortcutsDialog
        open
        onClose={() => {}}
        shortcuts={shortcuts}
        footer={<p>Shortcuts don't work while you type.</p>}
      />,
    )
    expect(html).toMatch(
      /<\/dl>.*<footer[^>]*><p>Shortcuts don(&#39;|')t work while you type.<\/p><\/footer>/s,
    )
    expect(render(<ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts} />))
      .not.toContain("<footer")
  })

  it("lists each described shortcut as a term and its keys", () => {
    const html = render(
      <ShortcutsDialog open onClose={() => {}} shortcuts={shortcuts} apple={false} />,
    )
    expect(html).toMatch(
      /<dt class="[^"]*">Search<\/dt><dd class="shrink-0"><kbd[^>]*><kbd[^>]*>Ctrl<\/kbd>/,
    )
    expect(html).not.toContain(">X</kbd>")
  })

  it("lists a row without keys as a term with no keys after it", () => {
    for (const keys of [undefined, ""]) {
      const html = render(
        <ShortcutsDialog
          open
          onClose={() => {}}
          shortcuts={[{ keys, description: "Export data" }]}
        />,
      )
      expect(html).toMatch(/<dt class="[^"]*">Export data<\/dt><\/div>/)
      expect(html).not.toContain("<dd")
      expect(html).not.toContain("<kbd")
    }
  })

  it("draws a row's detail inside its term, after the description, in muted small text", () => {
    const html = render(
      <ShortcutsDialog
        open
        onClose={() => {}}
        shortcuts={[{ description: "Export data", detail: "download, backup, csv" }]}
      />,
    )
    expect(html).toMatch(
      /<dt class="[^"]*">Export data<span class="block text-xs text-muted">download, backup, csv<\/span><\/dt>/,
    )
  })

  it("lets a long description wrap beside keys that keep their width", () => {
    const html = render(
      <ShortcutsDialog
        open
        onClose={() => {}}
        shortcuts={[{ keys: "mod+k", description: "Search" }]}
      />,
    )
    expect(html).toMatch(/<dt class="[^"]*\bmin-w-0\b[^"]*\bwrap-anywhere\b[^"]*">/)
    expect(html).toContain('<dd class="shrink-0">')
  })

  it("lists a sequence row with its presses joined by then", () => {
    const html = render(
      <ShortcutsDialog
        open
        onClose={() => {}}
        shortcuts={[{ keys: "g t", description: "Go to Today" }]}
        apple={false}
      />,
    )
    expect(html).toMatch(
      />Go to Today<\/dt><dd[^>]*><kbd[^>]*><kbd[^>]*>G<\/kbd> then <kbd[^>]*>T<\/kbd>/,
    )
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
