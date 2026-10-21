import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  activeFilterChips,
  FilterBar,
  type FilterBarMultipleMenu,
  type FilterBarSingleMenu,
  type FilterBarToggle,
  filterTriggerLabel,
} from "./filter-bar.tsx"

/** The value of `name` on the first tag in `html` that matches `tag`, unescaped, or `undefined`. */
function attrOf(html: string, tag: RegExp, name: string): string | undefined {
  const opening = html.match(tag)?.[0] ?? ""
  return opening.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]?.replaceAll("&amp;", "&")
}

const OPTIONS = [
  { value: "design", label: "Design", count: 12 },
  { value: "plans", label: "Plans", count: 5 },
  { value: "launch", label: "Launch" },
]

/** A tags menu holding `value`, reporting every change into `calls`. */
function tags(value: string[], calls: string[][] = []): FilterBarMultipleMenu {
  return {
    id: "tags",
    label: "Tags",
    chipLabel: "Tag",
    multiple: true,
    options: OPTIONS,
    value,
    onChange: (next) => calls.push(next),
  }
}

/** An author menu holding `value`, reporting every change into `calls`. */
function author(value: string | null, calls: (string | null)[] = []): FilterBarSingleMenu {
  return {
    id: "author",
    label: "Author",
    anyLabel: "Anyone",
    options: [{ value: "you", label: "You" }, { value: "maya", label: "Maya Chen" }],
    value,
    onChange: (next) => calls.push(next),
  }
}

/** A "Created by me" toggle, reporting every change into `calls`. */
function mine(pressed: boolean, calls: boolean[] = []): FilterBarToggle {
  return { id: "mine", label: "Created by me", pressed, onChange: (next) => calls.push(next) }
}

describe("filterTriggerLabel", () => {
  it("names the menu alone with nothing chosen, the choice with one, and the number with several", () => {
    expect(filterTriggerLabel(tags([]))).toBe("Tags")
    expect(filterTriggerLabel(tags(["plans"]))).toBe("Tags: Plans")
    expect(filterTriggerLabel(tags(["design", "plans", "launch"]))).toBe("Tags: 3")
    expect(filterTriggerLabel(author("maya"))).toBe("Author: Maya Chen")
    expect(filterTriggerLabel(author(null))).toBe("Author")
  })

  it("lets activeLabel name a menu with a choice, and ignores a value no option carries", () => {
    const menu = {
      ...tags(["design", "gone"]),
      activeLabel: (chosen: unknown[]) => `${chosen.length} tag`,
    }

    expect(filterTriggerLabel(menu)).toBe("1 tag")
    expect(filterTriggerLabel(tags(["gone"]))).toBe("Tags")
  })
})

describe("activeFilterChips", () => {
  it("draws one chip per chosen option in option order, then one per pressed toggle", () => {
    const chips = activeFilterChips(
      [tags(["plans", "design"]), author("you")],
      [mine(true), { ...mine(false), id: "starred", label: "Starred" }],
    )

    expect(chips.map((chip) => chip.label)).toEqual([
      "Tag: Design",
      "Tag: Plans",
      "Author: You",
      "Created by me",
    ])
    expect(chips.map((chip) => chip.valueLabel)).toEqual([
      "Design",
      "Plans",
      "You",
      "Created by me",
    ])
  })

  it("removes one value of a multiple menu, clears a single menu and unpresses a toggle", () => {
    const tagCalls: string[][] = []
    const authorCalls: (string | null)[] = []
    const toggleCalls: boolean[] = []
    const chips = activeFilterChips(
      [tags(["design", "plans"], tagCalls), author("maya", authorCalls)],
      [mine(true, toggleCalls)],
    )

    chips[0].remove()
    chips[2].remove()
    chips[3].remove()

    expect(tagCalls).toEqual([["plans"]])
    expect(authorCalls).toEqual([null])
    expect(toggleCalls).toEqual([false])
  })
})

describe("FilterBar", () => {
  it("is a search landmark named by its label", () => {
    const html = render(<FilterBar filters={[tags([])]} />)

    expect(attrOf(html, /<div[^>]*role="search"[^>]*>/, "aria-label")).toBe("Search and filters")
    expect(render(<FilterBar label="Find notes" />)).toContain(`aria-label="Find notes"`)
  })

  it("labels the search field and shows the hotkey hint only while it is empty", () => {
    const search = { value: "", onChange: () => {}, label: "Search notes", hotkeyHint: "/" }
    const empty = render(<FilterBar search={search} />)
    const typed = render(<FilterBar search={{ ...search, value: "plan" }} />)

    const id = attrOf(empty, /<input[^>]*>/, "id")
    expect(id).toBeTruthy()
    expect(empty).toContain(`<label for="${id}" class="sr-only">Search notes</label>`)
    expect(attrOf(empty, /<input[^>]*>/, "type")).toBe("search")
    expect(attrOf(empty, /<input[^>]*>/, "placeholder")).toBe("Search notes")
    expect(attrOf(empty, /<input[^>]*>/, "aria-keyshortcuts")).toBe("/")
    expect(empty).toContain("data-hotkey-hint")
    expect(empty).not.toContain("Clear search")

    expect(attrOf(typed, /<input[^>]*>/, "value")).toBe("plan")
    expect(typed).not.toContain("data-hotkey-hint")
    expect(attrOf(typed, /<button[^>]*aria-label="Clear search"[^>]*>/, "type")).toBe("button")
  })

  it("names each menu trigger by the choice and fills an active one with the accent", () => {
    const html = render(<FilterBar filters={[tags(["design"]), author(null)]} />)
    const active = html.match(/<summary[^>]*data-e2e="filter-tags"[^>]*>/)?.[0] ?? ""
    const idle = html.match(/<summary[^>]*data-e2e="filter-author"[^>]*>/)?.[0] ?? ""

    expect(html).toMatch(/data-e2e="filter-tags"[^>]*>Tags: Design<svg/)
    expect(html).toMatch(/data-e2e="filter-author"[^>]*>Author<svg/)
    expect(active).toContain("bg-selected")
    expect(idle).toContain("bg-surface")
    expect(idle).not.toContain("bg-selected")
  })

  it("draws a multiple menu's options as boxes with their counts, and a single menu's as choices with an Anyone item", () => {
    const html = render(<FilterBar filters={[tags(["design"]), author("you")]} />)

    expect(html).toMatch(
      /aria-pressed="true"[^>]*>(<span[^>]*>.*?<\/span>)<span[^>]*>Design<\/span><span[^>]*>12</,
    )
    expect(html).toMatch(
      /aria-pressed="false"[^>]*>(<span[^>]*><\/span>)<span[^>]*>Launch<\/span><\/button>/,
    )
    expect(html).toMatch(/>Anyone<\/button>/)
    expect(html).toMatch(/aria-current="true"[^>]*><svg[^>]*>.*?<\/svg><span[^>]*>You</)
  })

  it("draws a pressed toggle in a named group, and the sort with its label hidden only on a phone", () => {
    const html = render(
      <FilterBar
        toggles={[mine(true)]}
        sort={{
          options: [{ value: "updated", label: "Last updated" }, {
            value: "title",
            label: "Title",
          }],
          value: "updated",
          onChange: () => {},
        }}
      />,
    )

    expect(html).toContain(`role="group" aria-label="Quick filters"`)
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<svg.*?<\/svg>)?Created by me</)
    expect(html).toMatch(
      /data-e2e="filter-sort"[^>]*><span class="text-muted max-sm:sr-only">Sort by<\/span>Last updated<svg/,
    )
  })

  it("lists every active filter as a chip with a named remove button, then Clear filters", () => {
    const html = render(
      <FilterBar filters={[tags(["design"]), author("maya")]} toggles={[mine(true)]} />,
    )

    expect(html).toContain(`<ul aria-label="Active filters"`)
    expect(html.match(/data-filter-chip-remove/g)?.length).toBe(3)
    expect(html).toMatch(/Tag: Design<\/span><button[^>]*aria-label="Remove the Design filter"/)
    expect(html).toMatch(
      /Author: Maya Chen<\/span><button[^>]*aria-label="Remove the Maya Chen filter"/,
    )
    expect(html).toContain(`aria-label="Remove the Created by me filter"`)
    expect(html).toMatch(/data-e2e="filter-clear"[^>]*>Clear filters</)
  })

  it("draws no chips row and no Clear filters while no filter is on", () => {
    const html = render(<FilterBar filters={[tags([])]} toggles={[mine(false)]} />)

    expect(html).not.toContain("Active filters")
    expect(html).not.toContain("Clear filters")
  })

  it("shows the count in a polite live region, with or without chips", () => {
    const html = render(<FilterBar filters={[tags([])]} count="42 notes" />)

    expect(html).toMatch(/<p aria-live="polite"[^>]*>42 notes<\/p>/)
  })

  it("takes its words from props", () => {
    const html = render(
      <FilterBar
        filters={[tags(["design"])]}
        toggles={[mine(false)]}
        togglesLabel="Shortcuts"
        chipsLabel="On now"
        clearLabel="Reset"
        removeLabel={(chip) => `Drop ${chip.label}`}
      />,
    )

    expect(html).toContain(`aria-label="Shortcuts"`)
    expect(html).toContain(`aria-label="On now"`)
    expect(html).toContain(`aria-label="Drop Tag: Design"`)
    expect(html).toMatch(/>Reset<\/button>/)
  })

  it("scrolls the controls sideways on a phone and opens each menu there as a sheet at the bottom", () => {
    const html = render(<FilterBar filters={[tags([])]} />)
    const row = html.match(/<div data-filter-controls[^>]*>/)?.[0] ?? ""
    const panel = html.match(/<div class="[^"]*\babsolute\b[^"]*"/)?.[0] ?? ""

    expect(row).toContain("pc-scrollbar")
    for (const name of ["max-sm:fixed", "max-sm:inset-x-0", "max-sm:bottom-0", "max-sm:top-auto"]) {
      expect(panel).toContain(name)
    }
    expect(html).toMatch(/<div aria-hidden="true" class="[^"]*sm:hidden[^"]*">Tags<\/div>/)
  })

  it("puts search and every control in one wrapping row from sm up, search first", () => {
    const html = render(
      <FilterBar search={{ value: "", onChange: () => {} }} filters={[tags([])]} />,
    )
    const row = html.match(/<div data-filter-controls[^>]*>/)?.[0] ?? ""

    // The controls' own box drops out from sm up, so they wrap on the search field's row.
    expect(row).toContain("sm:contents")
    expect(html).toMatch(/<div class="[^"]*sm:flex-wrap[^"]*"><div class="relative[^"]*"><label/)
  })

  it("makes every item of a phone sheet 44 px tall, the header's included", () => {
    const panel = render(<FilterBar filters={[tags([])]} />)
      .match(/<div class="[^"]*\babsolute\b[^"]*"/)?.[0] ?? ""

    expect(panel).toContain("max-sm:[&amp;_button]:min-h-11")
    expect(panel).toContain("max-sm:[&amp;_a]:min-h-11")
  })

  it("names the header with a visible heading when headerLabel is given", () => {
    const menu = { ...tags([]), headerLabel: "Show notes with", header: <i>switch</i> }
    const html = render(<FilterBar filters={[menu]} />)
    const id = html.match(/<div role="group" aria-labelledby="([^"]+)"/)?.[1]

    expect(id).toBeTruthy()
    expect(html).toContain(
      `<div id="${id}" class="px-4 pt-2 pb-1 text-xs font-medium text-muted">Show notes with</div><i>switch</i>`,
    )
  })

  it("ends a multiple menu with a Done item shown only on a phone, and a single menu without one", () => {
    const html = render(<FilterBar filters={[tags([]), author(null)]} />)

    expect(html.match(/>Done<\/button>/g)?.length).toBe(1)
    expect(html).toMatch(/<button[^>]*class="[^"]*\bsm:hidden\b[^"]*"[^>]*>Done<\/button>/)
    expect(render(<FilterBar filters={[tags([])]} doneLabel="Close" />)).toMatch(/>Close<\/button>/)
  })
})
