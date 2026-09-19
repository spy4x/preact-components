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

  it("marks the single page it cannot hide", () => {
    expect(asText(pageRange(5, 8))).toBe("1 … 4 5 6 7 8")
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

  it("stops sliding once one more page would be hidden behind a mark", () => {
    expect(asText(pageRange(4, 50))).toBe("1 2 3 4 5 … 50")
    expect(asText(pageRange(47, 50))).toBe("1 … 45 46 47 48 49 50")
  })

  it("writes a page out rather than marking it when there is room for one mark", () => {
    expect(asText(pageRange(4, 8))).toBe("1 2 3 4 5 … 8")
    expect(asText(pageRange(5, 8))).toBe("1 … 4 5 6 7 8")
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

  it("honours a caller-supplied window size", () => {
    expect(asText(pageRange(25, 50, 5))).toBe("1 … 23 24 25 26 27 … 50")
    expect(asText(pageRange(25, 50, 2))).toBe("1 … 23 24 25 26 27 … 50")
  })

  it("returns every item as a page or a gap", () => {
    for (const item of pageRange(25, 50)) {
      expect("page" in item || "gap" in item).toBe(true)
    }
  })

  it("shows both ends and never hides a single page behind a mark", () => {
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

  it("renders only the current page for one page", () => {
    const html = render(<Pagination page={1} pageCount={1} onChange={() => {}} />)

    expect(html).toContain('aria-current="page"')
    expect(html).toContain(">1</button>")
    expect(html).not.toContain("Previous")
    expect(html).not.toContain("Next")
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

  it("does not render a previous control on the first page", () => {
    const html = render(<Pagination page={1} pageCount={3} onChange={() => {}} />)

    expect(html).not.toContain("Previous")
    expect(html).toContain("Next")
  })

  it("does not render a next control on the last page", () => {
    const html = render(<Pagination page={3} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("Previous")
    expect(html).not.toContain("Next")
  })

  it("renders both controls between the ends, and disables neither", () => {
    const html = render(<Pagination page={2} pageCount={3} onChange={() => {}} />)

    expect(html).toContain("Previous")
    expect(html).toContain("Next")
    // `disabled:opacity-50` is a utility on every button, so the attribute is spelled out.
    expect(html).not.toContain(' disabled=""')
    expect(html).not.toContain(" disabled>")
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
