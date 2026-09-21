import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type ComponentChild, type VNode } from "preact"
import { render } from "preact-render-to-string"
import { pageRange, type PageRangeItem, Pagination } from "./pagination.tsx"

/** Render the items as compact text: `1 2 … 9 10`, gaps as `…`. */
function asText(items: PageRangeItem[]): string {
  return items.map((item) => "page" in item ? String(item.page) : "…").join(" ")
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/**
 * The first interactable control of a rendered tree whose text is `label`.
 *
 * The repo has no DOM harness, so a test about wiring reads the `onClick` off the vnode instead
 * of dispatching one — the same closure Preact would call for that control.
 */
function controlAt(tree: ComponentChild, label: string): VNode<Record<string, unknown>> {
  const found = find(tree, label)
  if (!found) throw new Error(`no control labelled ${label}`)
  return found
}

function find(node: unknown, label: string): VNode<Record<string, unknown>> | undefined {
  for (const candidate of Array.isArray(node) ? node : [node]) {
    if (!isVNode(candidate)) continue
    const props = candidate.props ?? {}
    const own = textOf(props.children) === label && typeof props.onClick === "function"
    if (own) return candidate
    const nested = find(props.children, label)
    if (nested) return nested
  }
  return undefined
}

function fireClick(tree: ComponentChild, label: string): void {
  const onClick = controlAt(tree, label).props.onClick as () => void
  onClick()
}

function isVNode(node: unknown): node is VNode<Record<string, unknown>> {
  return typeof node === "object" && node !== null && "type" in node && "props" in node
}

function textOf(children: unknown): string {
  if (Array.isArray(children)) return children.map(textOf).join("")
  return typeof children === "string" || typeof children === "number" ? String(children) : ""
}

describe("pageRange", () => {
  it("renders nothing for zero pages", () => {
    expect(pageRange(1, 0)).toEqual([])
  })

  it("renders nothing for a negative page count", () => {
    expect(pageRange(1, -3)).toEqual([])
  })

  it("renders the single page for one page", () => {
    expect(pageRange(1, 1)).toEqual([{ page: 1 }])
  })

  it("lists every page when the count fits the window", () => {
    expect(asText(pageRange(4, 7))).toBe("1 2 3 4 5 6 7")
  })

  it("collapses both runs when the current page is in the middle of a long range", () => {
    expect(asText(pageRange(25, 50))).toBe("1 … 23 24 25 26 27 … 50")
  })

  it("writes out a page rather than hiding it, even when that lists the whole range", () => {
    // Eight pages, current in the middle: a window of five with both ends shown would leave page 2
    // alone in front of it and page 8 has to be shown anyway, so both marks are worth less than
    // the numbers they would stand for and every page is written out.
    expect(asText(pageRange(5, 8))).toBe("1 2 3 4 5 6 7 8")
  })

  it("collapses only the tail when the current page is at the start", () => {
    expect(asText(pageRange(1, 50))).toBe("1 2 3 4 5 … 50")
    expect(asText(pageRange(2, 50))).toBe("1 2 3 4 5 … 50")
    expect(asText(pageRange(3, 50))).toBe("1 2 3 4 5 … 50")
  })

  it("collapses only the head when the current page is at the end", () => {
    expect(asText(pageRange(50, 50))).toBe("1 … 46 47 48 49 50")
    expect(asText(pageRange(49, 50))).toBe("1 … 46 47 48 49 50")
    expect(asText(pageRange(48, 50))).toBe("1 … 46 47 48 49 50")
  })

  it("swallows the one page a mark would have hidden, at either end", () => {
    // Page 4 of 50 keeps its two neighbours on each side, and the window then reaches back over
    // page 2 — the only page a leading mark could have hidden — rather than dropping a neighbour.
    // Page 47 is the same thing at the other end, and was already right before the window changed.
    expect(asText(pageRange(4, 50))).toBe("1 2 3 4 5 6 … 50")
    expect(asText(pageRange(47, 50))).toBe("1 … 45 46 47 48 49 50")
  })

  it("keeps neighbours on both sides of a middling page, which is what #159 reported", () => {
    // The reported case, exactly: page 5 of 10 used to read "1 2 3 4 5 … 10", with the current page
    // against the mark and nothing after it.
    expect(asText(pageRange(5, 10))).toBe("1 2 3 4 5 6 7 … 10")
    expect(asText(pageRange(6, 10))).toBe("1 … 4 5 6 7 8 9 10")
  })

  it("walks the current page across a long range and keeps it mid-window throughout", () => {
    // One axis varied on its own: the same 30 pages, the current page moving from the first to the
    // last. Every earlier fixture pinned the current page to a place where the defect did not show.
    const positions = [1, 2, 3, 4, 5, 15, 26, 27, 28, 29, 30]
    const seen = positions.map((page) => `${page}: ${asText(pageRange(page, 30))}`)

    expect(seen).toEqual([
      "1: 1 2 3 4 5 … 30",
      "2: 1 2 3 4 5 … 30",
      "3: 1 2 3 4 5 … 30",
      "4: 1 2 3 4 5 6 … 30",
      "5: 1 2 3 4 5 6 7 … 30",
      "15: 1 … 13 14 15 16 17 … 30",
      "26: 1 … 24 25 26 27 28 29 30",
      "27: 1 … 25 26 27 28 29 30",
      "28: 1 … 26 27 28 29 30",
      "29: 1 … 26 27 28 29 30",
      "30: 1 … 26 27 28 29 30",
    ])
  })

  it("holds the window at one width once it is clear of both ends", () => {
    // The window slides rather than shrinks, so a reader's eye does not have to re-find the control
    // as they page through the middle of a long range.
    const widths = [10, 15, 20, 30, 40].map((page) =>
      pageRange(page, 50).filter((item) => "page" in item).length
    )

    expect(widths).toEqual([7, 7, 7, 7, 7])
  })

  it("clamps the current page into the range", () => {
    expect(asText(pageRange(0, 50))).toBe("1 2 3 4 5 … 50")
    expect(asText(pageRange(99, 50))).toBe("1 … 46 47 48 49 50")
    expect(asText(pageRange(2.4, 50))).toBe("1 2 3 4 5 … 50")
  })

  it("shrinks the window when the count is smaller than it", () => {
    expect(asText(pageRange(3, 4))).toBe("1 2 3 4")
    expect(pageRange(3, 4).some((item) => !("page" in item))).toBe(false)
  })

  it("lists a range in full up to the size, and collapses the first one past it", () => {
    // The other axis: the current page held at the middle while the total crosses the default
    // `size` of 7 — under it, level with it, and past it.
    expect(asText(pageRange(3, 6))).toBe("1 2 3 4 5 6")
    expect(asText(pageRange(4, 7))).toBe("1 2 3 4 5 6 7")
    expect(asText(pageRange(4, 9))).toBe("1 2 3 4 5 6 … 9")
    expect(asText(pageRange(4, 12))).toBe("1 2 3 4 5 6 … 12")
  })

  it("moves where a range starts collapsing when the caller changes the size", () => {
    // `size` decides how long a range may be before it collapses at all. It does not set the
    // collapsed window's width, which is why the three long cases below all read the same.
    expect(asText(pageRange(6, 11, 11))).toBe("1 2 3 4 5 6 7 8 9 10 11")
    expect(asText(pageRange(6, 11, 10))).toBe("1 … 4 5 6 7 8 … 11")
    expect(asText(pageRange(25, 50, 5))).toBe("1 … 23 24 25 26 27 … 50")
    expect(asText(pageRange(25, 50, 2))).toBe("1 … 23 24 25 26 27 … 50")
    expect(asText(pageRange(25, 50, 40))).toBe("1 … 23 24 25 26 27 … 50")
  })

  it("renders at most nine items once a range collapses, and reaches nine", () => {
    // The ceiling the JSDoc names, measured rather than asserted about one fixture. `size` says
    // when a range starts collapsing, not how wide the collapsed form is, so the bound has to hold
    // across every `size` — the first version of that sentence said `size + 2` and was false for
    // the two smallest, which a single-`size` loop could never have found.
    //
    // Nine is asserted as the *maximum*, not only as a limit, so a change that quietly narrows the
    // window turns this red as well: the documented number would then be loose, and a bound nobody
    // reaches is a bound nobody has checked.
    const over: string[] = []
    let widest = 0

    for (const size of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 15, 40]) {
      const budget = Math.max(5, size)
      for (let pageCount = 1; pageCount <= 60; pageCount++) {
        if (pageCount <= budget) continue
        for (let page = 1; page <= pageCount; page++) {
          const items = pageRange(page, pageCount, size).length
          widest = Math.max(widest, items)
          if (items > 9) over.push(`pageRange(${page}, ${pageCount}, ${size}) → ${items} items`)
        }
      }
    }

    expect(over).toEqual([])
    expect(widest).toBe(9)
  })

  it("lists a range in full below the size, however many pages that is", () => {
    // The other half of the same bound: nine applies to a *collapsed* range. A caller who raises
    // `size` to 40 is asking for up to forty numbers, and gets them.
    expect(pageRange(20, 40, 40)).toHaveLength(40)
    expect(pageRange(20, 40, 40).some((item) => !("page" in item))).toBe(false)
  })

  it("returns every item as a page or a gap", () => {
    for (const item of pageRange(25, 50)) {
      expect("page" in item || "gap" in item).toBe(true)
    }
  })

  it("shows both ends, both neighbours and never hides a single page behind a mark", () => {
    // The neighbour assertion is the one this loop was missing. Every other case in this file names
    // one page of one range, and the three that happened to name a middling page of a middling
    // range were the three the old window got wrong; the loop below ran over all of them and stayed
    // green, because it only ever asked where the ends and the marks were.
    for (let pageCount = 1; pageCount <= 40; pageCount++) {
      for (let page = 1; page <= pageCount; page++) {
        const items = pageRange(page, pageCount)
        const pages = items.flatMap((item) => "page" in item ? [item.page] : [])
        const marks = items.length - pages.length

        expect(pages[0]).toBe(1)
        expect(pages.at(-1)).toBe(pageCount)
        expect(pages).toContain(page)
        expect(new Set(pages).size).toBe(pages.length)
        expect(marks).toBeLessThanOrEqual(2)
        // Two pages either side of the current one, as far as the range reaches. `sideWidth` is
        // private to the component, so the promise is restated here as the number its JSDoc names.
        for (let near = Math.max(1, page - 2); near <= Math.min(pageCount, page + 2); near++) {
          expect(pages).toContain(near)
        }
        // And never more items than the documented ceiling, which is what stops "show a neighbour"
        // being satisfied by listing everything.
        expect(items.length).toBeLessThanOrEqual(pageCount <= 7 ? pageCount : 9)

        for (const [index, item] of items.entries()) {
          if ("page" in item) continue
          const before = index === 0 ? 1 : (items[index - 1] as { page: number }).page + 1
          const after = index === items.length - 1
            ? pageCount
            : (items[index + 1] as { page: number }).page - 1
          // A mark stands for `after - before + 1` pages, and one is one too few to be worth it.
          expect(after - before + 1).toBeGreaterThan(1)
        }
      }
    }
  })
})

describe("Pagination", () => {
  it("renders nothing for zero pages", () => {
    expect(render(<Pagination page={1} pageCount={0} onChange={() => {}} />)).toBe("")
  })

  it("crosses the one-page boundary: nothing, then a bare page, then two controls", () => {
    // The three totals either side of where the end controls start existing, in one place. A list
    // with one page has nowhere to go, so it gets no controls at all and no dead tab stops; from
    // two pages up they are always there, and the one that cannot act is marked rather than removed.
    const none = render(<Pagination page={1} pageCount={0} onChange={() => {}} />)
    const single = render(<Pagination page={1} pageCount={1} onChange={() => {}} />)
    const pair = render(<Pagination page={1} pageCount={2} onChange={() => {}} />)

    expect(none).toBe("")

    expect(single).toContain('aria-current="page"')
    expect(single).toContain(">1</button>")
    expect(single).not.toContain("Previous")
    expect(single).not.toContain("Next")
    expect(countOccurrences(single, "<button")).toBe(1)

    expect(pair).toContain("Previous")
    expect(pair).toContain("Next")
    expect(countOccurrences(pair, "<button")).toBe(4)
    expect(countOccurrences(pair, 'aria-disabled="true"')).toBe(1)
    expect(pair).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Previous<\/button>/)
  })

  it("labels the nav landmark", () => {
    const html = render(<Pagination page={1} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("<nav")
    expect(html).toContain('aria-label="Pagination"')
  })

  it("takes an accessible name from the caller", () => {
    expect(render(<Pagination page={1} pageCount={3} onChange={() => {}} label="Invoice pages" />))
      .toContain('aria-label="Invoice pages"')
  })

  it("marks exactly one page as current", () => {
    const html = render(<Pagination page={2} pageCount={3} onChange={() => {}} />)

    expect(countOccurrences(html, 'aria-current="page"')).toBe(1)
    expect(html).toContain('aria-current="page"')
  })

  it("keeps the previous control on the first page and marks it disabled", () => {
    const html = render(<Pagination page={1} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("Previous")
    expect(countOccurrences(html, 'aria-disabled="true"')).toBe(1)
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Previous<\/button>/)
  })

  it("keeps the next control on the last page and marks it disabled", () => {
    const html = render(<Pagination page={3} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("Next")
    expect(countOccurrences(html, 'aria-disabled="true"')).toBe(1)
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Next<\/button>/)
  })

  it("renders both controls between the ends, and disables neither", () => {
    const html = render(<Pagination page={2} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("Previous")
    expect(html).toContain("Next")
    // The attribute, not the word: `aria-disabled:opacity-50` is a utility on both controls, so
    // the substring is in the markup either way.
    expect(html).not.toContain('aria-disabled="')
    // `disabled:opacity-50` is a utility on every button, so the attribute is spelled out.
    expect(html).not.toContain(' disabled=""')
    expect(html).not.toContain(" disabled>")
  })

  it("never uses the native disabled attribute, which would take focus off the pressed control", () => {
    // The measurement behind the choice: in the browser `deno task --cwd pages verify` drives,
    // setting `disabled` on the focused button moved `document.activeElement` to `<body>` on the
    // same line, which is the bug this component was reported for. `pages/checks/ui.ts` proves the
    // other half — that the control keeps focus when it becomes disabled for real.
    for (const [page, pageCount] of [[1, 5], [5, 5], [1, 2]] as const) {
      const html = render(<Pagination page={page} pageCount={pageCount} onChange={() => {}} />)

      expect(html).not.toContain(' disabled=""')
      expect(html).not.toContain(" disabled>")
      expect(html).toContain('aria-disabled="true"')
    }
  })

  it("ignores a press on the control that has nothing left to do", () => {
    // `aria-disabled` does not stop the browser dispatching the click, so the handler has to.
    let requested = 0
    const first = Pagination({ page: 1, pageCount: 5, onChange: (next) => requested = next })

    fireClick(first, "Previous")
    expect(requested).toBe(0)

    const last = Pagination({ page: 5, pageCount: 5, onChange: (next) => requested = next })

    fireClick(last, "Next")
    expect(requested).toBe(0)
  })

  it("names each page number Page N by default", () => {
    const html = render(<Pagination page={1} pageCount={3} onChange={() => {}} />)

    expect(html).toContain('aria-label="Page 1"')
    expect(html).toContain('aria-label="Page 3"')
  })

  it("takes the page number's accessible name from the caller", () => {
    const html = render(
      <Pagination
        page={1}
        pageCount={3}
        onChange={() => {}}
        pageLabel={(page) => `Seite ${page} von 3`}
      />,
    )

    expect(html).toContain('aria-label="Seite 1 von 3"')
    expect(html).toContain('aria-label="Seite 3 von 3"')
    expect(html).not.toContain('aria-label="Page 1"')
  })

  it("asks the owner for the page a number belongs to", () => {
    let requested = 0
    const tree = Pagination({ page: 1, pageCount: 5, onChange: (next) => requested = next })

    fireClick(tree, "3")
    expect(requested).toBe(3)
  })

  it("asks for the neighbouring page from the controls, not the numbers", () => {
    let requested = 0
    const tree = Pagination({ page: 3, pageCount: 5, onChange: (next) => requested = next })

    fireClick(tree, "Previous")
    expect(requested).toBe(2)

    fireClick(tree, "Next")
    expect(requested).toBe(4)
  })

  it("leaves the current page to its own aria-current and variant", () => {
    const tree = Pagination({ page: 2, pageCount: 3, onChange: () => {} })

    expect(controlAt(tree, "2").props["aria-current"]).toBe("page")
    expect(controlAt(tree, "2").props.variant).toBe("secondary")
    expect(controlAt(tree, "1").props.variant).toBe("outline")
    expect(controlAt(tree, "1").props["aria-current"]).toBeUndefined()
  })

  it("collapses a long range into gaps that are not controls", () => {
    const html = render(<Pagination page={25} pageCount={50} onChange={() => {}} />)

    expect(countOccurrences(html, "…")).toBe(2)
    expect(countOccurrences(html, "<button")).toBe(9)
    expect(countOccurrences(html, "<li")).toBe(9)
    expect(html).toContain('aria-hidden="true"')
  })

  it("renders the selected page in the secondary palette and the rest in the outline one", () => {
    const html = render(<Pagination page={2} pageCount={3} onChange={() => {}} />)

    // The two palettes meet in this markup: `secondary` on the active page, `outline` on the rest.
    expect(html).toContain("bg-gray-100")
    expect(html).toContain("border-gray-300")
  })

  it("appends a caller class to the landmark", () => {
    const html = render(<Pagination page={1} pageCount={3} onChange={() => {}} class="mt-6" />)

    expect(html).toContain("mt-6")
    expect(html).toContain("justify-center")
  })

  it("defaults every control to type button so none submits a form", () => {
    const html = render(<Pagination page={2} pageCount={3} onChange={() => {}} />)

    expect(html).not.toContain('type="submit"')
    expect(countOccurrences(html, 'type="button"')).toBe(5)
  })
})
