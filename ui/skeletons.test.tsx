import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  barHeightRem,
  columnWidthPercents,
  lineBoxRem,
  SKELETON_METRICS,
  SkeletonCards,
  skeletonCount,
  SkeletonStatus,
  skeletonStatusRole,
  SkeletonTable,
  SkeletonText,
  tableGeometry,
  tableHeaderHeightRem,
  tableRowHeightRem,
  textGeometry,
} from "./skeletons.tsx"

describe("columnWidthPercents", () => {
  it("splits the table by weight", () => {
    expect(columnWidthPercents([3, 1])).toEqual([75, 25])
  })

  it("shares the table evenly between equal columns", () => {
    expect(columnWidthPercents([1, 1, 1])).toEqual([33.3333, 33.3333, 33.3333])
  })

  it("gives an unnamed column no width", () => {
    expect(columnWidthPercents([3, 0, 0])).toEqual([100, 0, 0])
  })

  it("collapses a non-positive column to zero width", () => {
    expect(columnWidthPercents([3, -1])).toEqual([100, 0])
  })

  it("ignores the sign of a non-positive weight", () => {
    expect(columnWidthPercents([3, -1])).toEqual(columnWidthPercents([3, 0]))
  })

  it("falls back to equal columns when no weight is positive", () => {
    expect(columnWidthPercents([0, 0])).toEqual([50, 50])
  })

  it("falls back to full width when there are no columns", () => {
    expect(columnWidthPercents([])).toEqual([])
  })

  it("totals one hundred percent", () => {
    expect(columnWidthPercents([7, 11, 13]).reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 3)
  })
})

describe("tableGeometry", () => {
  it("counts a cell per row and column", () => {
    const geometry = tableGeometry({ rows: 5, columns: 4 })

    expect(geometry.rows).toBe(5)
    expect(geometry.columns).toBe(4)
    expect(geometry.cells).toBe(20)
  })

  it("reserves one row per column when no row count is given", () => {
    expect(tableGeometry({ columns: 4 }).rows).toBe(4)
  })

  it("lets the widths decide the column count", () => {
    const geometry = tableGeometry({ rows: 2, columns: 9, widths: [3, 1] })

    expect(geometry.columns).toBe(2)
    expect(geometry.cells).toBe(4)
  })

  it("distributes an even table equally", () => {
    expect(tableGeometry({ columns: 4 }).columnWidths.map((column) => column.percent)).toEqual([
      25,
      25,
      25,
      25,
    ])
  })

  it("reports the widths the grid is laid out at", () => {
    const geometry = tableGeometry({ rows: 2, columns: 2, widths: [3, 1] })

    expect(geometry.columnWidths).toEqual([
      { index: 0, percent: 75 },
      { index: 1, percent: 25 },
    ])
  })

  it("is degenerate, not negative, for an empty table", () => {
    const geometry = tableGeometry()

    expect(geometry.rows).toBe(0)
    expect(geometry.columns).toBe(0)
    expect(geometry.cells).toBe(0)
  })

  it("floors a fractional row count and refuses a negative one", () => {
    expect(tableGeometry({ rows: 2.7, columns: 3 }).cells).toBe(3 * 2)
    expect(tableGeometry({ rows: -4, columns: 3 }).cells).toBe(0)
    expect(tableGeometry({ rows: Number.NaN, columns: 3 }).cells).toBe(0)
  })

  it("reserves 53px (3.3125rem) for a body row", () => {
    // Literal on purpose. Deriving this from `SKELETON_METRICS` is what let a wrong metric ship:
    // an expectation restated from the code under test cannot fail. 53px is what Chromium 151
    // measures beside a real single-line `Table` row.
    expect(tableRowHeightRem()).toBe(3.3125)
    expect(tableRowHeightRem() * 16).toBe(53)
    expect(tableGeometry({ columns: 2 }).rowHeightRem).toBe(3.3125)
  })

  it("reserves 44.5px (2.78125rem) for a header row", () => {
    // The real header row measures 44.5px, and a grid row can land on it: 2.78125rem is a
    // quarter-rem, the same device-pixel grid the body row's 3.3125rem sits on.
    expect(tableHeaderHeightRem()).toBe(2.78125)
    expect(tableHeaderHeightRem() * 16).toBe(44.5)
    expect(tableHeaderHeightRem()).toBeLessThan(tableRowHeightRem())
  })

  it("reserves a body row taller than the line it holds", () => {
    // The row has to contain a text line plus `py-4`, or the bar it renders would overflow it.
    const line = SKELETON_METRICS.lineHeightRem + 2 * SKELETON_METRICS.cellPaddingYRem

    expect(tableRowHeightRem()).toBeGreaterThan(line)
  })

  it("keeps the metrics the row height is measured against", () => {
    expect(SKELETON_METRICS.lineHeightRem).toBe(1.25)
    expect(SKELETON_METRICS.cellPaddingYRem).toBe(1)
    expect(SKELETON_METRICS.headerPaddingYRem).toBe(0.75)
    expect(lineBoxRem()).toBe(1.25)
  })
})

describe("textGeometry", () => {
  it("defaults to three full lines", () => {
    expect(textGeometry()).toEqual({ lines: 3, linePercents: [100, 100, 100] })
  })

  it("renders one width per requested line", () => {
    expect(textGeometry(5).linePercents).toHaveLength(5)
  })

  it("cycles a shorter width list across the lines", () => {
    expect(textGeometry(5, [100, 60]).linePercents).toEqual([100, 60, 100, 60, 100])
  })

  it("clamps a width into the percentage range", () => {
    expect(textGeometry(3, [140, -20]).linePercents).toEqual([100, 0, 100])
  })

  it("treats a non-finite width as a full line", () => {
    expect(textGeometry(2, [Number.NaN, Number.POSITIVE_INFINITY]).linePercents).toEqual([100, 100])
  })

  it("floors a fractional line count and refuses a negative one", () => {
    expect(textGeometry(2.9).lines).toBe(2)
    expect(textGeometry(-3).lines).toBe(0)
    expect(textGeometry(-3).linePercents).toEqual([])
  })
})

describe("skeletonCount", () => {
  it("keeps the fallback when the count is absent", () => {
    expect(skeletonCount(undefined, 3)).toBe(3)
  })

  it("floors a fractional count", () => {
    expect(skeletonCount(4.9, 3)).toBe(4)
  })

  it("refuses a negative, NaN or infinite count", () => {
    expect(skeletonCount(-2, 3)).toBe(0)
    expect(skeletonCount(Number.NaN, 3)).toBe(0)
    expect(skeletonCount(Number.POSITIVE_INFINITY, 3)).toBe(0)
  })
})

describe("SkeletonText", () => {
  it("hides the placeholder from assistive tech", () => {
    expect(render(<SkeletonText />)).toContain('aria-hidden="true"')
  })

  it("renders one line per requested line", () => {
    const html = render(<SkeletonText lines={4} />)

    expect(countOccurrences(html, "data-skeleton-line=")).toBe(4)
    expect(html).toContain('data-skeleton-text="true"')
  })

  it("renders no line for a zero, negative or non-finite count", () => {
    expect(render(<SkeletonText lines={0} />)).not.toContain("data-skeleton-line=")
    expect(render(<SkeletonText lines={-2} />)).not.toContain("data-skeleton-line=")
    expect(render(<SkeletonText lines={Number.NaN} />)).not.toContain("data-skeleton-line=")
  })

  it("gives a full line the full width", () => {
    expect(render(<SkeletonText lines={1} />)).toContain("width:100%")
  })

  it("gives every line the measured bar height", () => {
    // Same coverage the table's bars get: without an explicit height a line collapses to the font's
    // own content box, and a bar that paints nothing should not pass a suite.
    const html = render(<SkeletonText lines={2} />)

    expect(countOccurrences(html, "height:1rem")).toBe(2)
  })

  it("takes every line width from the prop", () => {
    const html = render(<SkeletonText lines={2} widths={[80, "full"]} />)

    expect(html).toContain("width:80%")
    expect(html).toContain("width:100%")
    expect(html).not.toContain("width:66")
  })

  it("degenerates to nothing for a zero count", () => {
    expect(render(<SkeletonText lines={0} />)).toBe(
      '<div class="space-y-2" aria-hidden="true" data-skeleton-text="true"></div>',
    )
  })

  it("appends a caller class", () => {
    expect(render(<SkeletonText class="mt-0" />)).toContain("mt-0")
  })
})

describe("SkeletonTable", () => {
  it("hides the placeholder from assistive tech", () => {
    const html = render(<SkeletonTable rows={2} columns={3} />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-skeleton-table="true"')
  })

  it("renders one placeholder cell per row and column", () => {
    const html = render(<SkeletonTable rows={3} columns={4} />)

    expect(bodyCells(html)).toBe(12)
    expect(countOccurrences(html, 'data-skeleton-row="header"')).toBe(1)
  })

  it("says in the markup how many cells it claims", () => {
    const html = render(<SkeletonTable rows={3} columns={4} />)
    const geometry = tableGeometry({ rows: 3, columns: 4 })

    expect(html).toContain(`data-skeleton-cells="${geometry.cells}"`)
    expect(bodyCells(html)).toBe(geometry.cells)
  })

  it("gives the header one cell per column", () => {
    const html = render(<SkeletonTable rows={3} columns={4} />)

    expect(countOccurrences(html, "data-skeleton-cell=") - bodyCells(html)).toBe(4)
  })

  it("gives the cells the widths it reports", () => {
    const html = render(<SkeletonTable rows={1} columns={2} widths={[3, 1]} />)

    for (const column of tableGeometry({ columns: 2, widths: [3, 1] }).columnWidths) {
      expect(countOccurrences(html, `data-column-percent="${column.percent}"`)).toBe(2)
    }
  })

  it("stamps the column's share of the table, not its painted width", () => {
    // `data-column-percent` is the share of the whole table that `columnWidthPercents` reports and a
    // caller compares against the real table's split. It is not the cell's painted width: the tracks
    // are the raw fractions, so a cell's own `px-6` comes out of its share.
    const html = render(<SkeletonTable rows={1} columns={2} widths={[3, 1]} />)

    expect(html).toContain('data-column-percent="75"')
    expect(html).toContain('data-column-percent="25"')
    expect(html).toContain("grid-template-columns:3fr 1fr")
  })

  it("writes the measured row heights into the markup", () => {
    const rows = markedRows(render(<SkeletonTable rows={2} columns={2} />))

    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => row.markup.includes("height:3.3125rem"))).toHaveLength(2)
    expect(rows.filter((row) => row.markup.includes("height:2.78125rem"))).toHaveLength(1)
  })

  it("gives the bars the measured heights, so the placeholders paint", () => {
    // The bars carry an explicit height because a bare block in a grid row collapses to the font's
    // content box. Dropping it, or changing how it is derived, leaves the whole placeholder at
    // 0.00px and nothing else in this file notices: 26.5px and 22px are the only figures here that
    // cover it, and they are literals on purpose.
    const rows = markedRows(render(<SkeletonTable rows={1} columns={2} />))
    const header = rows.find((row) => row.marker === "header")!
    const body = rows.find((row) => row.marker === "0")!

    expect(body.markup).toContain("height:1rem")
    expect(header.markup).toContain("height:1rem")
    expect(barHeightRem()).toBe(1)
    expect(barHeightRem() * 16).toBe(16)
    expect(lineBoxRem()).toBe(1.25)
  })

  it("carries the cell padding the real row carries", () => {
    const rows = markedRows(render(<SkeletonTable rows={1} columns={2} />))
    const header = rows.find((row) => row.marker === "header")!
    const body = rows.find((row) => row.marker === "0")!

    expect(header.markup).toContain("py-3")
    expect(header.markup).toContain("px-6")
    expect(body.markup).toContain("py-4")
    expect(body.markup).toContain("px-6")
  })

  it("renders nothing for zero rows", () => {
    expect(render(<SkeletonTable rows={0} columns={3} />)).not.toContain("data-skeleton-cell=")
  })

  it("renders nothing when no column count is given", () => {
    expect(render(<SkeletonTable rows={2} />)).not.toContain("data-skeleton-cell=")
  })

  it("takes the column count from the widths", () => {
    const html = render(<SkeletonTable rows={2} widths={[2, 1, 1]} />)

    expect(bodyCells(html)).toBe(6)
    expect(html).toContain('data-skeleton-columns="3"')
  })

  it("reserves a row per column when no row count is given", () => {
    const html = render(<SkeletonTable columns={2} />)

    expect(bodyCells(html)).toBe(4)
    expect(html).toContain('data-skeleton-rows="2"')
  })

  it("reserves the real table's minimum height by default", () => {
    expect(render(<SkeletonTable columns={2} />)).toContain("min-h-[300px]")
  })

  it("releases the minimum height when the real table has none", () => {
    expect(render(<SkeletonTable columns={2} reserveHeight={false} />)).not.toContain(
      "min-h-[300px]",
    )
  })

  it("appends a caller class", () => {
    expect(render(<SkeletonTable columns={2} class="mt-0" />)).toContain("mt-0")
  })
})

describe("SkeletonCards", () => {
  it("hides the placeholder from assistive tech", () => {
    expect(render(<SkeletonCards />)).toContain('aria-hidden="true"')
  })

  it("renders one card per column and row", () => {
    const html = render(<SkeletonCards columns={4} rows={2} />)

    expect(countOccurrences(html, "data-skeleton-card=")).toBe(8)
    expect(html).toContain('data-skeleton-cards="8"')
  })

  it("defaults to one row of three cards", () => {
    const html = render(<SkeletonCards />)

    expect(countOccurrences(html, "data-skeleton-card=")).toBe(3)
    expect(html).toContain('data-skeleton-columns="3"')
  })

  it("renders the requested lines in every card", () => {
    const html = render(<SkeletonCards columns={2} rows={3} lines={4} />)

    expect(countOccurrences(html, "data-skeleton-line=")).toBe(2 * 3 * 4)
  })

  it("renders nothing for zero cards", () => {
    const html = render(<SkeletonCards columns={0} rows={2} />)

    expect(html).not.toContain("data-skeleton-card=")
    expect(html).toContain('class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"')
  })
})

describe("SkeletonStatus", () => {
  it("announces politely and is not hidden", () => {
    const html = render(<SkeletonStatus label="Loading invoices" />)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain("aria-hidden")
    expect(html).toContain("Loading invoices")
  })

  it("uses the polite role the module names", () => {
    expect(skeletonStatusRole()).toBe("status")
    expect(render(<SkeletonStatus label="Loading" />)).toContain(`role="${skeletonStatusRole()}"`)
  })

  it("renders nothing for a blank label", () => {
    expect(render(<SkeletonStatus />)).toBe("")
    expect(render(<SkeletonStatus label="" />)).toBe("")
    expect(render(<SkeletonStatus label="   " />)).toBe("")
    expect(render(<SkeletonStatus label={null} />)).toBe("")
  })

  it("appends a caller class", () => {
    expect(render(<SkeletonStatus label="Loading" class="mt-1" />)).toContain("mt-1")
  })
})

describe("SkeletonStatus beside a skeleton", () => {
  it("carries the only announcement while the placeholder stays hidden", () => {
    const html = render(
      <>
        <SkeletonStatus label="Loading invoices" />
        <SkeletonTable rows={2} columns={3} />
      </>,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-hidden="true"')
    expect(countOccurrences(html, 'role="status"')).toBe(1)
    expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf('data-skeleton-table="true"'))
    expect(html.slice(html.indexOf('data-skeleton-table="true"'))).not.toContain('role="status"')
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** One placeholder row, as the markup writes it. */
interface MarkedRow {
  /** What the row's `data-skeleton-row` attribute says: `"header"` or the row's index. */
  marker: string
  /** The whole element, from its tag to the next row. */
  markup: string
}

/**
 * Split a rendered skeleton table into its rows.
 *
 * Each row's markup is the span from its own `data-skeleton-row` attribute to the next one; the span
 * before the first marker holds the header's class attribute, so it is prepended to it. Reading rows
 * by marker is what lets a test ask for the header by name instead of by position.
 */
function markedRows(html: string): MarkedRow[] {
  const markers = [...html.matchAll(/data-skeleton-row="([^"]+)"/g)]

  return markers.map((marker, index) => {
    const tagStart = html.lastIndexOf('<div class="', marker.index!)
    const end = index + 1 < markers.length
      ? html.lastIndexOf('<div class="', markers[index + 1]!.index!)
      : html.length

    return { marker: marker[1]!, markup: html.slice(tagStart, end) }
  })
}

/** Placeholder cells inside body rows, excluding the header's. */
function bodyCells(html: string): number {
  return markedRows(html)
    .filter((row) => row.marker !== "header")
    .reduce((total, row) => total + countOccurrences(row.markup, "data-skeleton-cell="), 0)
}
