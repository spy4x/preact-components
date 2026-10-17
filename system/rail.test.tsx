import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconHome } from "@spy4x/preact-icons"
import { Rail, type RailItem, tabBarSlots } from "./rail.tsx"

/** `count` items keyed `i1`…, each a link to `/i1`…. */
function itemsOf(count: number): RailItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `i${index + 1}`,
    label: `Item ${index + 1}`,
    href: `/i${index + 1}`,
  }))
}

const primary: RailItem = { key: "new", label: "New post", href: "/new" }

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

  it("puts the primary action in the centre slot when four items leave room for it", () => {
    const split = tabBarSlots(itemsOf(4), primary)
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "new", "i3", "i4"])
    expect(split.more).toEqual([])
  })

  it("keeps the last slot for the sheet when told to, even when every item would fit", () => {
    const split = tabBarSlots(itemsOf(5), undefined, true)
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "i3", "i4"])
    expect(split.more.map((item) => item.key)).toEqual(["i5"])
    expect(tabBarSlots(itemsOf(3), undefined, true).more).toEqual([])
  })

  it("keeps the primary action a tab in the centre when the items overflow the bar", () => {
    const split = tabBarSlots(itemsOf(5), primary)
    expect(split.tabs.map((item) => item.key)).toEqual(["i1", "i2", "new", "i3"])
    expect(split.more.map((item) => item.key)).toEqual(["i4", "i5"])
  })

  it("centres the primary action in a short bar too", () => {
    expect(tabBarSlots(itemsOf(2), primary).tabs.map((item) => item.key))
      .toEqual(["i1", "new", "i2"])
    expect(tabBarSlots(itemsOf(2), primary, true).tabs.map((item) => item.key))
      .toEqual(["i1", "new", "i2"])
  })
})

describe("Rail", () => {
  it("draws every item in the rail, primary action first, with the page in main", () => {
    const html = render(
      <Rail items={itemsOf(3)} primary={primary}>
        <p>page body</p>
      </Rail>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    const order = [...rail.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(order).toEqual(["/new", "/i1", "/i2", "/i3"])
    expect(region(html, "rail-shell-content", "main")).toContain("page body")
  })

  it("marks the item matching currentKey as the current page in the rail and the tab bar", () => {
    const html = render(<Rail items={itemsOf(3)} currentKey="i2">page</Rail>)
    const current = linkTags(html, "/i2")
    expect(current).toHaveLength(2)
    for (const tag of current) expect(tag).toContain('aria-current="page"')
    for (const tag of [...linkTags(html, "/i1"), ...linkTags(html, "/i3")]) {
      expect(tag).not.toContain("aria-current")
    }
  })

  it("marks the item whose href equals currentPath as the current page", () => {
    const html = render(<Rail items={itemsOf(3)} currentPath="/i3">page</Rail>)
    for (const tag of linkTags(html, "/i3")) expect(tag).toContain('aria-current="page"')
    for (const tag of linkTags(html, "/i1")) expect(tag).not.toContain("aria-current")
  })

  it("renders no More button and no dialog with five items", () => {
    const html = render(<Rail items={itemsOf(5)}>page</Rail>)
    expect(tabLabels(html)).toEqual(["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"])
    expect(html).not.toContain('data-e2e="rail-shell-more"')
    expect(html).not.toContain("<dialog")
  })

  it("renders the primary action in the centre tab and the rest in the sheet with six items", () => {
    const html = render(<Rail items={itemsOf(6)} primary={primary}>page</Rail>)
    expect(tabLabels(html)).toEqual(["Item 1", "Item 2", "New post", "Item 3", "More"])
    const dialog = region(html, "rail-shell-dialog", "dialog")
    const inDialog = [...dialog.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(inDialog).toEqual(["/i4", "/i5", "/i6"])
  })

  it("points the More button at the dialog and names the dialog by its heading", () => {
    const html = render(<Rail items={itemsOf(6)}>page</Rail>)
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
    const behind = render(<Rail items={itemsOf(7)} currentKey="i6">page</Rail>)
    expect(moreTag(behind)).toContain("font-semibold")
    expect(moreTag(behind)).not.toContain("aria-current")
    const inBar = render(<Rail items={itemsOf(7)} currentKey="i2">page</Rail>)
    expect(moreTag(inBar)).not.toContain("font-semibold")
  })

  it("prints English defaults for every label", () => {
    const html = render(<Rail items={itemsOf(6)}>page</Rail>)
    expect(html.match(/aria-label="Main navigation"/g)).toHaveLength(2)
    expect(tabLabels(html)).toContain("More")
    expect(region(html, "rail-shell-dialog", "h2")).toContain(">More")
    expect(html).toContain('aria-label="Close"')
    expect(html).toContain(">Skip to content</a>")
  })

  it("prints the caller's labels in place of every default", () => {
    const html = render(
      <Rail
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
      </Rail>,
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
      <Rail items={[{ key: "home", label: "Home", Icon: IconHome }]}>page</Rail>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(rail).toContain('<button type="button"')
    expect(rail).not.toContain("<a ")
    expect(rail).toMatch(/<span class="[^"]*" aria-hidden="true"><svg/)
  })

  it("calls each slot once per place: rail in the column, sheet in the dialog", () => {
    const calls: string[] = []
    const html = render(
      <Rail
        items={itemsOf(3)}
        top={(place) => {
          calls.push(`top:${place}`)
          return <span>{`top-${place}`}</span>
        }}
        bottom={(place) => {
          calls.push(`bottom:${place}`)
          return <span>{`bottom-${place}`}</span>
        }}
      >
        page
      </Rail>,
    )
    expect(calls.sort()).toEqual(["bottom:rail", "bottom:sheet", "top:rail", "top:sheet"])
    const top = html.indexOf('data-e2e="rail-shell-top"')
    const nav = html.indexOf('data-e2e="rail-shell-rail"')
    const bottom = html.indexOf('data-e2e="rail-shell-bottom"')
    expect(top).toBeGreaterThan(-1)
    expect(top).toBeLessThan(nav)
    expect(bottom).toBeGreaterThan(nav)
    expect(html.slice(top, nav)).toContain("top-rail")
    expect(html.slice(bottom, html.indexOf("<main"))).toContain("bottom-rail")
    expect(region(html, "rail-shell-overlay-top", "div")).toContain("top-sheet")
    expect(region(html, "rail-shell-overlay-bottom", "div")).toContain("bottom-sheet")
  })

  it("draws no slot wrappers when the slots are left out", () => {
    // Six items, so the sheet exists and its slot wrappers could appear.
    const html = render(<Rail items={itemsOf(6)}>page</Rail>)
    expect(html).toContain("<dialog")
    const wrappers = [
      "rail-shell-top",
      "rail-shell-bottom",
      "rail-shell-overlay-top",
      "rail-shell-overlay-bottom",
    ]
    for (const e2e of wrappers) {
      expect(html).not.toContain(`data-e2e="${e2e}"`)
    }
  })

  it("gives the phone bar a last slot opening the sheet when slots exist and every item fits", () => {
    const html = render(
      <Rail items={itemsOf(3)} bottom={() => <span>account</span>}>page</Rail>,
    )
    expect(tabLabels(html)).toEqual(["Item 1", "Item 2", "Item 3", "More"])
    expect(html).toContain('data-e2e="rail-shell-more"')
    expect(region(html, "rail-shell-dialog", "dialog")).not.toContain("href=")
  })

  it("draws an item's counter as a hidden badge and speaks it in the entry's name", () => {
    const items: RailItem[] = [
      { key: "inbox", label: "Inbox", href: "/inbox", Icon: IconHome, counter: 3 },
      { key: "done", label: "Done", href: "/done", Icon: IconHome, counter: 0 },
    ]
    const html = render(
      <Rail items={items} labels={{ counter: (count) => `${count} unread` }}>page</Rail>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(rail).toContain('aria-label="Inbox, 3 unread"')
    expect(rail).toMatch(/aria-hidden="true" data-e2e="rail-shell-counter">3</)
    const tabbar = region(html, "rail-shell-tabbar", "nav")
    expect(tabbar).toContain('aria-label="Inbox, 3 unread"')
    expect(html).not.toContain('aria-label="Done')
    expect(html.match(/data-e2e="rail-shell-counter"/g)).toHaveLength(2)
  })

  it("speaks a bare count by default and caps the badge at 99+", () => {
    const html = render(
      <Rail items={[{ key: "a", label: "Alerts", href: "/a", Icon: IconHome, counter: 120 }]}>
        page
      </Rail>,
    )
    expect(html).toContain('aria-label="Alerts, 120"')
    expect(html).toMatch(/data-e2e="rail-shell-counter">99\+</)
    expect(html).not.toMatch(/data-e2e="rail-shell-counter">120</)
  })

  it("draws the last slot's icon and counter from moreTab, under labels.more", () => {
    const html = render(
      <Rail
        items={itemsOf(6)}
        labels={{ more: "Account" }}
        moreTab={{ icon: <b data-e2e="avatar-icon">U</b>, counter: 4 }}
      >
        page
      </Rail>,
    )
    const moreTag = html.match(/<button[^>]*data-e2e="rail-shell-more"[^>]*>/)?.[0] ?? ""
    const more = html.slice(
      html.indexOf('data-e2e="rail-shell-more"'),
      html.indexOf("</button>", html.indexOf('data-e2e="rail-shell-more"')),
    )
    expect(more).toContain('data-e2e="avatar-icon"')
    expect(more).not.toContain("<svg")
    expect(more).toContain(">Account<")
    expect(moreTag).toContain('aria-label="Account, 4"')
    expect(more).toMatch(/data-e2e="rail-shell-counter">4</)
  })

  it("marks the entry holding the page in its section with aria-current true", () => {
    const items: RailItem[] = [
      { key: "home", label: "Home", href: "/" },
      { key: "notes", label: "Notes", href: "/notes" },
      { key: "tags", label: "Tags", href: "/notes/tags" },
    ]
    const inNote = render(<Rail items={items} currentPath="/notes/42">page</Rail>)
    for (const tag of linkTags(inNote, "/notes")) expect(tag).toContain('aria-current="true"')
    for (const tag of linkTags(inNote, "/")) expect(tag).not.toContain("aria-current")
    const inTag = render(<Rail items={items} currentPath="/notes/tags/7">page</Rail>)
    for (const tag of linkTags(inTag, "/notes/tags")) expect(tag).toContain('aria-current="true"')
    for (const tag of linkTags(inTag, "/notes")) expect(tag).not.toContain("aria-current")
  })

  it("lets an exact match be the only current entry", () => {
    const items: RailItem[] = [
      { key: "notes", label: "Notes", href: "/notes" },
      { key: "tags", label: "Tags", href: "/notes/tags" },
    ]
    const html = render(<Rail items={items} currentPath="/notes/tags">page</Rail>)
    for (const tag of linkTags(html, "/notes/tags")) expect(tag).toContain('aria-current="page"')
    for (const tag of linkTags(html, "/notes")) expect(tag).not.toContain("aria-current")
  })

  it("fills the current cell with no left bar, and outlines it under forced colours", () => {
    const html = render(<Rail items={itemsOf(3)} currentKey="i2">page</Rail>)
    const [railTag] = linkTags(region(html, "rail-shell-rail", "nav"), "/i2")
    expect(railTag).toContain("bg-[var(--color-surface-active")
    expect(railTag).toContain("forced-colors:outline-[CanvasText]")
    expect(html).not.toContain("before:w-1")
  })

  it("names an icon cell by hidden text and keeps its aria-hidden tooltip outside the control", () => {
    const html = render(
      <Rail items={[{ key: "home", label: "Home", href: "/", Icon: IconHome }]}>page</Rail>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    const link = rail.slice(rail.indexOf("<a "), rail.indexOf("</a>"))
    expect(link).not.toContain("aria-label")
    expect(link).toMatch(/<span class="[^"]*sr-only[^"]*">Home<\/span>/)
    expect(link).not.toContain("rail-shell-tooltip")
    expect(rail.slice(rail.indexOf("</a>"))).toMatch(
      /aria-hidden="true" data-rail-tip data-e2e="rail-shell-tooltip"><span[^>]*>Home</,
    )
  })

  it("draws the labels variant's label visibly and gives it no tooltip", () => {
    const html = render(
      <Rail variant="labels" items={[{ key: "work", label: "Work", href: "/w", Icon: IconHome }]}>
        page
      </Rail>,
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(rail).toMatch(/<span class="[^"]*line-clamp-2[^"]*">Work<\/span>/)
    expect(rail).not.toMatch(/sr-only[^"]*">Work/)
    expect(html).not.toContain("data-rail-tip")
    expect(html).toContain('data-rail-variant="labels"')
  })

  it("keeps the column 72 px at every desktop width and pads it by the left safe-area inset", () => {
    const html = render(<Rail items={itemsOf(3)}>page</Rail>)
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? ""
    expect(aside).toContain("pl-safe")
    expect(html).toContain("w-18")
    expect(html).not.toContain("lg:w-60")
  })

  it("passes an item's data attributes through to its control", () => {
    const html = render(
      <Rail
        variant="labels"
        items={itemsOf(1)}
        primary={{ ...primary, attributes: { "data-primary-book": "" } }}
      >
        page
      </Rail>,
    )
    for (const tag of linkTags(html, "/new")) expect(tag).toMatch(/ data-primary-book[ >]/)
  })
})
