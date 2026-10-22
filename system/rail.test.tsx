import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconHome } from "@spy4x/preact-icons"
import type { IconProps } from "@spy4x/preact-icons"
import { Rail, RailCell, RailEntry, railFocusRing, type RailItem, tabBarSlots } from "./rail.tsx"
import { entryKeyShortcuts, entryTip } from "./rail-parts.tsx"

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
      expect(tag).toContain(`aria-current="false"`)
    }
  })

  it("marks the item whose href equals currentPath as the current page", () => {
    const html = render(<Rail items={itemsOf(3)} currentPath="/i3">page</Rail>)
    for (const tag of linkTags(html, "/i3")) expect(tag).toContain('aria-current="page"')
    for (const tag of linkTags(html, "/i1")) expect(tag).toContain(`aria-current="false"`)
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
    for (const tag of linkTags(inNote, "/")) expect(tag).toContain(`aria-current="false"`)
    const inTag = render(<Rail items={items} currentPath="/notes/tags/7">page</Rail>)
    for (const tag of linkTags(inTag, "/notes/tags")) expect(tag).toContain('aria-current="true"')
    for (const tag of linkTags(inTag, "/notes")) expect(tag).toContain(`aria-current="false"`)
  })

  it("lets an exact match be the only current entry", () => {
    const items: RailItem[] = [
      { key: "notes", label: "Notes", href: "/notes" },
      { key: "tags", label: "Tags", href: "/notes/tags" },
    ]
    const html = render(<Rail items={items} currentPath="/notes/tags">page</Rail>)
    for (const tag of linkTags(html, "/notes/tags")) expect(tag).toContain('aria-current="page"')
    for (const tag of linkTags(html, "/notes")) expect(tag).toContain(`aria-current="false"`)
  })

  it("fills the current cell with no left bar, and outlines it under forced colours", () => {
    const html = render(<Rail items={itemsOf(3)} currentKey="i2">page</Rail>)
    const [railTag] = linkTags(region(html, "rail-shell-rail", "nav"), "/i2")
    expect(railTag).toContain("bg-[var(--color-surface-active")
    expect(railTag).toContain("forced-colors:outline-[CanvasText]")
    expect(html).not.toContain("before:w-1")
  })

  const barColour = "bg-[var(--color-nav-active,var(--color-selected-text))]"
  const columnBar = ["absolute", "left-0", "w-[3px]", barColour]
  const tabBar = ["absolute", "top-0", "h-[3px]", barColour]

  /**
   * The classes of the edge bar inside the first control in `html` whose opening tag `open`
   * matches, or `[]` when it has none. The bar is an `aria-hidden` span of its own, never a
   * pseudo-element, so axe can decide the label's contrast.
   */
  function barIn(html: string, open: RegExp): string[] {
    const start = html.search(open)
    if (start < 0) throw new Error(`no control matches ${open}`)
    const control = html.slice(start, start + html.slice(start).search(/<\/(?:a|button)>/))
    expect(controlClass(control)).not.toContain("before:")
    const bar = control.match(/<span [^>]*data-current-bar[^>]*>/)?.[0]
    if (bar === undefined) return []
    expect(bar).toContain('aria-hidden="true"')
    return bar.match(/class="([^"]*)"/)?.[1].split(" ") ?? []
  }
  const link = (href: string) => new RegExp(`<a [^>]*href="${href}"`)
  const moreButton = /<button [^>]*data-e2e="rail-shell-more"/

  it("adds a 3 px left-edge bar to the labels variant's current cell, a RailEntry's included", () => {
    const html = render(
      <Rail
        variant="labels"
        items={itemsOf(3)}
        currentKey="i2"
        top={(place) =>
          place === "rail" && (
            <RailEntry
              item={{ key: "home", label: "Home", href: "/" }}
              place="rail"
              variant="labels"
              current="page"
            />
          )}
      >
        page
      </Rail>,
    )
    const column = region(html, "rail-shell-rail", "nav")
    const top = region(html, "rail-shell-top", "div")
    for (const [zone, href] of [[column, "/i2"], [top, "/"]]) {
      const bar = barIn(zone, link(href))
      for (const name of columnBar) expect(bar).toContain(name)
      const classes = controlClass(linkTags(zone, href)[0]).split(" ")
      expect(classes).toContain("bg-[var(--color-surface-active,var(--color-accent-100))]")
      expect(classes).toContain("font-semibold")
      expect(classes).toContain("forced-colors:outline-[CanvasText]")
    }
    expect(barIn(column, link("/i1"))).toEqual([])
  })

  it("adds a 3 px top-edge bar to the labels variant's current tab, More included", () => {
    const items: RailItem[] = [
      ...itemsOf(2),
      { key: "about", label: "About", href: "/about", sheetOnly: true },
    ]
    const tabbar = (path: string) =>
      region(
        render(<Rail variant="labels" items={items} currentPath={path}>page</Rail>),
        "rail-shell-tabbar",
        "nav",
      )
    for (const name of tabBar) expect(barIn(tabbar("/i2"), link("/i2"))).toContain(name)
    expect(barIn(tabbar("/i2"), link("/i1"))).toEqual([])
    for (const name of tabBar) expect(barIn(tabbar("/about"), moreButton)).toContain(name)
    expect(barIn(tabbar("/i1"), moreButton)).toEqual([])
  })

  it("keeps the icons variant's current cell and tab to the fill alone, with no edge bar", () => {
    const items: RailItem[] = [
      ...itemsOf(2),
      { key: "about", label: "About", href: "/about", sheetOnly: true },
    ]
    const html = render(<Rail items={items} currentKey="i2">page</Rail>)
    for (const [e2e, tag] of [["rail-shell-rail", "nav"], ["rail-shell-tabbar", "nav"]]) {
      const zone = region(html, e2e, tag)
      expect(linkTags(zone, "/i2")[0]).toContain("bg-[var(--color-surface-active")
      expect(barIn(zone, link("/i2"))).toEqual([])
    }
    const more = region(
      render(<Rail items={items} currentPath="/about">page</Rail>),
      "rail-shell-tabbar",
      "nav",
    )
    expect(more.match(/<button [^>]*data-e2e="rail-shell-more"[^>]*>/)?.[0]).toContain(
      "bg-[var(--color-surface-active",
    )
    expect(barIn(more, moreButton)).toEqual([])
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

  it("draws a RailCell in a slot with the same cell, tooltip and focus ring as an entry's", () => {
    const html = render(
      <Rail
        items={[{ key: "home", label: "Home", href: "/", Icon: IconHome }]}
        top={(place) =>
          place === "rail" && (
            <RailCell tip="Acme" dataE2E="switcher-cell">
              <button type="button" class={railFocusRing}>A</button>
            </RailCell>
          )}
      >
        page
      </Rail>,
    )
    const cellOf = (part: string) => part.match(/<div class="([^"]*)" data-rail-cell[ >]/)?.[1]
    const tipOf = (part: string) =>
      part.match(
        /<span class="([^"]*)" aria-hidden="true" data-rail-tip data-e2e="rail-shell-tooltip"><span class="([^"]*)">([^<]*)</,
      )?.slice(1)
    // The top zone alone: from its wrapper up to the list's `<nav>`.
    const top = html.slice(
      html.indexOf('data-e2e="rail-shell-top"'),
      html.indexOf('data-e2e="rail-shell-rail"'),
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(top).toContain('data-rail-cell data-e2e="switcher-cell"')
    expect(cellOf(top)).toBeDefined()
    expect(cellOf(top)).toBe(cellOf(rail))
    const [tipClass, bubbleClass, words] = tipOf(top) ?? []
    expect(words).toBe("Acme")
    expect([tipClass, bubbleClass]).toEqual(tipOf(rail)?.slice(0, 2))
    const entryClass = rail.match(/<a [^>]*class="([^"]*)"/)?.[1] ?? ""
    for (const ring of railFocusRing.split(" ")) expect(entryClass.split(" ")).toContain(ring)
    expect(top).toContain(`<button type="button" class="${railFocusRing}">A</button>`)
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

  it("keeps the icons variant's column 72 px at every desktop width, its cells 48 px squares that take a 64 px labelled shape with no hover, and pads it by the left safe-area inset", () => {
    const html = render(<Rail items={itemsOf(3)}>page</Rail>)
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? ""
    expect(aside).toContain("pl-safe")
    const column = columnClasses(html)
    expect(column).toContain("w-18")
    expect(column).not.toContain("w-22")
    expect(html).not.toContain("lg:w-60")
    const cell = controlClass(region(html, "rail-shell-rail", "nav")).split(" ")
    expect(cell).toContain("size-12")
    expect(cell).toContain("[@media(hover:none)]:w-16")
    expect(cell).toContain("[@media(hover:none)]:px-0")
    expect(cell).not.toContain("w-20")
  })

  it("draws the labels variant in an 88 px column of 80 px cells that leave a label 72 px", () => {
    const html = render(<Rail variant="labels" items={itemsOf(3)}>page</Rail>)
    const column = columnClasses(html)
    expect(column).toContain("w-22")
    expect(column).not.toContain("w-18")
    const cell = controlClass(region(html, "rail-shell-rail", "nav")).split(" ")
    expect(cell).toContain("w-20")
    expect(cell).toContain("px-1")
    expect(cell).toContain("min-h-14")
    expect(cell).not.toContain("w-16")
    expect(cell).not.toContain("px-0")
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

/** A portrait drawn as an entry's icon: any element, here a photo. */
function Portrait(props: IconProps) {
  return <img src="/me.jpg" alt="" class={props.class} data-e2e="portrait-photo" />
}

/** The `class` of the desktop column's sized box, the first element inside its `<aside>`. */
function columnClasses(html: string): string[] {
  const classes = html.match(/data-e2e="rail-shell-column"[^>]*>\s*<div class="([^"]*)"/)?.[1]
  if (classes === undefined) throw new Error("no sized box inside the rail's column")
  return classes.split(" ")
}

/** The `class` of the first `<a>` or `<button>` in `html`. */
function controlClass(html: string): string {
  return html.match(/<(?:a|button) [^>]*class="([^"]*)"/)?.[1] ?? ""
}

describe("Rail for a site: RailEntry, sheet-only items, footer", () => {
  const home: RailItem = { key: "home", label: "Home", href: "/", Icon: Portrait }

  it("draws a RailEntry in the column exactly like a labels-variant entry, current included", () => {
    const html = render(
      <Rail
        variant="labels"
        items={[{ key: "work", label: "Work", href: "/work", Icon: IconHome }]}
        currentPath="/work"
        top={(place) =>
          place === "rail" && (
            <RailEntry
              item={home}
              place="rail"
              variant="labels"
              current="page"
            />
          )}
      >
        page
      </Rail>,
    )
    const top = html.slice(
      html.indexOf('data-e2e="rail-shell-top"'),
      html.indexOf('data-e2e="rail-shell-rail"'),
    )
    const [portraitTag] = linkTags(top, "/")
    const [workTag] = linkTags(region(html, "rail-shell-rail", "nav"), "/work")
    expect(portraitTag).toContain('aria-current="page"')
    expect(controlClass(portraitTag)).not.toBe("")
    expect(controlClass(portraitTag)).toBe(controlClass(workTag))
    expect(top).toMatch(/<span class="[^"]*" aria-hidden="true"><img src="\/me.jpg"/)
    expect(top).toMatch(/<span class="[^"]*line-clamp-2[^"]*">Home<\/span>/)
    expect(top).not.toContain("data-rail-tip")
  })

  it("draws a RailEntry in the icons variant's column with the entry's cell and tooltip", () => {
    const html = render(
      <Rail
        items={[{ key: "work", label: "Work", href: "/work", Icon: IconHome }]}
        top={(place) => place === "rail" && <RailEntry item={home} place="rail" />}
      >
        page
      </Rail>,
    )
    const top = html.slice(
      html.indexOf('data-e2e="rail-shell-top"'),
      html.indexOf('data-e2e="rail-shell-rail"'),
    )
    const rail = region(html, "rail-shell-rail", "nav")
    expect(controlClass(top)).toBe(controlClass(rail))
    expect(top).toMatch(/data-rail-tip data-e2e="rail-shell-tooltip"><span[^>]*>Home</)
  })

  it("draws a RailEntry in the sheet exactly like the sheet's own rows", () => {
    const html = render(
      <Rail
        items={itemsOf(6)}
        currentKey="i6"
        top={(place) =>
          place === "sheet" && (
            <>
              <RailEntry item={{ key: "x", label: "X", href: "/x" }} place="sheet" current="page" />
              <RailEntry item={{ key: "y", label: "Y" }} place="sheet" />
            </>
          )}
      >
        page
      </Rail>,
    )
    const sheetTop = region(html, "rail-shell-overlay-top", "div")
    const [ownRow] = linkTags(region(html, "rail-shell-dialog", "dialog"), "/i6")
    const [entryRow] = linkTags(sheetTop, "/x")
    expect(entryRow).toContain('aria-current="page"')
    expect(controlClass(entryRow)).toContain("min-h-11")
    expect(controlClass(entryRow)).toBe(controlClass(ownRow))
    // A button in the sheet closes it when chosen, as the sheet's own entries do.
    expect(sheetTop).toMatch(/<button data-rail-close type="button"/)
    // A button centres its text by default; its label starts at the left like a link row's.
    const [buttonRow] = sheetTop.match(/<button data-rail-close[^>]*>/) ?? [``]
    expect(controlClass(buttonRow).split(` `)).toContain(`text-left`)
  })

  it("draws sheet-only items as sheet rows alone, never in the column or as tabs", () => {
    const items: RailItem[] = [
      { key: "work", label: "Work", href: "/work" },
      { key: "about", label: "About", href: "/about", sheetOnly: true },
      { key: "writing", label: "Writing", href: "/writing" },
    ]
    const html = render(<Rail variant="labels" items={items}>page</Rail>)
    expect(linkTags(region(html, "rail-shell-rail", "nav"), "/about")).toEqual([])
    expect(tabLabels(html)).toEqual(["Work", "Writing", "More"])
    const sheet = region(html, "rail-shell-dialog", "dialog")
    expect(linkTags(sheet, "/about")).toHaveLength(1)
    expect(linkTags(sheet, "/work")).toEqual([])
  })

  it("keeps the caller's order in the sheet between overflow and sheet-only rows", () => {
    const items: RailItem[] = [
      ...itemsOf(5),
      { key: "about", label: "About", href: "/about", sheetOnly: true },
      { key: "i6", label: "Item 6", href: "/i6" },
    ]
    const sheet = region(render(<Rail items={items}>page</Rail>), "rail-shell-dialog", "dialog")
    const hrefs = [...sheet.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(["/i5", "/about", "/i6"])
  })

  it("marks More current when the page is a sheet-only item, and only then", () => {
    const items: RailItem[] = [
      { key: "work", label: "Work", href: "/work" },
      { key: "about", label: "About", href: "/about", sheetOnly: true },
    ]
    const moreTag = (path: string) =>
      render(<Rail variant="labels" items={items} currentPath={path}>page</Rail>)
        .match(/<button[^>]*data-e2e="rail-shell-more"[^>]*>/)?.[0] ?? ""
    expect(moreTag("/about")).toContain("bg-[var(--color-surface-active")
    expect(moreTag("/work")).not.toContain("bg-[var(--color-surface-active")
    expect(moreTag("/work")).not.toBe("")
  })

  it("draws no tooltip on a RailCell in the labels variant, and keeps it in the icons variant", () => {
    const cell = (place: string) =>
      place === "rail" && (
        <RailCell tip="Acme">
          <button type="button">A</button>
        </RailCell>
      )
    const items = [{ key: "work", label: "Work", href: "/w", Icon: IconHome }]
    expect(render(<Rail variant="labels" items={items} top={cell}>page</Rail>))
      .not.toContain("data-rail-tip")
    expect(render(<Rail variant="icons" items={items} top={cell}>page</Rail>))
      .toMatch(/data-rail-tip data-e2e="rail-shell-tooltip"><span[^>]*>Acme</)
  })

  it("draws the footer after main and outside it", () => {
    const html = render(
      <Rail items={itemsOf(2)} footer={<footer data-e2e="site-footer">foot</footer>}>
        page
      </Rail>,
    )
    const mainEnd = html.indexOf("</main>")
    const footer = html.indexOf('<footer data-e2e="site-footer">')
    expect(mainEnd).toBeGreaterThan(-1)
    expect(footer).toBeGreaterThan(mainEnd)
    expect(footer).toBeLessThan(html.indexOf('data-e2e="rail-shell-dock"'))
    expect(render(<Rail items={itemsOf(2)}>page</Rail>)).not.toContain("rail-shell-page")
  })

  it("lets a backdrop tap close the sheet with no script", () => {
    const html = render(<Rail items={itemsOf(6)}>page</Rail>)
    expect(html.match(/<dialog[^>]*>/)?.[0]).toContain('closedby="any"')
  })

  it("draws no wrapper for a slot that renders nothing in a place", () => {
    const html = render(
      <Rail
        items={itemsOf(6)}
        top={(place) => place === "rail" ? <span>portrait</span> : null}
        bottom={(place) => place === "sheet" ? [<span key="a">account</span>] : [false, ""]}
      >
        page
      </Rail>,
    )
    expect(html).toContain('data-e2e="rail-shell-top"')
    expect(html).not.toContain('data-e2e="rail-shell-overlay-top"')
    expect(html).not.toContain('data-e2e="rail-shell-bottom"')
    expect(html).toContain('data-e2e="rail-shell-overlay-bottom"')
  })

  it("announces an entry's key shortcuts in every place and shows the first in its tooltip", () => {
    const search: RailItem = {
      key: "search",
      label: "Search",
      Icon: IconHome,
      keyshortcuts: ["mod+k", "/"],
    }
    const html = render(
      <Rail
        items={[{ key: "work", label: "Work", href: "/work", Icon: IconHome }]}
        top={(place) => <RailEntry item={search} place={place} />}
      >
        page
      </Rail>,
    )
    const buttons = [...html.matchAll(/<button[^>]*aria-keyshortcuts="([^"]*)"[^>]*>/g)]
    // The column's cell and the sheet's row; the server render writes Ctrl, as off Apple.
    expect(buttons.map((match) => match[1])).toEqual(["Control+K /", "Control+K /"])
    const tips = [...html.matchAll(/data-e2e="rail-shell-tooltip"><span[^>]*>([^<]*)</g)]
    expect(tips.map((match) => match[1]).sort()).toEqual(["Search (Ctrl K)", "Work"])
    // An entry with none announces none.
    expect(linkTags(html, "/work").every((tag) => !tag.includes("aria-keyshortcuts"))).toBe(true)
  })

  it("writes the tooltip's shortcut as the platform does, in the words labels.kbd gives", () => {
    expect(entryTip("Search", ["mod+k"], false)).toBe("Search (Ctrl K)")
    expect(entryTip("Search", ["mod+k"], true)).toBe("Search (⌘K)")
    expect(entryTip("Search", ["mod+k"], false, { ctrl: "Strg" })).toBe("Search (Strg K)")
    expect(entryTip("Search", undefined, false)).toBe("Search")
    expect(entryKeyShortcuts(["mod+k", "/"], true)).toBe("Meta+K /")
    expect(entryKeyShortcuts([], false)).toBeUndefined()
    const html = render(
      <Rail
        items={[{
          key: "find",
          label: "Find",
          href: "/find",
          Icon: IconHome,
          keyshortcuts: ["mod+k"],
        }]}
        labels={{ kbd: { ctrl: "Strg" } }}
      >
        page
      </Rail>,
    )
    expect(html).toMatch(/data-e2e="rail-shell-tooltip"><span[^>]*>Find \(Strg K\)</)
  })
})
