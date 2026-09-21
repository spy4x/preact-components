import { expect } from "@std/expect"
import { readFileSync } from "node:fs"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  activeDescendant,
  Combobox,
  type ComboboxKey,
  comboboxKey,
  comboboxKeyAction,
  comboboxListboxId,
  comboboxOptionId,
  type ComboboxState,
  defaultGetLabel,
  filterItems,
  fold,
  leavesCombobox,
  listboxContent,
  matchesQuery,
  naming,
  nextComboboxState,
  openingState,
  selectableIndex,
  typingState,
} from "./combobox.tsx"

/** Closed, nothing highlighted: the state every reducer case starts from unless it says otherwise. */
const closed: ComboboxState = { activeIndex: -1, isOpen: false }

/** Open with `active` highlighted. */
const openAt = (active: number): ComboboxState => ({ activeIndex: active, isOpen: true })

describe("fold", () => {
  it("lower-cases", () => {
    expect(fold("Bitcoin")).toBe("bitcoin")
  })

  it("strips diacritics", () => {
    expect(fold("São Paulo")).toBe("sao paulo")
    expect(fold("ÉCU")).toBe("ecu")
    expect(fold("Zürich")).toBe("zurich")
  })

  it("leaves text without diacritics untouched", () => {
    expect(fold("usd/eur 100%")).toBe("usd/eur 100%")
  })

  it("is idempotent", () => {
    expect(fold(fold("Ünïcödé"))).toBe(fold("Ünïcödé"))
  })
})

describe("defaultGetLabel", () => {
  it("stringifies a string", () => {
    expect(defaultGetLabel("BTC")).toBe("BTC")
  })

  it("stringifies a number", () => {
    expect(defaultGetLabel(42)).toBe("42")
  })

  it("stringifies an object rather than throwing", () => {
    expect(defaultGetLabel({ id: 1 })).toBe("[object Object]")
  })
})

describe("matchesQuery", () => {
  it("matches everything against an empty query", () => {
    expect(matchesQuery("BTC", "")).toBe(true)
  })

  it("treats a whitespace-only query as empty", () => {
    expect(matchesQuery("BTC", "   ")).toBe(true)
  })

  it("matches a substring", () => {
    expect(matchesQuery("Bitcoin", "coin")).toBe(true)
  })

  it("matches case-insensitively", () => {
    expect(matchesQuery("Bitcoin", "BIT")).toBe(true)
    expect(matchesQuery("bitcoin", "BIT")).toBe(true)
  })

  it("ignores diacritics on both sides", () => {
    expect(matchesQuery("São Paulo", "sao")).toBe(true)
    expect(matchesQuery("Sao Paulo", "são")).toBe(true)
  })

  it("ignores surrounding whitespace in the query", () => {
    expect(matchesQuery("Bitcoin", "  coin  ")).toBe(true)
  })

  it("rejects a query the label does not contain", () => {
    expect(matchesQuery("Bitcoin", "ethereum")).toBe(false)
    expect(matchesQuery("Bitcoin", "coins")).toBe(false)
  })

  it("matches against the label the caller supplies", () => {
    const item = { code: "BTC", name: "Bitcoin" }
    expect(matchesQuery(item, "coin", (entry) => entry.name)).toBe(true)
    expect(matchesQuery(item, "coin", (entry) => entry.code)).toBe(false)
  })

  it("keeps the file's own row when the query is empty even for objects", () => {
    expect(matchesQuery({ code: "BTC" }, "")).toBe(true)
  })
})

describe("filterItems", () => {
  const items = ["Bitcoin", "Ethereum", "Litecoin"]

  it("returns every item for an empty query", () => {
    expect(filterItems(items, "")).toEqual(items)
  })

  it("returns every item for a whitespace-only query", () => {
    expect(filterItems(items, "  ")).toEqual(items)
  })

  it("keeps the original order", () => {
    expect(filterItems(items, "coin")).toEqual(["Bitcoin", "Litecoin"])
  })

  it("is case-insensitive", () => {
    expect(filterItems(items, "ETHER")).toEqual(["Ethereum"])
  })

  it("matches mid-word, not just a prefix", () => {
    expect(filterItems(items, "her")).toEqual(["Ethereum"])
  })

  it("returns an empty list when nothing matches", () => {
    expect(filterItems(items, "dogecoin")).toEqual([])
  })

  it("returns an empty list for an empty input list", () => {
    expect(filterItems([], "")).toEqual([])
    expect(filterItems([], "btc")).toEqual([])
  })

  it("never mutates the input", () => {
    const source = [...items]
    filterItems(source, "coin")
    expect(source).toEqual(items)
  })

  it("filters objects through the caller's getLabel", () => {
    const rows = [{ code: "BTC", name: "Bitcoin" }, { code: "ETH", name: "Ethereum" }]
    expect(filterItems(rows, "ether", (row) => row.name).map((row) => row.code)).toEqual(["ETH"])
  })

  it("folds diacritics in both the label and the query", () => {
    expect(filterItems(["São Paulo", "Santiago"], "sao")).toEqual(["São Paulo"])
  })
})

describe("nextComboboxState", () => {
  it("opens on ArrowDown from closed and activates the first option", () => {
    expect(nextComboboxState(closed, "ArrowDown", 3)).toEqual({
      activeIndex: 0,
      isOpen: true,
      handled: true,
    })
  })

  it("moves down one from a fresh open", () => {
    expect(nextComboboxState(openAt(0), "ArrowDown", 3).activeIndex).toBe(1)
  })

  it("wraps from the last option to the first", () => {
    expect(nextComboboxState(openAt(2), "ArrowDown", 3).activeIndex).toBe(0)
  })

  it("wraps from the first option up to the last", () => {
    expect(nextComboboxState(openAt(0), "ArrowUp", 3).activeIndex).toBe(2)
  })

  it("opens on ArrowUp from closed and activates the last option", () => {
    expect(nextComboboxState(closed, "ArrowUp", 3)).toEqual({
      activeIndex: 2,
      isOpen: true,
      handled: true,
    })
  })

  it("treats a stale out-of-range active index as no active option", () => {
    expect(nextComboboxState({ activeIndex: 7, isOpen: true }, "ArrowDown", 3).activeIndex).toBe(0)
    expect(nextComboboxState({ activeIndex: 7, isOpen: true }, "ArrowUp", 3).activeIndex).toBe(2)
    expect(nextComboboxState({ activeIndex: -4, isOpen: true }, "ArrowDown", 3).activeIndex).toBe(0)
  })

  it("keeps the list open and nothing active when the filtered list is empty", () => {
    expect(nextComboboxState(closed, "ArrowDown", 0)).toEqual({
      activeIndex: -1,
      isOpen: true,
      handled: true,
    })
    expect(nextComboboxState(openAt(-1), "ArrowUp", 0)).toEqual({
      activeIndex: -1,
      isOpen: true,
      handled: true,
    })
  })

  it("activates the single option from both directions", () => {
    expect(nextComboboxState(closed, "ArrowDown", 1).activeIndex).toBe(0)
    expect(nextComboboxState(closed, "ArrowUp", 1).activeIndex).toBe(0)
    expect(nextComboboxState(openAt(0), "ArrowDown", 1).activeIndex).toBe(0)
    expect(nextComboboxState(openAt(0), "ArrowUp", 1).activeIndex).toBe(0)
  })

  it("opens with nothing active on Alt+ArrowDown", () => {
    expect(nextComboboxState(closed, "Alt+ArrowDown", 3)).toEqual({
      activeIndex: -1,
      isOpen: true,
      handled: true,
    })
  })

  it("clears the highlight without closing on Alt+ArrowDown", () => {
    expect(nextComboboxState(openAt(2), "Alt+ArrowDown", 3)).toEqual({
      activeIndex: -1,
      isOpen: true,
      handled: true,
    })
  })

  it("closes on Alt+ArrowUp from both states", () => {
    expect(nextComboboxState(openAt(1), "Alt+ArrowUp", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
    expect(nextComboboxState(closed, "Alt+ArrowUp", 3).isOpen).toBe(false)
  })

  it("jumps to the first option on Home while open", () => {
    expect(nextComboboxState(openAt(2), "Home", 3).activeIndex).toBe(0)
  })

  it("jumps to the last option on End while open", () => {
    expect(nextComboboxState(openAt(0), "End", 3).activeIndex).toBe(2)
  })

  it("ignores Home and End while closed, so the caret keeps them", () => {
    expect(nextComboboxState(closed, "Home", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
    expect(nextComboboxState(closed, "End", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
  })

  it("ignores Home and End when the filtered list is empty", () => {
    expect(nextComboboxState(openAt(-1), "Home", 0).activeIndex).toBe(-1)
    expect(nextComboboxState(openAt(-1), "End", 0).activeIndex).toBe(-1)
  })

  it("closes on Enter and clears the highlight, leaving the choice to the caller", () => {
    expect(nextComboboxState(openAt(1), "Enter", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
  })

  it("ignores Enter while closed", () => {
    expect(nextComboboxState(closed, "Enter", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
  })

  it("closes on Escape, keeping the query where it is", () => {
    expect(nextComboboxState(openAt(2), "Escape", 3)).toEqual({
      activeIndex: -1,
      isOpen: false,
      handled: true,
    })
  })

  it("ignores Escape while closed", () => {
    expect(nextComboboxState(closed, "Escape", 3).isOpen).toBe(false)
  })

  it("never mutates the state it was given", () => {
    const state = openAt(1)
    nextComboboxState(state, "ArrowDown", 3)
    expect(state).toEqual({ activeIndex: 1, isOpen: true })
  })

  it("answers every key in the table", () => {
    const keys: ComboboxKey[] = [
      "ArrowDown",
      "ArrowUp",
      "Alt+ArrowDown",
      "Alt+ArrowUp",
      "Home",
      "End",
      "Enter",
      "Escape",
    ]
    for (const key of keys) {
      for (const count of [0, 1, 3]) {
        expect(nextComboboxState(closed, key, count).handled).toBe(true)
        expect(nextComboboxState(openAt(0), key, count).handled).toBe(true)
      }
    }
  })
})

describe("comboboxKey", () => {
  it("maps a plain arrow key", () => {
    expect(comboboxKey({ key: "ArrowDown", altKey: false })).toBe("ArrowDown")
    expect(comboboxKey({ key: "ArrowUp", altKey: false })).toBe("ArrowUp")
  })

  it("maps the alt-arrow pair", () => {
    expect(comboboxKey({ key: "ArrowDown", altKey: true })).toBe("Alt+ArrowDown")
    expect(comboboxKey({ key: "ArrowUp", altKey: true })).toBe("Alt+ArrowUp")
  })

  it("maps Home, End, Enter and Escape", () => {
    expect(comboboxKey({ key: "Home", altKey: false })).toBe("Home")
    expect(comboboxKey({ key: "End", altKey: false })).toBe("End")
    expect(comboboxKey({ key: "Enter", altKey: false })).toBe("Enter")
    expect(comboboxKey({ key: "Escape", altKey: false })).toBe("Escape")
  })

  it("ignores typing so the platform keeps it", () => {
    expect(comboboxKey({ key: "a", altKey: false })).toBeUndefined()
    expect(comboboxKey({ key: " ", altKey: false })).toBeUndefined()
  })

  it("ignores Tab, which moves focus out", () => {
    expect(comboboxKey({ key: "Tab", altKey: false })).toBeUndefined()
  })

  it("ignores alt-modified keys it has no rule for", () => {
    expect(comboboxKey({ key: "Home", altKey: true })).toBeUndefined()
    expect(comboboxKey({ key: "Enter", altKey: true })).toBeUndefined()
  })
})

describe("comboboxKeyAction", () => {
  it("keeps the caret keys for the browser while closed", () => {
    expect(comboboxKeyAction("Home", closed, 3).preventDefault).toBe(false)
    expect(comboboxKeyAction("End", closed, 3).preventDefault).toBe(false)
  })

  it("takes the caret keys over once the list is open", () => {
    expect(comboboxKeyAction("Home", openAt(2), 3)).toEqual({
      state: { activeIndex: 0, isOpen: true },
      preventDefault: true,
      select: -1,
    })
    expect(comboboxKeyAction("End", openAt(0), 3).state.activeIndex).toBe(2)
    expect(comboboxKeyAction("End", openAt(0), 3).preventDefault).toBe(true)
  })

  it("consumes the arrows, which would otherwise scroll the page", () => {
    expect(comboboxKeyAction("ArrowDown", closed, 3).preventDefault).toBe(true)
    expect(comboboxKeyAction("ArrowUp", openAt(0), 3).preventDefault).toBe(true)
    expect(comboboxKeyAction("Alt+ArrowDown", closed, 3).preventDefault).toBe(true)
    expect(comboboxKeyAction("Alt+ArrowUp", openAt(0), 3).preventDefault).toBe(true)
  })

  it("consumes Escape, which Safari would use to clear the input", () => {
    expect(comboboxKeyAction("Escape", openAt(1), 3)).toEqual({
      state: { activeIndex: -1, isOpen: false },
      preventDefault: true,
      select: -1,
    })
    expect(comboboxKeyAction("Escape", closed, 3).preventDefault).toBe(true)
  })

  it("selects the highlighted option on Enter", () => {
    expect(comboboxKeyAction("Enter", openAt(1), 3)).toEqual({
      state: { activeIndex: -1, isOpen: false },
      preventDefault: true,
      select: 1,
    })
  })

  it("selects nothing on Enter with no highlight", () => {
    expect(comboboxKeyAction("Enter", openAt(-1), 3).select).toBe(-1)
  })

  it("selects nothing on Enter while closed", () => {
    expect(comboboxKeyAction("Enter", closed, 3)).toEqual({
      state: { activeIndex: -1, isOpen: false },
      preventDefault: true,
      select: -1,
    })
  })

  it("opens on the arrows and reports the new highlight", () => {
    expect(comboboxKeyAction("ArrowDown", closed, 3).state).toEqual({
      activeIndex: 0,
      isOpen: true,
    })
    expect(comboboxKeyAction("Alt+ArrowDown", closed, 3).state).toEqual({
      activeIndex: -1,
      isOpen: true,
    })
  })
})

describe("ids and aria-activedescendant", () => {
  it("derives the listbox id from the base id", () => {
    expect(comboboxListboxId("cb")).toBe("cb-listbox")
  })

  it("derives an option id per index", () => {
    expect(comboboxOptionId("cb", 0)).toBe("cb-option-0")
    expect(comboboxOptionId("cb", 2)).toBe("cb-option-2")
  })

  it("points at the active option while open", () => {
    expect(activeDescendant("cb", openAt(0))).toBe("cb-option-0")
    expect(activeDescendant("cb", openAt(2))).toBe("cb-option-2")
  })

  it("omits the pointer when nothing is highlighted", () => {
    expect(activeDescendant("cb", openAt(-1))).toBeUndefined()
  })

  it("omits the pointer while closed, so it never dangles", () => {
    expect(activeDescendant("cb", { activeIndex: 0, isOpen: false })).toBeUndefined()
  })
})

/**
 * An `items` array that counts the element reads made through it.
 *
 * `indexOf` walks the array by reading every slot, so a per-row scan shows up as a read count that
 * grows with the square of the item count — the property the single-pass index has to keep, and one
 * that is visible from the order of operations alone. No clock, no warm-up, no flake: a timing
 * assertion is not evidence of complexity.
 */
function countingItems(values: string[]): { items: string[]; reads: () => number } {
  let reads = 0
  const items = new Proxy(values, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads++
      return Reflect.get(target, property, receiver)
    },
  })
  return { items, reads: () => reads }
}

/** Distinct labels, so a fixture is reproducible and every index is addressable. */
function labels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Item ${index}`)
}

/** Element reads the whole combobox makes rendering `count` items with the last one selected. */
function readsPerRender(count: number): number {
  const { items, reads } = countingItems(labels(count))
  render(<Combobox items={items} value={items[count - 1]} onChange={() => {}} />)
  return reads()
}

describe("Combobox render cost", () => {
  it("reads the item list once per render, not once per option", () => {
    const size = 200
    const total = readsPerRender(size)

    // A single pass is `2n + 1`: one walk to build the index, one to filter, one read of the
    // selected item. The bound leaves room; a per-row scan is `n² + 2n + 1` here, 40 401.
    expect(
      total,
      `rendering ${size} options read the item array ${total} times; an index built in one pass reads it O(n)`,
    ).toBeLessThanOrEqual(3 * size)
  })

  it("stays linear when the list grows", () => {
    const small = readsPerRender(100)
    const large = readsPerRender(300)
    const ratio = large / small

    // Three times the items must not cost nine times the reads: 100 -> 300 items is 9x for a
    // per-row scan and 3x for a single pass.
    expect(
      ratio,
      `3x the items cost ${
        ratio.toFixed(2)
      }x the item reads (${small} -> ${large}); a per-row scan costs 9x`,
    ).toBeLessThanOrEqual(6)
  })
})

/**
 * The whole live region, its own opening tag included.
 *
 * The region is the last child of the component's root, so its markup runs from its opening tag to
 * just before the root's closing tag — which is what lets these tests assert that a message is
 * *inside* it rather than merely somewhere in the same render.
 *
 * Throws rather than returning `undefined`: a combobox with no live region at all is the failure
 * these tests exist to catch, and it must not read as "no assertion to make here".
 */
function statusRegion(html: string): string {
  const at = html.indexOf(' role="status"')
  if (at < 0) throw new Error(`no live region in this render: ${html.slice(0, 200)}`)
  return html.slice(html.lastIndexOf("<", at), html.length - "</div>".length)
}

/** The `id` of that region. */
function statusRegionId(html: string): string {
  const id = /id="([^"]+)"/.exec(statusRegion(html))?.[1]
  if (id === undefined) throw new Error(`the live region carries no id: ${statusRegion(html)}`)
  return id
}

/** The exact markup of an empty live region belonging to the input with this id. */
function emptyRegion(inputId: string): string {
  return `<div id="${inputId}-status" role="status" aria-live="polite" aria-atomic="true"></div>`
}

/** The `id` the component gave its input. */
function inputId(html: string): string {
  const id = /<input[^>]*id="([^"]+)"/.exec(html)?.[1]
  if (id === undefined) throw new Error(`no input in this render: ${html.slice(0, 200)}`)
  return id
}

/** How many times the exact attribute `id="…"` appears in rendered markup. */
function countId(html: string, id: string): number {
  return html.split(`id="${id}"`).length - 1
}

describe("Combobox markup", () => {
  const items = ["BTC", "ETH", "USD"]

  it("starts closed and announces itself as a collapsed combobox", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)

    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
  })

  it("carries no active descendant while closed", () => {
    expect(render(<Combobox items={items} value="ETH" onChange={() => {}} />))
      .not.toContain("aria-activedescendant")
  })

  it("points aria-controls at the listbox it renders, even closed", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1]
    const listbox = /<ul[^>]*id="([^"]+)"/.exec(html)?.[1]

    expect(controls).toBeDefined()
    expect(controls).toBe(listbox)
    expect(html).toContain('role="listbox"')
  })

  it("hides the listbox with the attribute while closed, at markup level", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)
    const listboxId = /aria-controls="([^"]+)"/.exec(html)?.[1]

    // The `hidden` attribute, not a utility class: the popup must disappear without the stylesheet.
    expect(listboxId).toBeDefined()
    expect(html).toContain(`<ul id="${listboxId}" role="listbox" hidden`)
    expect(html.match(/role="option"/g)?.length).toBe(3)
  })

  it("marks the selected option and only that one", () => {
    const html = render(<Combobox items={items} value="ETH" onChange={() => {}} />)

    expect(html.match(/aria-selected="true"/g)?.length).toBe(1)
    expect(html.match(/aria-selected="false"/g)?.length).toBe(2)
    const selected = /<li[^>]*aria-selected="true"[^>]*>(ETH)<\/li>/.exec(html)
    expect(selected).not.toBeNull()
  })

  it("marks the selected rows through the item index, duplicates included", () => {
    const html = render(<Combobox items={["BTC", "ETH", "BTC"]} value="BTC" onChange={() => {}} />)

    // `items.indexOf("BTC")` reports 0 for both rows, and the index keeps that first-occurrence
    // rule: the duplicate rows stay selected exactly as they did before the lookup changed.
    expect(html.match(/aria-selected="true"/g)?.length).toBe(2)
  })

  it("treats a NaN selection as no selection, as indexOf does", () => {
    const html = render(
      <Combobox items={[1, Number.NaN, 3]} value={Number.NaN} onChange={() => {}} />,
    )

    expect(html.match(/aria-selected="true"/g)).toBeNull()
    expect(html.match(/aria-selected="false"/g)?.length).toBe(3)
  })

  it("paints the selected option, and leaves the unselected ones on the base text colour", () => {
    const html = render(<Combobox items={items} value="ETH" onChange={() => {}} />)

    expect(html).toContain("bg-blue-50 font-medium text-blue-700")
    // `cn` resolves last-wins, so the base colour must not survive on an unselected row as a
    // stray `text-gray-900` that the selected row's blue lost to.
    expect(html.match(/text-gray-900/g)?.length).toBe(2)
  })

  it("renders one option per item, in order, with ids derived from the input id", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)
    const baseId = /<input[^>]*id="([^"]+)"/.exec(html)?.[1]

    expect(baseId).toBeDefined()
    for (const [index, item] of items.entries()) {
      expect(html).toContain(`id="${comboboxOptionId(baseId!, index)}"`)
      expect(html).toContain(`>${item}</li>`)
    }
  })

  it("uses the placeholder and shows no value without a selection", () => {
    const html = render(
      <Combobox items={items} onChange={() => {}} placeholder="Pick a coin" />,
    )

    expect(html).toContain('placeholder="Pick a coin"')
    // Preact drops the `=""` of an empty string attribute, so the closed input renders as `value`.
    expect(html).toContain(" value ")
  })

  it("renders labels through getLabel", () => {
    const rows = [{ code: "BTC", name: "Bitcoin" }]
    const html = render(
      <Combobox items={rows} onChange={() => {}} getLabel={(row) => row.name} />,
    )

    expect(html).toContain("Bitcoin")
    expect(html).not.toContain("BTC")
  })

  it("shows the empty message when the query matches nothing", () => {
    const html = render(<Combobox items={items} onChange={() => {}} query="zzz" />)

    expect(html).toContain("No matches")
    expect(html.match(/role="option"/g)).toBeNull()
  })

  it("keeps the listbox empty when the query matches nothing, with no non-option child", () => {
    const html = render(<Combobox items={items} onChange={() => {}} query="zzz" />)
    const listbox = /<ul id="[^"]+" role="listbox"[^>]*>(.*?)<\/ul>/.exec(html)?.[1]

    // `role="listbox"` may only contain `role="option"` or `role="group"`, so the message lives
    // outside it; a message row inside is an `aria-required-children` violation.
    expect(listbox).toBe("")
    expect(html).not.toContain('role="presentation"')
  })

  it("renders one empty live region before there is anything to announce", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)

    // The whole of this change, in one string: a marked, empty region in the first render — the
    // server render included — so that a message can later arrive as a *change* to an element a
    // reader was already watching. A region created together with its message is the shape
    // assistive technology announces least reliably.
    expect(html).toContain(emptyRegion(inputId(html)))
    expect(html.match(/role="status"/g)?.length).toBe(1)
  })

  it("gives every combobox on the page its own live region", () => {
    const html = render(
      <div>
        <Combobox items={items} onChange={() => {}} ariaLabel="First" />
        <Combobox items={items} onChange={() => {}} ariaLabel="Second" />
      </div>,
    )
    const regions = html.match(/id="([^"]+)-status"/g) ?? []
    const inputs = html.match(/<input[^>]*id="([^"]+)"/g) ?? []

    // Two fields, two regions, no id in common: a shared region would have one field's answer
    // arriving in the other field's ear.
    expect(inputs.length).toBe(2)
    expect(regions.length).toBe(2)
    expect(new Set(regions).size).toBe(2)
  })

  it("never describes the input by its live region", () => {
    // The region holds a status, not a description. A description is re-read every time the input
    // is announced, so a count would be spoken as part of the field's identity long after it was
    // true — and in the moment it is new it would be both described and announced.
    for (const query of ["", "t", "zzz"]) {
      expect(render(<Combobox items={items} onChange={() => {}} query={query} />))
        .not.toContain("aria-describedby")
    }
  })

  it("puts the empty message inside the region that was already there, once", () => {
    const html = render(
      <Combobox items={items} onChange={() => {}} query="zzz" emptyMessage="Nada" />,
    )
    const statusId = statusRegionId(html)

    // The regression this pins: the message used to be rendered twice — visibly, and again in a
    // visually hidden `role="status"` copy — so one empty keystroke was both described and
    // announced. One region, holding the one visible copy, is what replaced that.
    const elements = countId(html, statusId)
    expect(
      elements,
      `id="${statusId}" resolves to ${elements} elements; it must resolve to exactly 1`,
    ).toBe(1)

    const copies = html.split("Nada").length - 1
    expect(
      copies,
      `the empty message "Nada" is rendered in ${copies} elements; it must be rendered exactly once`,
    ).toBe(1)
    expect(statusRegion(html), "the message must be inside the live region").toContain("Nada")
  })

  it("renders a JSX empty state inside the live region too", () => {
    const html = render(
      <Combobox
        items={items}
        onChange={() => {}}
        query="zzz"
        emptyMessage={() => <em>Nada</em>}
      />,
    )

    // The caller's node is the region's content, not a sibling beside it — which is what a hidden
    // copy of the message would be, and what would make the two drift apart.
    expect(statusRegion(html)).toContain("<em>Nada</em>")
    expect(html.split("Nada").length - 1).toBe(1)
  })

  it("keeps the live region empty while the list has options and nobody has typed", () => {
    const html = render(<Combobox items={items} onChange={() => {}} />)

    expect(statusRegion(html)).toBe(emptyRegion(inputId(html)))
  })

  it("says nothing about matches on an untouched field whose list is empty", () => {
    // The defect: a page whose options arrive over the network renders this combobox with `items`
    // still empty, and the closed field showed "No matches" and announced it through a live
    // region — to everyone, about a control nobody had touched.
    const html = render(<Combobox items={[]} onChange={() => {}} ariaLabel="Currency" />)

    expect(html).not.toContain("No matches")
    // The region is there, which is the point of it; what it must not carry is a word.
    expect(statusRegion(html)).toBe(emptyRegion(inputId(html)))
    // Still a working, collapsed combobox — it is silent, not broken.
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('role="listbox"')
  })

  it("stays silent on an untouched empty field whatever the caller's message says", () => {
    const text = render(
      <Combobox items={[]} onChange={() => {}} emptyMessage="Still loading the list" />,
    )
    const fromQuery = render(
      <Combobox items={[]} onChange={() => {}} emptyMessage={(query) => `Nothing for ${query}`} />,
    )

    expect(text).not.toContain("Still loading the list")
    expect(fromQuery).not.toContain("Nothing for")
    expect(statusRegion(text)).toBe(emptyRegion(inputId(text)))
    expect(statusRegion(fromQuery)).toBe(emptyRegion(inputId(fromQuery)))
  })

  it("answers with the empty message once the field carries a query", () => {
    // The pair that makes the silence above a rule rather than an accident: the same empty list and
    // the same message, and the only difference is that somebody has typed.
    const untouched = render(<Combobox items={[]} onChange={() => {}} />)
    const typed = render(<Combobox items={[]} onChange={() => {}} query="btc" />)

    expect(untouched).not.toContain("No matches")
    expect(statusRegion(untouched)).toBe(emptyRegion(inputId(untouched)))
    expect(statusRegion(typed)).toContain("No matches")
  })

  it("treats a caller's empty query like no query at all", () => {
    // A controlled query belongs to the caller, and an empty one has asked as little as an
    // untouched draft: a server-search field rendered with `query=""` is a field nobody has used.
    const silent = render(<Combobox items={[]} onChange={() => {}} query="" />)
    const asked = render(<Combobox items={[]} onChange={() => {}} query="btc" />)

    expect(silent).not.toContain("No matches")
    expect(statusRegion(silent)).toBe(emptyRegion(inputId(silent)))
    expect(statusRegion(asked)).toContain("No matches")
  })

  it("says nothing on an untouched field holding one option, or several", () => {
    for (const list of [["BTC"], items]) {
      const html = render(<Combobox items={list} onChange={() => {}} />)

      expect(statusRegion(html), `a closed field over ${list.length} option(s)`)
        .toBe(emptyRegion(inputId(html)))
      expect(html).not.toContain("No matches")
    }
  })

  it("announces how many options the query left, inside that same region", () => {
    // `"t"` folds into `"BTC"` and `"ETH"` but not `"USD"`, so the number is a fact about the
    // list rather than a copy of it — case-folded, like every other match this component makes.
    const html = render(<Combobox items={items} onChange={() => {}} query="t" />)

    expect(statusRegion(html)).toContain('<span class="sr-only">2 matches</span>')
    expect(statusRegionId(html)).toBe(`${inputId(html)}-status`)
  })

  it("counts a single match in the singular", () => {
    expect(statusRegion(render(<Combobox items={items} onChange={() => {}} query="U" />)))
      .toContain(">1 match<")
  })

  it("takes the count wording from the caller, and defaults it to English otherwise", () => {
    expect(statusRegion(render(<Combobox items={items} onChange={() => {}} query="t" />)))
      .toContain(">2 matches<")
    expect(
      statusRegion(
        render(
          <Combobox
            items={items}
            onChange={() => {}}
            query="t"
            countMessage={(count) => `noch ${count} Treffer`}
          />,
        ),
      ),
    ).toContain(">noch 2 Treffer<")
  })

  it("counts nothing on a field nobody has typed in, however long its list is", () => {
    // The count answers typing. A field that has only been rendered has not been asked anything,
    // which is the rule an earlier fix put on the empty message and this one keeps.
    const html = render(<Combobox items={items} onChange={() => {}} />)

    expect(html).not.toContain("matches")
    expect(statusRegion(html)).toBe(emptyRegion(inputId(html)))
  })

  it("announces the empty message rather than a count of nothing", () => {
    // Both in one region would say the same thing twice, and "0 matches" says it worse.
    const html = render(<Combobox items={items} onChange={() => {}} query="zzz" />)

    expect(statusRegion(html)).toContain("No matches")
    expect(statusRegion(html)).not.toContain("sr-only")
  })

  it("takes an overridden placeholder, and defaults it to English otherwise", () => {
    expect(render(<Combobox items={items} onChange={() => {}} />))
      .toContain('placeholder="Select…"')
    expect(render(<Combobox items={items} onChange={() => {}} placeholder="Währung wählen" />))
      .toContain('placeholder="Währung wählen"')
  })

  it("takes an overridden clear label, and defaults it to English otherwise", () => {
    expect(render(<Combobox items={items} value="ETH" onChange={() => {}} />))
      .toContain('aria-label="Clear selection"')
    expect(
      render(
        <Combobox items={items} value="ETH" onChange={() => {}} clearLabel="Auswahl löschen" />,
      ),
    ).toContain('aria-label="Auswahl löschen"')
  })

  it("takes the empty message from the caller, as text or as a function of the query", () => {
    expect(render(<Combobox items={items} onChange={() => {}} query="zzz" emptyMessage="Nada" />))
      .toContain("Nada")
    expect(
      render(
        <Combobox
          items={items}
          onChange={() => {}}
          query="zzz"
          emptyMessage={(text) => `Nothing for ${text}`}
        />,
      ),
    ).toContain("Nothing for zzz")
  })

  it("shows the selection in the input while closed", () => {
    const html = render(<Combobox items={items} value="ETH" onChange={() => {}} />)

    expect(html).toContain('value="ETH"')
  })

  it("shows no value at all when nothing is selected", () => {
    const html = render(<Combobox items={items} value={null} onChange={() => {}} />)

    expect(html).toContain(" value ")
    expect(html).not.toContain('value="')
  })

  it("shows no value when the selection is not one of the items", () => {
    expect(render(<Combobox items={items} value="EUR" onChange={() => {}} />))
      .not.toContain('value="EUR"')
  })

  it("shows a numeric selection", () => {
    const html = render(<Combobox items={[1, 2, 3]} value={2} onChange={() => {}} />)

    expect(html).toContain('value="2"')
    expect(html.match(/aria-selected="true"/g)?.length).toBe(1)
  })

  it("counts the selection by value, not by label, for objects", () => {
    const rows = [{ id: 1, name: "One" }, { id: 2, name: "Two" }]
    const html = render(
      <Combobox
        items={rows}
        value={rows[1]}
        onChange={() => {}}
        getLabel={(row) => row.name}
      />,
    )

    expect(html).toContain('value="Two"')
    expect(html).toContain('<li id="P0-0-option-1" role="option" aria-selected="true"')
  })

  it("filters the option list by the controlled query", () => {
    const html = render(<Combobox items={items} onChange={() => {}} query="et" />)

    expect(html.match(/role="option"/g)?.length).toBe(1)
    expect(html).toContain(">ETH</li>")
    expect(html).not.toContain(">USD</li>")
  })

  it("takes a custom filter wholesale", () => {
    const html = render(
      <Combobox items={items} onChange={() => {}} query="ignored" filter={(all) => [...all]} />,
    )

    expect(html.match(/role="option"/g)?.length).toBe(3)
  })

  it("lets renderOption own the option content", () => {
    const html = render(
      <Combobox
        items={items}
        value="BTC"
        onChange={() => {}}
        renderOption={(item, state) => (
          <span data-e2e={item}>{state.selected ? "picked" : "idle"}</span>
        )}
      />,
    )

    expect(html).toContain('data-e2e="BTC"')
    expect(html).toContain("picked")
    expect(html).toContain("idle")
  })

  it("marks a disabled item and leaves the rest alone", () => {
    const html = render(
      <Combobox items={items} onChange={() => {}} isItemDisabled={(item) => item === "ETH"} />,
    )

    expect(html.match(/aria-disabled="true"/g)?.length).toBe(1)
  })

  it("renders no clear button without a selection or a query", () => {
    expect(render(<Combobox items={items} onChange={() => {}} />))
      .not.toContain('aria-label="Clear selection"')
  })

  it("renders a named clear button when something is selected", () => {
    const html = render(<Combobox items={items} value="ETH" onChange={() => {}} />)

    expect(html).toContain('aria-label="Clear selection"')
    expect(html).toContain('type="button"')
  })

  it("renders the clear button when only the query has content", () => {
    expect(render(<Combobox items={items} onChange={() => {}} query="bt" />))
      .toContain('aria-label="Clear selection"')
  })

  it("takes the clear button's accessible name from the caller", () => {
    expect(render(<Combobox items={items} value="ETH" onChange={() => {}} clearLabel="Effacer" />))
      .toContain('aria-label="Effacer"')
  })

  it("can turn the clear button off", () => {
    expect(
      render(
        <Combobox items={items} value="ETH" onChange={() => {}} showClearButton={false} />,
      ),
    ).not.toContain("aria-label=")
  })

  it("names the input and the listbox for assistive tech", () => {
    const html = render(<Combobox items={items} onChange={() => {}} ariaLabel="Currency" />)

    expect(html.match(/aria-label="Currency"/g)?.length).toBe(2)
  })

  it("takes an id so a visible label can point at the input", () => {
    const html = render(<Combobox items={items} onChange={() => {}} id="coin" ariaLabel="Coin" />)

    expect(html).toContain('<input id="coin"')
    expect(html).toContain('aria-controls="coin-listbox"')
    expect(html).toContain('<ul id="coin-listbox"')
    expect(html).toContain('id="coin-option-0"')
  })

  it("can be named by the caller's own label instead of aria-label", () => {
    const html = render(
      <Combobox
        items={items}
        onChange={() => {}}
        id="coin"
        aria-labelledby="coin-label"
      />,
    )

    expect(html.match(/aria-labelledby="coin-label"/g)?.length).toBe(2)
    expect(html).not.toContain("aria-label=")
  })

  it("falls back to a generated id when the caller passes none", () => {
    const html = render(<Combobox items={items} onChange={() => {}} ariaLabel="Coin" />)
    const id = /<input id="([^"]+)"/.exec(html)?.[1]

    expect(id).toBeDefined()
    expect(html).toContain(`aria-controls="${id}-listbox"`)
  })

  it("appends caller classes instead of replacing the component's own", () => {
    const html = render(
      <Combobox
        items={items}
        onChange={() => {}}
        class="w-64"
        inputClass="pl-9"
        listboxClass="max-h-40"
      />,
    )

    expect(html).toContain("w-64")
    expect(html).toContain("pl-9")
    expect(html).toContain("input")
    expect(html).toContain("max-h-40")
  })

  it("gives every combobox on a page its own ids", () => {
    const html = render(
      <div>
        <Combobox items={items} onChange={() => {}} />
        <Combobox items={items} onChange={() => {}} />
      </div>,
    )
    const ids = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map((match) => match[1])

    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
  })
})

describe("selectableIndex", () => {
  const list = ["a", "b", "c"]

  it("prefers the selected index", () => {
    expect(selectableIndex(list, 2)).toBe(2)
  })

  it("falls back to the first item when nothing is selected", () => {
    expect(selectableIndex(list, -1)).toBe(0)
  })

  it("falls back to the first item when the selection is filtered out", () => {
    expect(selectableIndex(["x", "y"], 0)).toBe(0)
    expect(selectableIndex([], 0)).toBe(-1)
  })

  it("ignores a preference out of range", () => {
    expect(selectableIndex(list, 9)).toBe(0)
  })

  it("skips a disabled preference for the first enabled item", () => {
    expect(selectableIndex(list, 0, (item) => item === "a")).toBe(1)
  })

  it("skips disabled items when there is no preference", () => {
    expect(selectableIndex(list, -1, (item) => item !== "b")).toBe(1)
  })

  it("reports nothing to highlight when every item is disabled", () => {
    expect(selectableIndex(list, 1, () => true)).toBe(-1)
  })

  it("reports nothing to highlight for an empty list", () => {
    expect(selectableIndex([], -1)).toBe(-1)
  })
})

describe("leavesCombobox", () => {
  /** Stand-in for the input: `isSameNode` is all the function asks of a node. */
  const input = { isSameNode: (other: unknown) => other === input }
  /** Stand-in for anything else focus can land on. */
  const elsewhere = { isSameNode: () => false } as unknown as Node

  it("stays when focus is still on the input", () => {
    expect(leavesCombobox(input, input as unknown as Node)).toBe(false)
  })

  it("leaves when focus moves to another element", () => {
    expect(leavesCombobox(input, elsewhere)).toBe(true)
  })

  it("does not treat a null relatedTarget as a leave, so a click on an option keeps the list", () => {
    expect(leavesCombobox(input, null)).toBe(false)
  })

  it("leaves for a descendant that is not the input — the clear button", () => {
    expect(leavesCombobox(input, elsewhere)).toBe(true)
  })

  it("leaves for the scrolling listbox itself, which Chrome makes a tab stop", () => {
    const scroller = { isSameNode: (other: unknown) => other === input } as unknown as Node
    expect(leavesCombobox(input, scroller)).toBe(true)
  })

  it("wires the component's blur handler to this rule, not to root containment", () => {
    // The original defect: a root-containment test reports "still inside" for the clear button and for
    // the scrolling popup, so a Tab onto either one left the list open. This pins the component to
    // `leavesCombobox` — reverting the handler makes the test go red.
    const source = readFileSync(new URL("./combobox.tsx", import.meta.url), "utf8")

    expect(source).toContain(
      "if (!leavesCombobox(event.currentTarget, event.relatedTarget as Node | null)) return",
    )
    expect(source).not.toContain("rootRef.current?.contains(next)")
  })
})

describe("naming", () => {
  it("reports aria-labelledby when the caller points at a label", () => {
    expect(naming({ "aria-labelledby": "coin-label" })).toBe("aria-labelledby")
  })

  it("reports aria-label when the caller gives a plain name", () => {
    expect(naming({ ariaLabel: "Coin" })).toBe("aria-label")
  })

  it("prefers aria-labelledby when both are set, as the accessibility tree does", () => {
    expect(naming({ ariaLabel: "Coin", "aria-labelledby": "coin-label" })).toBe("aria-labelledby")
  })

  it("reports no name when neither is set, which is the failure mode it guards", () => {
    expect(naming({})).toBeNull()
    expect(naming({ ariaLabel: "" })).toBeNull()
  })
})

describe("listboxContent", () => {
  const items = ["BTC", "ETH"]

  it("returns the options untouched when the filter left something", () => {
    expect(listboxContent(items, "bt")).toEqual({ options: items, emptyMessage: undefined })
  })

  it("empties the listbox and produces the message when nothing matched", () => {
    expect(listboxContent([], "zzz")).toEqual({ options: [], emptyMessage: "No matches" })
  })

  it("takes the caller's message", () => {
    expect(listboxContent([], "zzz", "Nada").emptyMessage).toBe("Nada")
  })

  it("resolves a function-form message with the query", () => {
    expect(listboxContent([], "zzz", (query) => `Nothing for ${query}`).emptyMessage)
      .toBe("Nothing for zzz")
  })

  it("never returns a message next to options, which would mean a listbox child that is not an option", () => {
    const content = listboxContent(items, "", "No matches")
    expect(content.options.length > 0 && content.emptyMessage !== undefined).toBe(false)
  })
})

describe("typingState", () => {
  it("opens and highlights the first item the query left", () => {
    expect(typingState(["Ethereum"])).toEqual({ activeIndex: 0, isOpen: true })
  })

  it("opens with nothing highlighted when the query left nothing", () => {
    expect(typingState([])).toEqual({ activeIndex: -1, isOpen: true })
  })

  it("skips a disabled item, so Enter after typing cannot land on one", () => {
    expect(typingState(["BTC", "ETH"], (item) => item === "BTC").activeIndex).toBe(1)
  })

  it("opens when every item is disabled, with nothing highlighted", () => {
    expect(typingState(["BTC"], () => true)).toEqual({ activeIndex: -1, isOpen: true })
  })

  it("feeds Enter: the keystroke path selects the highlighted row", () => {
    const afterTyping = typingState(filterItems(["Bitcoin", "Ethereum"], "eth"))
    const enter = comboboxKeyAction("Enter", afterTyping, 1)

    expect(afterTyping.activeIndex).toBe(0)
    expect(enter.select).toBe(0)
  })

  it("keeps Enter a no-op after a query that matched nothing", () => {
    const afterTyping = typingState(filterItems(["Bitcoin"], "zzz"))
    const enter = comboboxKeyAction("Enter", afterTyping, 0)

    expect(afterTyping.activeIndex).toBe(-1)
    expect(enter.select).toBe(-1)
  })
})

describe("openingState", () => {
  const items = ["BTC", "ETH", "USD"]

  it("highlights the selected item when the list still has it", () => {
    const visible = filterItems(items, "eth")
    expect(openingState(items, items.indexOf("ETH"), visible)).toEqual({
      activeIndex: 0,
      isOpen: true,
    })
  })

  it("falls back to the first item when the selection is filtered out", () => {
    const visible = filterItems(items, "usd")
    expect(openingState(items, items.indexOf("ETH"), visible).activeIndex).toBe(0)
  })

  it("highlights nothing when the list is empty", () => {
    expect(openingState(items, 1, []).activeIndex).toBe(-1)
  })

  it("skips a disabled selection for the first enabled item", () => {
    const state = openingState(items, 0, items, (item) => item === "BTC")
    expect(state.activeIndex).toBe(1)
  })

  it("reports nothing to highlight when every item is disabled", () => {
    expect(openingState(items, 0, items, () => true).activeIndex).toBe(-1)
  })

  it("always opens", () => {
    expect(openingState(items, -1, items).isOpen).toBe(true)
    expect(openingState(items, -1, []).isOpen).toBe(true)
  })
})
