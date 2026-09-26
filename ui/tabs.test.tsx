import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { nextTabIndex, type TabItem, Tabs } from "./tabs.tsx"

const twoTabs: TabItem[] = [
  { id: "overview", label: "Overview", content: <p>Overview panel</p> },
  { id: "settings", label: "Settings", content: <p>Settings panel</p> },
]

const fourTabs: TabItem[] = [
  { id: "one", label: "One", content: "one" },
  { id: "two", label: "Two", content: "two" },
  { id: "three", label: "Three", content: "three" },
  { id: "four", label: "Four", content: "four" },
]

describe("Tabs", () => {
  it("renders the tab buttons inside a tablist", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(html).toContain('role="tablist"')
    expect(countOccurrences(html, 'role="tab"')).toBe(2)
    expect(tabTags(html).length).toBe(2)
  })

  it("renders the caller's labels", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(html).toContain(">Overview<")
    expect(html).toContain(">Settings<")
  })

  it("marks the active tab selected and the others not", () => {
    const html = render(<Tabs tabs={twoTabs} active="settings" onChange={() => {}} />)

    expect(tagWithId(html, "settings-tab")).toContain('aria-selected="true"')
    expect(tagWithId(html, "overview-tab")).toContain('aria-selected="false"')
    expect(countOccurrences(html, 'aria-selected="true"')).toBe(1)
  })

  it("renders a tabpanel per tab, labelled by its tab", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(countOccurrences(html, 'role="tabpanel"')).toBe(2)
    expect(tagWithId(html, "overview-panel")).toContain('aria-labelledby="overview-tab"')
    expect(tagWithId(html, "settings-panel")).toContain('aria-labelledby="settings-tab"')
  })

  it("points every tab at the panel it controls", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(tagWithId(html, "overview-tab")).toContain('aria-controls="overview-panel"')
    expect(tagWithId(html, "settings-tab")).toContain('aria-controls="settings-panel"')
  })

  it("gives every tab and panel exactly one element with its derived id", () => {
    const html = render(<Tabs tabs={fourTabs} active="two" onChange={() => {}} />)

    for (const tab of fourTabs) {
      expect(countOccurrences(html, `id="${tab.id}-tab"`)).toBe(1)
      expect(countOccurrences(html, `id="${tab.id}-panel"`)).toBe(1)
    }
  })

  it("hides the inactive panels and keeps them in the document", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(hasAttribute(tagWithId(html, "overview-panel"), "hidden")).toBe(false)
    expect(hasAttribute(tagWithId(html, "settings-panel"), "hidden")).toBe(true)
    expect(html).toContain("Overview panel")
    expect(html).toContain("Settings panel")
  })

  it("shows the panel of the tab that is active", () => {
    const html = render(<Tabs tabs={twoTabs} active="settings" onChange={() => {}} />)

    expect(hasAttribute(tagWithId(html, "settings-panel"), "hidden")).toBe(false)
    expect(hasAttribute(tagWithId(html, "overview-panel"), "hidden")).toBe(true)
  })

  it("renders only the active panel when lazy", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} lazy />)

    expect(countOccurrences(html, 'role="tabpanel"')).toBe(1)
    expect(countOccurrences(html, 'id="overview-panel"')).toBe(1)
    expect(countOccurrences(html, 'id="settings-panel"')).toBe(0)
    expect(html).not.toContain("Settings panel")
  })

  it("drops aria-controls from the tabs whose panel it omitted", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} lazy />)

    expect(tagWithId(html, "overview-tab")).toContain('aria-controls="overview-panel"')
    expect(tagWithId(html, "settings-tab")).not.toContain("aria-controls")
  })

  it("keeps the roving tabindex on the active tab only", () => {
    const html = render(<Tabs tabs={fourTabs} active="three" onChange={() => {}} />)
    const focusable = tabTags(html).filter((tag) => tag.includes('tabindex="0"'))

    expect(focusable.length).toBe(1)
    expect(tagWithId(html, "three-tab")).toContain('tabindex="0"')
    expect(tagWithId(html, "one-tab")).toContain('tabindex="-1"')
  })

  it("falls back to the first tab when active matches nothing", () => {
    const html = render(<Tabs tabs={fourTabs} active="gone" onChange={() => {}} />)

    expect(countOccurrences(html, 'aria-selected="true"')).toBe(0)
    expect(tagWithId(html, "one-tab")).toContain('tabindex="0"')
    expect(tabTags(html).filter((tag) => tag.includes('tabindex="0"')).length).toBe(1)
  })

  it("lets the tab row wrap onto a second row", () => {
    const tablist = (html: string) => html.match(/<div[^>]*role="tablist"[^>]*>/)?.[0] ?? ""
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(tablist(html)).toContain("flex-wrap")
  })

  it("underlines the active tab", () => {
    const html = render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />)

    expect(html).toContain("border-b-2")
    expect(tagWithId(html, "overview-tab")).toContain("border-purple-900")
  })

  it("names the tablist when a label is given", () => {
    const html = render(
      <Tabs tabs={twoTabs} active="overview" onChange={() => {}} label="Report sections" />,
    )

    expect(html).toContain('aria-label="Report sections"')
  })

  it("omits the disabled tab from the focus order", () => {
    const tabs: TabItem[] = [
      { id: "one", label: "One" },
      { id: "two", label: "Two", disabled: true },
    ]
    const html = render(<Tabs tabs={tabs} active="one" onChange={() => {}} />)

    expect(hasAttribute(tagWithId(html, "two-tab"), "disabled")).toBe(true)
    expect(hasAttribute(tagWithId(html, "one-tab"), "disabled")).toBe(false)
    expect(tagWithId(html, "two-tab")).toContain('tabindex="-1"')
    expect(html).toContain("disabled:cursor-not-allowed")
  })

  it("stamps the e2e attribute on every tab", () => {
    const html = render(
      <Tabs tabs={twoTabs} active="overview" onChange={() => {}} tabDataE2E="metric-tab" />,
    )

    expect(countOccurrences(html, 'data-e2e="metric-tab"')).toBe(2)
  })

  it("appends the caller's classes to every slot", () => {
    const html = render(
      <Tabs
        tabs={twoTabs}
        active="overview"
        onChange={() => {}}
        class="mt-8"
        listClass="gap-4"
        tabClass="uppercase"
        panelClass="p-6"
      />,
    )

    expect(html).toContain("mt-8")
    expect(html).toContain("gap-4")
    expect(html).toContain("uppercase")
    expect(html).toContain("p-6")
  })

  it("renders element content, not just strings", () => {
    const tabs: TabItem[] = [{ id: "one", label: <span>One</span>, content: <p>Body</p> }]

    expect(render(<Tabs tabs={tabs} active="one" onChange={() => {}} />)).toContain("<p>Body</p>")
  })

  it("renders a tablist with no tabs without throwing", () => {
    const html = render(<Tabs tabs={[]} active="one" onChange={() => {}} />)

    expect(html).toContain('role="tablist"')
    expect(html).not.toContain('role="tab"')
  })

  it("is a pure function of its props", () => {
    const renderOnce = () => render(<Tabs tabs={twoTabs} active="settings" onChange={() => {}} />)

    expect(renderOnce()).toBe(renderOnce())
    expect(renderOnce()).not.toBe(
      render(<Tabs tabs={twoTabs} active="overview" onChange={() => {}} />),
    )
  })
})

describe("nextTabIndex", () => {
  it("steps right and wraps past the end", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1)
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0)
  })

  it("steps left and wraps past the start", () => {
    expect(nextTabIndex("ArrowLeft", 1, 3)).toBe(0)
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2)
  })

  it("leaves up and down to the page", () => {
    expect(nextTabIndex("ArrowUp", 0, 3)).toBeUndefined()
    expect(nextTabIndex("ArrowDown", 0, 3)).toBeUndefined()
  })

  it("jumps to the first and last tab on Home and End", () => {
    expect(nextTabIndex("Home", 2, 4)).toBe(0)
    expect(nextTabIndex("End", 0, 4)).toBe(3)
  })

  it("ignores keys it does not own", () => {
    for (const key of ["Enter", " ", "Tab", "Escape", "a", "PageDown"]) {
      expect(nextTabIndex(key, 0, 3)).toBeUndefined()
    }
  })

  it("answers nothing for a tablist with no tabs", () => {
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(nextTabIndex(key, 0, 0)).toBeUndefined()
    }
  })

  it("stays on the only tab of a one-tab tablist", () => {
    expect(nextTabIndex("ArrowRight", 0, 1)).toBe(0)
    expect(nextTabIndex("ArrowLeft", 0, 1)).toBe(0)
    expect(nextTabIndex("Home", 0, 1)).toBe(0)
    expect(nextTabIndex("End", 0, 1)).toBe(0)
  })

  it("skips a disabled tab while stepping", () => {
    const disabled = [false, true, false]

    expect(nextTabIndex("ArrowRight", 0, 3, disabled)).toBe(2)
    expect(nextTabIndex("ArrowLeft", 2, 3, disabled)).toBe(0)
  })

  it("skips a disabled tab when wrapping", () => {
    expect(nextTabIndex("ArrowRight", 0, 3, [false, false, true])).toBe(1)
    expect(nextTabIndex("ArrowLeft", 0, 3, [false, false, true])).toBe(1)
  })

  it("skips disabled tabs on Home and End", () => {
    const disabled = [true, false, false, true]

    expect(nextTabIndex("Home", 3, 4, disabled)).toBe(1)
    expect(nextTabIndex("End", 0, 4, disabled)).toBe(2)
  })

  it("answers nothing when every tab is disabled", () => {
    const disabled = [true, true]

    expect(nextTabIndex("ArrowRight", 0, 2, disabled)).toBeUndefined()
    expect(nextTabIndex("Home", 0, 2, disabled)).toBeUndefined()
    expect(nextTabIndex("End", 0, 2, disabled)).toBeUndefined()
  })

  it("returns the current tab when it is the only enabled one", () => {
    expect(nextTabIndex("ArrowRight", 1, 3, [true, false, true])).toBe(1)
  })

  it("wraps an out-of-range current index instead of throwing", () => {
    expect(nextTabIndex("ArrowRight", 9, 3)).toBe(1)
    expect(nextTabIndex("ArrowLeft", -1, 3)).toBe(1)
  })
})

/** Occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The opening tag of the single element carrying `id="…"`. */
function tagWithId(html: string, id: string): string {
  const match = html.match(new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`))
  if (match === null) throw new Error(`no element carries id="${id}"`)
  return match[0]
}

/**
 * Whether `tag` carries the attribute, with or without a value.
 *
 * Matches on the attribute name only, so a utility class such as `disabled:cursor-not-allowed`
 * or `outline-hidden` cannot be mistaken for the attribute itself.
 */
function hasAttribute(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s=>])`).test(tag)
}

/** Every `<button role="tab">` opening tag in `html`, in document order. */
function tabTags(html: string): string[] {
  return html.match(/<button[^>]*role="tab"[^>]*>/g) ?? []
}
