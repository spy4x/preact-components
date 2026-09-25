import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconHome } from "@spy4x/preact-icons"
import { RailShell, type RailShellItem, tabBarSlots } from "./rail-shell.tsx"

/** `count` items keyed `i1`…, each a link to `/i1`…. */
function itemsOf(count: number): RailShellItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `i${index + 1}`,
    label: `Item ${index + 1}`,
    href: `/i${index + 1}`,
  }))
}

const primary: RailShellItem = { key: "new", label: "New post", href: "/new" }

/** The markup inside the first element carrying this `data-e2e`, up to the element's own close. */
function region(html: string, e2e: string, tag: string): string {
  const start = html.indexOf(`data-e2e="${e2e}"`)
  if (start < 0) return ""
  const end = html.indexOf(`</${tag}>`, start)
  return html.slice(start, end)
}

/** Every `<a …href="…">` opening tag in `html` for one `href`. */
function linkTags(html: string, href: string): string[] {
  return [...html.matchAll(new RegExp(`<a[^>]*href="${href}"[^>]*>`, "g"))].map((m) => m[0])
}

/** Labels of the tab bar's entries and "More", in order. */
function tabLabels(html: string): string[] {
  const bar = region(html, "rail-shell-tabbar", "nav")
  return [...bar.matchAll(/<span class="[^"]*">([^<]+)<\/span>/g)].map((m) => m[1])
}

describe("tabBarSlots", () => {
  it("shows five items as tabs with no More slot", () => {
    const split = tabBarSlots(itemsOf(5))
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "i3", "i4", "i5"])
    expect(split.more).toEqual([])
  })

  it("keeps four tabs and moves the rest behind More once there are six items", () => {
    const split = tabBarSlots(itemsOf(6))
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "i3", "i4"])
    expect(split.more.map((item) => item.key)).toEqual(["i5", "i6"])
  })

  it("gives the primary action the last tab when four items leave room for it", () => {
    const split = tabBarSlots(itemsOf(4), primary)
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "i3", "i4", "new"])
    expect(split.more).toEqual([])
  })

  it("puts the primary action first behind More when five items fill the bar", () => {
    const split = tabBarSlots(itemsOf(5), primary)
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "i3", "i4"])
    expect(split.more.map((item) => item.key)).toEqual(["new", "i5"])
  })
})

describe("RailShell", () => {
  it("draws every item in the rail, primary action first, with the page in main", () => {
    const html = render(
      <RailShell items={itemsOf(3)} primary={primary}>
        <p>page body</p>
      </RailShell>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    const order = [...rail.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(order).toEqual(["/new", "/i1", "/i2", "/i3"])
    expect(region(html, "rail-shell-content", "main")).toContain("page body")
  })

  it("marks the item matching currentKey as the current page in the rail and the tab bar", () => {
    const html = render(<RailShell items={itemsOf(3)} currentKey="i2">page</RailShell>)
    const current = linkTags(html, "/i2")
    expect(current).toHaveLength(2)
    for (const tag of current) expect(tag).toContain('aria-current="page"')
    for (const tag of [...linkTags(html, "/i1"), ...linkTags(html, "/i3")]) {
      expect(tag).not.toContain("aria-current")
    }
  })

  it("marks the item whose href equals currentPath as the current page", () => {
    const html = render(<RailShell items={itemsOf(3)} currentPath="/i3">page</RailShell>)
    for (const tag of linkTags(html, "/i3")) expect(tag).toContain('aria-current="page"')
    for (const tag of linkTags(html, "/i1")) expect(tag).not.toContain("aria-current")
  })

  it("renders no More button and no dialog with five items", () => {
    const html = render(<RailShell items={itemsOf(5)}>page</RailShell>)
    expect(tabLabels(html)).toEqual(["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"])
    expect(html).not.toContain('data-e2e="rail-shell-more"')
    expect(html).not.toContain("<dialog")
  })

  it("renders four tabs, a More button and a dialog holding the rest with six items", () => {
    const html = render(<RailShell items={itemsOf(6)} primary={primary}>page</RailShell>)
    expect(tabLabels(html)).toEqual(["Item 1", "Item 2", "Item 3", "Item 4", "More"])
    const dialog = region(html, "rail-shell-dialog", "dialog")
    const inDialog = [...dialog.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(inDialog).toEqual(["/new", "/i5", "/i6"])
  })

  it("points the More button at the dialog and names the dialog by its heading", () => {
    const html = render(<RailShell items={itemsOf(6)}>page</RailShell>)
    const more = html.match(/<button[^>]*data-e2e="rail-shell-more"[^>]*>/)?.[0] ?? ""
    const dialogId = html.match(/<dialog[^>]*id="([^"]+)"/)?.[1]
    expect(dialogId).toBeDefined()
    expect(more).toContain(`aria-controls="${dialogId}"`)
    expect(more).toContain(`commandfor="${dialogId}"`)
    expect(more).toContain('aria-haspopup="dialog"')
    const headingId = html.match(/<dialog[^>]*aria-labelledby="([^"]+)"/)?.[1]
    expect(html).toContain(`<h2 id="${headingId}"`)
  })

  it("highlights More when the current page is behind it, and only then", () => {
    const moreTag = (html: string) =>
      html.match(/<button[^>]*data-e2e="rail-shell-more"[^>]*>/)?.[0] ?? ""
    const behind = render(<RailShell items={itemsOf(7)} currentKey="i6">page</RailShell>)
    expect(moreTag(behind)).toContain("font-semibold")
    expect(moreTag(behind)).not.toContain("aria-current")
    const inBar = render(<RailShell items={itemsOf(7)} currentKey="i2">page</RailShell>)
    expect(moreTag(inBar)).not.toContain("font-semibold")
  })

  it("prints English defaults for every label", () => {
    const html = render(<RailShell items={itemsOf(6)}>page</RailShell>)
    expect(html.match(/aria-label="Main navigation"/g)).toHaveLength(2)
    expect(tabLabels(html)).toContain("More")
    expect(region(html, "rail-shell-dialog", "h2")).toContain(">More")
    expect(html).toContain('aria-label="Close"')
    expect(html).toContain(">Skip to content</a>")
  })

  it("prints the caller's labels in place of every default", () => {
    const html = render(
      <RailShell
        items={itemsOf(6)}
        labels={{
          nav: "Site",
          more: "Plus",
          moreDialog: "Autres pages",
          close: "Fermer",
          skipToContent: "Aller au contenu",
        }}
      >
        page
      </RailShell>,
    )
    expect(html.match(/aria-label="Site"/g)).toHaveLength(2)
    expect(tabLabels(html)).toContain("Plus")
    expect(region(html, "rail-shell-dialog", "h2")).toContain(">Autres pages")
    expect(html).toContain('aria-label="Fermer"')
    expect(html).toContain(">Aller au contenu</a>")
    for (const word of ["Main navigation", ">More<", 'aria-label="Close"', "Skip to content"]) {
      expect(html).not.toContain(word)
    }
  })

  it("renders an item without href as a button and hides its icon from assistive technology", () => {
    const html = render(
      <RailShell items={[{ key: "home", label: "Home", Icon: IconHome }]}>page</RailShell>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(rail).toContain('<button type="button"')
    expect(rail).not.toContain("<a ")
    expect(rail).toMatch(/<span class="[^"]*" aria-hidden="true"><svg/)
  })
})
