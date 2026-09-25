import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { SortRule } from "@spy4x/preact-signals/table-state"
import type { ComponentChild, VNode } from "preact"
import { render } from "preact-render-to-string"
import { DataTable, type DataTableColumn, rowKeyAttribute } from "./data-table.tsx"

interface Invoice {
  id: string
  merchant: string
  amount: number | null
}

const columns: DataTableColumn<Invoice, keyof Invoice & string>[] = [
  { key: "id", header: "Id" },
  { key: "merchant", header: "Merchant", sortable: true },
  { key: "amount", header: "Amount", sortable: true, align: "right" },
]

const rows: Invoice[] = [
  { id: "INV-1", merchant: "Coffee & Co", amount: 450 },
  { id: "INV-2", merchant: "Amazon", amount: 1299 },
  { id: "INV-3", merchant: "Salary", amount: null },
]

/** Seven rows, already in ascending-by-merchant order, for the paging tests below. */
const sevenInvoices: Invoice[] = "ABCDEFG".split("").map((letter) => ({
  id: `INV-${letter}`,
  merchant: letter,
  amount: letter.charCodeAt(0),
}))

function noop(): void {}

/**
 * Every value a vnode carries that might hold more tree: not just `children`, but `DataTable`'s
 * own slot props (`headerSlot`, `bodySlots`, `footerSlot`) that `Table` — itself unevaluated here,
 * see {@link evaluate} — never gets to unpack into `children` on our behalf.
 */
function propValues(props: Record<string, unknown> | null | undefined): unknown[] {
  return props ? Object.values(props) : []
}

/** Depth-first text of a rendered vnode tree, the way a reader sees it — SVGs contribute nothing. */
function deepText(node: unknown): string {
  if (Array.isArray(node)) return node.map(deepText).join("")
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (isVNode(node)) return propValues(node.props).map(deepText).join("")
  return ""
}

function isVNode(node: unknown): node is VNode<Record<string, unknown>> {
  return typeof node === "object" && node !== null && "type" in node && "props" in node
}

/** The first `<button>` in the tree whose rendered text includes `label`. */
function buttonLabelled(node: unknown, label: string): VNode<Record<string, unknown>> {
  const found = findButton(node, label)
  if (!found) throw new Error(`no button labelled ${label}`)
  return found
}

function findButton(node: unknown, label: string): VNode<Record<string, unknown>> | undefined {
  for (const candidate of Array.isArray(node) ? node : [node]) {
    if (!isVNode(candidate)) continue
    if (
      candidate.type === "button" && typeof candidate.props.onClick === "function" &&
      deepText(candidate).includes(label)
    ) {
      return candidate
    }
    for (const value of propValues(candidate.props)) {
      const nested = findButton(value, label)
      if (nested) return nested
    }
  }
  return undefined
}

function pressHeader(tree: ComponentChild, label: string): void {
  const onClick = buttonLabelled(tree, label).props.onClick as () => void
  onClick()
}

/**
 * Call a function component directly rather than through JSX, so its render actually runs.
 * `<DataTable {...props} />` alone only builds the vnode that *names* `DataTable`; nothing walks
 * inside it until a renderer calls it, and the tests here read the tree without one.
 */
function evaluate<P>(component: (props: P) => ComponentChild, props: P): ComponentChild {
  return component(props)
}

describe("DataTable", () => {
  it("renders the caption, visibly by default", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(html).toContain("<caption>Invoices</caption>")
  })

  it("hides the caption visually when captionHidden, without removing it", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
        captionHidden
      />,
    )

    expect(html).toContain('<caption class="sr-only">Invoices</caption>')
  })

  it("marks every header a column header, and only a sortable one a button", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(countOccurrences(html, 'scope="col"')).toBe(3)
    expect(countOccurrences(html, "<button")).toBe(2)
    // The non-sortable column's header text is on the page but not inside a button.
    expect(html).toMatch(/<th[^>]*>Id<\/th>/)
  })

  it("carries aria-sort only on the sorted column, ascending or descending", () => {
    const ascending = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(countOccurrences(ascending, "aria-sort=")).toBe(1)
    expect(headerCell(ascending, "Amount")).toContain('aria-sort="ascending"')
    expect(headerCell(ascending, "Id")).not.toContain("aria-sort")
    expect(headerCell(ascending, "Merchant")).not.toContain("aria-sort")

    const descending = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "desc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(headerCell(descending, "Amount")).toContain('aria-sort="descending"')
  })

  it("renders no aria-sort at all when nothing is sorted", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(html).not.toContain("aria-sort")
  })

  it("points the decorative glyph the way the column is sorted — broken by swapping the two paths", () => {
    const ascendingArrow = 'd="m6 15 6-6 6 6"'
    const descendingArrow = 'd="m6 9 6 6 6-6"'

    const unsorted = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(unsorted).not.toContain(ascendingArrow)
    expect(unsorted).not.toContain(descendingArrow)

    const ascending = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(ascending).toContain(ascendingArrow)
    expect(ascending).not.toContain(descendingArrow)

    const descending = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "desc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(descending).toContain(descendingArrow)
    expect(descending).not.toContain(ascendingArrow)
  })

  it("hides the sort glyph from assistive tech, sorted or not", () => {
    const unsorted = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    const sorted = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    // Two sortable columns, so two glyphs each render; every one of them must be aria-hidden.
    expect(countOccurrences(unsorted, "<svg")).toBe(2)
    expect(countOccurrences(unsorted, '<svg aria-hidden="true"')).toBe(2)
    expect(countOccurrences(sorted, "<svg")).toBe(2)
    expect(countOccurrences(sorted, '<svg aria-hidden="true"')).toBe(2)
  })

  it("never puts aria-sort on a display column beside a sorted data column", () => {
    const withActions: DataTableColumn<Invoice, keyof Invoice & string>[] = [
      { key: "id", header: "Id", sortable: true },
      { key: "merchant", header: "Merchant" },
      { id: "actions", header: "Actions", render: (row) => `Archive ${row.id}` },
    ]

    const html = render(
      <DataTable
        columns={withActions}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[{ key: "id", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(countOccurrences(html, "aria-sort=")).toBe(1)
    expect(headerCell(html, "Id")).toContain('aria-sort="ascending"')
    expect(headerCell(html, "Actions")).not.toContain("aria-sort")
    expect(html).toContain("Archive INV-1")
  })

  it("rejects a display column typed with sortable, or a column carrying both key and id", () => {
    // Type-level proof, not a runtime assertion: these two literals must fail `ts:check`, so a
    // regression that loosens DataTableDisplayColumn/DataTableDataColumn's `never` properties is
    // caught at compile time rather than by a screen reader hearing the wrong column announced.
    // Break this test's claim by deleting one `never` property in ui/data-table.tsx and re-run
    // `deno check ui/data-table.test.tsx` — the line below the deleted property's counterpart
    // stops erroring, and `@ts-expect-error` itself then reports "Unused '@ts-expect-error'
    // directive", which is what makes the loosened type a red `ts:check` rather than a silent gap.

    // @ts-expect-error — a display column has no field to sort by, so `sortable` cannot appear.
    const displayColumnWithSortable: DataTableColumn<Invoice, keyof Invoice & string> = {
      id: "actions",
      header: "Actions",
      sortable: true,
      render: () => null,
    }

    // @ts-expect-error — key and id are mutually exclusive; a column with both is neither shape.
    const columnWithBothKeyAndId: DataTableColumn<Invoice, keyof Invoice & string> = {
      key: "id",
      id: "actions",
      header: "Actions",
      render: () => null,
    }

    // Referenced so neither is an unused-variable lint error; the columns themselves are never
    // rendered — DataTable never sees the invalid shapes this test exists to keep uncompilable.
    expect(typeof displayColumnWithSortable).toBe("object")
    expect(typeof columnWithBothKeyAndId).toBe("object")
  })

  it("presses a sortable header's button through toggleSort", () => {
    let next: SortRule<keyof Invoice & string>[] | undefined
    const tree = evaluate(DataTable<Invoice, keyof Invoice & string>, {
      columns,
      rows,
      rowKey: (row) => row.id,
      sort: [{ key: "merchant", direction: "asc" }],
      onSortChange: (rules) => next = rules,
      caption: "Invoices",
    })

    pressHeader(tree, "Merchant")

    expect(next).toEqual([{ key: "merchant", direction: "desc" }])
  })

  it("appends a second sortable header as the least significant rule", () => {
    let next: SortRule<keyof Invoice & string>[] | undefined
    const tree = evaluate(DataTable<Invoice, keyof Invoice & string>, {
      columns,
      rows,
      rowKey: (row) => row.id,
      sort: [{ key: "merchant", direction: "asc" }],
      onSortChange: (rules) => next = rules,
      caption: "Invoices",
    })

    pressHeader(tree, "Amount")

    expect(next).toEqual([
      { key: "merchant", direction: "asc" },
      { key: "amount", direction: "asc" },
    ])
  })

  it("sorts rows with a null, undefined or empty cell to the end either way", () => {
    const withBlanks: Invoice[] = [
      { id: "a", merchant: "Zeta", amount: 5 },
      { id: "b", merchant: "Blank-null", amount: null },
      { id: "c", merchant: "Alpha", amount: 9 },
    ]

    const ascending = render(
      <DataTable
        columns={columns}
        rows={withBlanks}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(order(ascending)).toEqual(["a", "c", "b"])

    const descending = render(
      <DataTable
        columns={columns}
        rows={withBlanks}
        rowKey={(row) => row.id}
        sort={[{ key: "amount", direction: "desc" }]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )
    expect(order(descending)).toEqual(["c", "a", "b"])
  })

  it("sorts null, undefined and empty-string cells last, together, keeping their input order", () => {
    interface Ticket {
      id: string
      priority: number | null | undefined | ""
    }
    const ticketColumns: DataTableColumn<Ticket, keyof Ticket & string>[] = [
      { key: "id", header: "Id" },
      { key: "priority", header: "Priority", sortable: true },
    ]
    const tickets: Ticket[] = [
      { id: "has-null", priority: null },
      { id: "has-value-2", priority: 2 },
      { id: "has-undefined", priority: undefined },
      { id: "has-value-1", priority: 1 },
      { id: "has-empty-string", priority: "" },
    ]

    const ascending = render(
      <DataTable
        columns={ticketColumns}
        rows={tickets}
        rowKey={(row) => row.id}
        sort={[{ key: "priority", direction: "asc" }]}
        onSortChange={noop}
        caption="Tickets"
      />,
    )

    // The two real values sort ascending first; the three blank kinds tie and keep the order
    // `tickets` gave them.
    expect(order(ascending)).toEqual([
      "has-value-1",
      "has-value-2",
      "has-null",
      "has-undefined",
      "has-empty-string",
    ])

    const descending = render(
      <DataTable
        columns={ticketColumns}
        rows={tickets}
        rowKey={(row) => row.id}
        sort={[{ key: "priority", direction: "desc" }]}
        onSortChange={noop}
        caption="Tickets"
      />,
    )

    // Descending reverses the two real values, but the blanks still tie and still keep the input
    // order among themselves — "last" does not mean "last, then reversed like everything else".
    expect(order(descending)).toEqual([
      "has-value-2",
      "has-value-1",
      "has-null",
      "has-undefined",
      "has-empty-string",
    ])
  })

  it("stamps the row key on the first cell of every row, and nowhere else", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(countOccurrences(html, rowKeyAttribute)).toBe(rows.length)
    for (const row of rows) {
      expect(html).toContain(`${rowKeyAttribute}="${row.id}"`)
    }
  })

  it("renders each cell with the column's render, or String(value) without one", () => {
    const withRender: DataTableColumn<Invoice, keyof Invoice & string>[] = [
      { key: "id", header: "Id" },
      { key: "merchant", header: "Merchant" },
      {
        key: "amount",
        header: "Amount",
        render: (row) => row.amount === null ? "—" : `$${row.amount / 100}`,
      },
    ]
    const html = render(
      <DataTable
        columns={withRender}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(html).toContain("Coffee &amp; Co")
    expect(html).toContain("$4.5")
    expect(html).toContain("—")
  })

  it("shows the default EmptyState when there are no rows", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(html).toContain("No rows")
    expect(html).toContain('role="status"')
    expect(html).not.toContain(rowKeyAttribute)
  })

  it("shows a caller's own empty slot instead of the default", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
        empty={<p data-e2e="custom-empty">Nothing filed yet</p>}
      />,
    )

    expect(html).toContain("Nothing filed yet")
    expect(html).not.toContain("No rows")
  })

  it("renders no pager at all when paging is omitted", () => {
    const html = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={[]}
        onSortChange={noop}
        caption="Invoices"
      />,
    )

    expect(html).not.toContain("<nav")
  })

  it("pages the sorted rows and renders a Pagination sized to the full set", () => {
    const many: Invoice[] = Array.from({ length: 5 }, (_, index) => ({
      id: `INV-${index}`,
      merchant: String.fromCharCode(65 + index),
      amount: index,
    }))

    const html = render(
      <DataTable
        columns={columns}
        rows={many}
        rowKey={(row) => row.id}
        sort={[{ key: "merchant", direction: "desc" }]}
        onSortChange={noop}
        caption="Invoices"
        paging={{ page: 1, pageSize: 2, onChange: noop, label: "Invoice pages" }}
      />,
    )

    // Sorted descending by merchant: E, D, C, B, A — page 1 of size 2 is E, D.
    expect(order(html)).toEqual(["INV-4", "INV-3"])
    expect(html).toContain('aria-label="Invoice pages"')
    // ceil(5 / 2) = 3 pages, so page 3 exists and page 4 does not.
    expect(html).toContain('aria-label="Page 3"')
    expect(html).not.toContain('aria-label="Page 4"')
  })

  it("renders the middle page of a paged, sorted set — not just page 1", () => {
    // Sorted ascending by merchant, A…G is already that order: page 2 of size 3 is D, E, F.
    const html = render(
      <DataTable
        columns={columns}
        rows={sevenInvoices}
        rowKey={(row) => row.id}
        sort={[{ key: "merchant", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
        paging={{ page: 2, pageSize: 3, onChange: noop }}
      />,
    )

    expect(order(html)).toEqual(["INV-D", "INV-E", "INV-F"])
    expect(html).toContain('aria-current="page"')
  })

  it("clamps a page past the last one into range, for both the rows and the pager", () => {
    // 7 rows, pageSize 3 → 3 pages. Page 9 clamps to page 3: G alone, not an empty body.
    const html = render(
      <DataTable
        columns={columns}
        rows={sevenInvoices}
        rowKey={(row) => row.id}
        sort={[{ key: "merchant", direction: "asc" }]}
        onSortChange={noop}
        caption="Invoices"
        paging={{ page: 9, pageSize: 3, onChange: noop }}
      />,
    )

    expect(order(html)).toEqual(["INV-G"])
    expect(html).not.toContain("No rows")
    expect(html).toContain('aria-current="page"')
    expect(html).toContain(">3</button>")
  })

  it("clamps a page of zero or less up to the first page", () => {
    for (const page of [0, -3]) {
      const html = render(
        <DataTable
          columns={columns}
          rows={sevenInvoices}
          rowKey={(row) => row.id}
          sort={[{ key: "merchant", direction: "asc" }]}
          onSortChange={noop}
          caption="Invoices"
          paging={{ page, pageSize: 3, onChange: noop }}
        />,
      )

      expect(order(html)).toEqual(["INV-A", "INV-B", "INV-C"])
    }
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** Row order as the markup rendered it, read off the `data-row-key` stamps. */
function order(html: string): string[] {
  return [...html.matchAll(new RegExp(`${rowKeyAttribute}="([^"]+)"`, "g"))].map((match) =>
    match[1]
  )
}

/**
 * The `<th>…</th>` block whose rendered text is exactly `label`, so a test can assert an
 * attribute on *that* header rather than on the markup as a whole.
 *
 * A count of `aria-sort=` occurrences, or a bare `toContain('aria-sort="ascending"')`, cannot
 * tell "the sorted column carries it" from "some column carries it": moving the attribute onto
 * the wrong `<th>` changes neither the count nor the substring, only which element it sits on.
 */
function headerCell(html: string, label: string): string {
  const blocks = html.split("</th>").map((block) => `${block}</th>`)
  const found = blocks.find((block) => block.includes(`>${label}<`))
  if (!found) throw new Error(`no <th> rendered for "${label}"`)
  return found
}
