import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Dropdown, DropdownItem, dropdownOpensUp, nextMenuIndex } from "./dropdown.tsx"

/** The value of `name` on the first tag in `html` that matches `tag`, unescaped, or `undefined`. */
function attrOf(html: string, tag: RegExp, name: string): string | undefined {
  const opening = html.match(tag)?.[0] ?? ""
  return opening.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]?.replaceAll("&amp;", "&")
}

describe("Dropdown", () => {
  it("server-renders a closed details whose summary is the trigger, so it opens without JavaScript", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent>
        <DropdownItem href="/a">First</DropdownItem>
      </Dropdown>,
    )

    expect(html).toMatch(
      /^<details class="[^"]*"><summary[^>]*>Menu<\/summary><div[^>]*role="menu"/,
    )
    expect(html).toContain("First")
    expect(html.endsWith("</div></details>")).toBe(true)
  })

  it("leaves the fallback's panel to the details, not to a hidden class", () => {
    const html = render(<Dropdown trigger="Menu" triggerNamedByContent>item</Dropdown>)
    const panelClasses = attrOf(html, /<div[^>]*role="menu"[^>]*>/, "class") ?? ""

    expect(panelClasses).toContain("absolute")
    expect(panelClasses.split(" ")).not.toContain("hidden")
  })

  it("hides the fallback summary's disclosure marker", () => {
    const html = render(<Dropdown trigger="Menu" triggerNamedByContent>item</Dropdown>)
    const summaryClasses = (attrOf(html, /<summary[^>]*>/, "class") ?? "").split(" ")

    expect(summaryClasses).toContain("list-none")
    expect(summaryClasses).toContain("[&::-webkit-details-marker]:hidden")
  })

  it("marks the panel as a vertical menu", () => {
    const html = render(<Dropdown trigger="Menu" triggerNamedByContent>item</Dropdown>)

    expect(html).toContain('role="menu"')
    expect(html).toContain('aria-orientation="vertical"')
  })

  it("renders the trigger content", () => {
    expect(
      render(
        <Dropdown trigger={<span data-e2e="icon">x</span>} triggerLabel="Row actions">
          item
        </Dropdown>,
      ),
    ).toContain('data-e2e="icon"')
  })

  it("names an icon trigger with the label the caller had to supply", () => {
    const html = render(<Dropdown trigger={<svg />} triggerLabel="Row actions">item</Dropdown>)

    expect(html).toContain('aria-label="Row actions"')
  })

  it("leaves a trigger that has its own text unlabelled, so its visible words are its name", () => {
    const html = render(<Dropdown trigger="Bulk actions" triggerNamedByContent>item</Dropdown>)

    expect(html).toContain("Bulk actions")
    expect(html).not.toContain("aria-label")
  })

  it("refuses to compile a trigger with no accessible name", () => {
    const html = render(
      // @ts-expect-error an unnamed trigger is exactly what this component must not accept
      <Dropdown trigger={<svg />}>item</Dropdown>,
    )

    expect(html).toContain("<summary")
  })

  it("opens the panel above the trigger when vertical is up", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent vertical="up">item</Dropdown>,
    )

    expect(html).toContain("bottom-full")
    expect(html).toContain("origin-bottom-right")
  })

  it("anchors the panel to the left when asked", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent horizontal="left">item</Dropdown>,
    )

    expect(html).toContain("left-0")
    expect(html).toContain("origin-top-left")
  })

  it("renders an auto menu below the trigger until the browser has measured it", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent vertical="auto">item</Dropdown>,
    )

    expect(html).toContain("top-full")
    expect(html).not.toContain("bottom-full")
  })

  it("defaults the panel below and to the right of the trigger", () => {
    const html = render(<Dropdown trigger="Menu" triggerNamedByContent>item</Dropdown>)

    expect(html).toContain("top-full")
    expect(html).toContain("right-0")
  })

  it("uses the caller's trigger classes instead of the default button", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent triggerClasses="p-0">item</Dropdown>,
    )

    expect(html).toContain("p-0")
    expect(html).not.toContain("rounded-md font-medium transition-colors")
  })

  it("names the menu for assistive tech", () => {
    expect(
      render(<Dropdown trigger="Menu" triggerNamedByContent menuLabel="Actions">item</Dropdown>),
    ).toContain('aria-label="Actions"')
  })

  it("appends caller classes to the panel", () => {
    const html = render(
      <Dropdown trigger="Menu" triggerNamedByContent panelClasses="w-64">item</Dropdown>,
    )

    expect(html).toContain("w-64")
    expect(html).toContain("whitespace-nowrap")
  })
})

describe("DropdownItem", () => {
  it("marks a link item as a menu item, out of the tab order", () => {
    const html = render(<DropdownItem href="/edit">Edit</DropdownItem>)

    expect(html).toContain("<a")
    expect(html).toContain('href="/edit"')
    expect(html).toContain('role="menuitem"')
    expect(html).toContain('tabindex="-1"')
  })

  it("marks a button item as a menu item, out of the tab order", () => {
    const html = render(<DropdownItem onClick={() => {}}>Archive</DropdownItem>)

    expect(html).toContain("<button")
    expect(html).toContain('type="button"')
    expect(html).toContain('role="menuitem"')
    expect(html).toContain('tabindex="-1"')
  })

  it("fills a menu with menu items rather than children nothing marked", () => {
    const html = render(
      <Dropdown trigger={<svg />} triggerLabel="Row actions" menuLabel="Row actions">
        <DropdownItem href="/edit">Edit</DropdownItem>
        <DropdownItem onClick={() => {}}>Archive</DropdownItem>
      </Dropdown>,
    )

    expect(html.match(/role="menuitem"/g)).toHaveLength(2)
  })

  it("keeps items in the tab order inside a server-rendered dropdown, where no arrow key works", () => {
    const html = render(
      <Dropdown trigger={<svg />} triggerLabel="Row actions">
        <DropdownItem href="/edit">Edit</DropdownItem>
        <DropdownItem onClick={() => {}}>Archive</DropdownItem>
      </Dropdown>,
    )

    expect(html.match(/role="menuitem"/g)).toHaveLength(2)
    expect(html).not.toContain("tabindex")
  })

  it("disables the button form", () => {
    expect(render(<DropdownItem disabled onClick={() => {}}>Archive</DropdownItem>))
      .toContain("disabled")
  })

  it("colours a danger item red instead of the default grey", () => {
    const html = render(<DropdownItem danger onClick={() => {}}>Archive</DropdownItem>)

    expect(html).toContain("text-red-600")
    expect(html).toContain("dark:text-red-400")
    expect(html).not.toContain("text-foreground")
  })

  it("leaves an item without danger in the default grey", () => {
    const html = render(<DropdownItem onClick={() => {}}>Edit</DropdownItem>)

    expect(html).toContain("text-foreground")
    expect(html).not.toContain("text-red-600")
  })

  it("merges the caller's classes over its own", () => {
    const html = render(<DropdownItem class="text-red-600">Delete</DropdownItem>)

    expect(html).toContain("text-red-600")
    expect(html).not.toContain("text-foreground")
    expect(html).toContain("px-4 py-2")
  })
})

describe("nextMenuIndex", () => {
  it("moves down one item and wraps past the last", () => {
    expect(nextMenuIndex("ArrowDown", 0, 3)).toBe(1)
    expect(nextMenuIndex("ArrowDown", 2, 3)).toBe(0)
  })

  it("moves up one item and wraps past the first", () => {
    expect(nextMenuIndex("ArrowUp", 2, 3)).toBe(1)
    expect(nextMenuIndex("ArrowUp", 0, 3)).toBe(2)
  })

  it("jumps to the first and the last item", () => {
    expect(nextMenuIndex("Home", 2, 3)).toBe(0)
    expect(nextMenuIndex("End", 0, 3)).toBe(2)
  })

  it("answers both arrows when nothing in the menu has focus yet", () => {
    expect(nextMenuIndex("ArrowDown", -1, 3)).toBe(0)
    expect(nextMenuIndex("ArrowUp", -1, 3)).toBe(2)
  })

  it("leaves a key the menu does not own to the page", () => {
    expect(nextMenuIndex("Escape", 0, 3)).toBeUndefined()
    expect(nextMenuIndex("Tab", 0, 3)).toBeUndefined()
    expect(nextMenuIndex("a", 0, 3)).toBeUndefined()
  })

  it("has nowhere to move in an empty menu", () => {
    expect(nextMenuIndex("ArrowDown", -1, 0)).toBeUndefined()
    expect(nextMenuIndex("Home", -1, 0)).toBeUndefined()
  })
})

describe("dropdownOpensUp", () => {
  it("opens down when the panel fits below the trigger", () => {
    expect(dropdownOpensUp({ top: 100, bottom: 140 }, 200, 800)).toBe(false)
  })

  it("opens up when the panel does not fit below and there is more room above", () => {
    expect(dropdownOpensUp({ top: 700, bottom: 740 }, 200, 800)).toBe(true)
  })

  it("counts the gap between trigger and panel as space the panel needs", () => {
    expect(dropdownOpensUp({ top: 548, bottom: 592 }, 200, 800)).toBe(false)
    expect(dropdownOpensUp({ top: 549, bottom: 593 }, 200, 800)).toBe(true)
  })

  it("stays down when the panel fits neither way but below is roomier", () => {
    expect(dropdownOpensUp({ top: 100, bottom: 140 }, 900, 800)).toBe(false)
  })

  it("opens up when the panel fits neither way but above is roomier", () => {
    expect(dropdownOpensUp({ top: 500, bottom: 540 }, 900, 800)).toBe(true)
  })
})
