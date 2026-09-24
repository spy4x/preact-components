import { cn } from "@preact-components/cn"
import {
  type SortDirection,
  sortRows,
  type SortRule,
  toggleSort,
} from "@preact-components/signals/table-state"
import type { ComponentChildren, JSX } from "preact"
import { EmptyState } from "./empty-state.tsx"
import { Pagination } from "./pagination.tsx"
import { Table } from "./table.tsx"

/** Horizontal alignment of one column's header and cells. Defaults to `"left"`. */
export type DataTableColumnAlign = "left" | "center" | "right"

/**
 * A column that reads one field of a row, and may be sorted by it.
 *
 * `key` is the identity `toggleSort`/`sortRows` sort by, so it has to be one of `T`'s own string
 * keys, and it is also this column's Preact key. `sortable` and `aria-sort` both live only on this
 * shape — see {@link DataTableDisplayColumn} for the column that has neither. `id?: never` is what
 * makes the two shapes exclusive rather than merely different: without it, a column carrying both
 * `key` and `id` type-checked, was read as a data column by {@link isDataColumn}'s `"key" in
 * column`, and reported `aria-sort` under an `id` a caller had migrated to. `id` itself is never a
 * property this shape uses; the type only exists to reject one a caller left behind.
 */
export interface DataTableDataColumn<T, K extends Extract<keyof T, string>> {
  /** Row field this column reads, and the sort key it toggles when `sortable`. */
  key: K
  /** Header text, and — for a sortable column — the accessible name of its header button. */
  header: string
  /** Whether clicking (or Space-pressing) the header toggles this column's sort. Defaults to `false`. */
  sortable?: boolean
  /** Header and cell alignment. Defaults to `"left"`. */
  align?: DataTableColumnAlign
  /** Cell content. Defaults to `String(row[key])`, or nothing at all for `null`/`undefined`. */
  render?: (row: T) => ComponentChildren
  /** Never present — see the type's own doc comment for why this rejects a stray `id`. */
  id?: never
}

/**
 * A column with no field of its own — an actions column, typically — that only ever renders what
 * `render` returns.
 *
 * It is never sortable and never carries `aria-sort`: there is no row field for `sort` to name, so
 * there is nothing for a header press to toggle — `sortable?: never` and `key?: never` make both
 * a compile error rather than a value `DataTable` would have to notice and ignore at runtime. Before
 * they were added, `{ id, header, render, sortable: true }` type-checked and rendered as plain,
 * unclickable text with no error anywhere, and `{ key, id, header, render }` type-checked, was read
 * as a data column, and reported `aria-sort` on an `id` a caller had migrated to — the exact bug
 * this split exists to rule out, still reachable through the types alone.
 *
 * `id` is this column's own Preact key, in a namespace the type system now keeps separate from
 * every data column's `key`. What the types do not check, and cannot — both are ordinary runtime
 * strings — is that every column's own `id` or `key` is unique within one `columns` array; that is
 * documented, the way any list of keyed things asks for distinct keys, not enforced.
 */
export interface DataTableDisplayColumn<T> {
  /** This column's own identity — its Preact key. Document it unique across `columns`. */
  id: string
  /** Header text. */
  header: string
  /** Header and cell alignment. Defaults to `"left"`. */
  align?: DataTableColumnAlign
  /** Cell content. Required: a display column has no field to fall back to. */
  render: (row: T) => ComponentChildren
  /** Never present — this shape has no field to sort by. */
  sortable?: never
  /** Never present — this shape has no field `sort`/`toggleSort` could name. */
  key?: never
}

/** One column of a {@link DataTable}: a field to read and maybe sort by, or a display-only slot. */
export type DataTableColumn<T, K extends Extract<keyof T, string>> =
  | DataTableDataColumn<T, K>
  | DataTableDisplayColumn<T>

/** `true` for a column with a row field of its own — see {@link DataTableDataColumn}. */
function isDataColumn<T, K extends Extract<keyof T, string>>(
  column: DataTableColumn<T, K>,
): column is DataTableDataColumn<T, K> {
  return "key" in column
}

/** This column's own Preact key: `key` for a data column, `id` for a display column. */
function columnId<T, K extends Extract<keyof T, string>>(column: DataTableColumn<T, K>): string {
  return isDataColumn(column) ? column.key : column.id
}

/**
 * Paging, all of it caller-owned like `sort` — see {@link DataTableProps.sort}. Omit the whole
 * object for an unpaged table.
 */
export interface DataTablePaging {
  /** Current page, `1`-based. Clamped into `1…pageCount` the same way `Pagination` clamps its own. */
  page: number
  /** Rows per page. */
  pageSize: number
  /** Called with the page the caller asked for; `DataTable` never changes `page` itself. */
  onChange: (page: number) => void
  /** Accessible name of the pager's `nav` landmark. Defaults to `"Pagination"`. */
  label?: string
  /** Text of the previous control. Defaults to `"Previous"`. */
  previousLabel?: string
  /** Text of the next control. Defaults to `"Next"`. */
  nextLabel?: string
  /** Accessible name of one page number, as a function of that number. */
  pageLabel?: (page: number) => string
}

/**
 * Props of {@link DataTable}.
 *
 * `columns` and `rows` are what to show; `sort` and `paging` are the two pieces of state the
 * caller owns and `DataTable` only ever reads and requests changes to, exactly as `Pagination`'s
 * own `page` prop works. `caption` is the one required string, because it is the table's name and
 * only the caller knows it; everything else about presentation — `empty`, `captionHidden`,
 * `rowDataE2E`, `class` — has a default.
 *
 * `DataTable` sorts and pages client-side only: `rows` has to be the complete, unsorted set, and
 * `sortRows`' own collation runs even over rows a server already sorted. A caller whose rows are
 * paged by a server has no way to hand this component a `pageCount` for a page it cannot see the
 * rest of — a caller-supplied-`pageCount` mode is tracked as a follow-up
 * (github.com/spy4x/preact-components/issues/235), not built here.
 */
export interface DataTableProps<T, K extends Extract<keyof T, string>> {
  /** Columns, in display order. */
  columns: readonly DataTableColumn<T, K>[]
  /** Every row, unsorted and unpaged — `DataTable` applies both. */
  rows: readonly T[]
  /**
   * Sort rules, most significant first. The caller owns this state — a signal, a `useState`, a URL
   * parameter through `parseSort`/`serializeSort` — so it can persist across a reload or a
   * navigation the way a page's other filters do. `DataTable` reads it, applies it with
   * `sortRows` and writes the next value back through {@link onSortChange}; it holds no sort state
   * of its own.
   */
  sort: readonly SortRule<K>[]
  /**
   * Called with the sort rules a header press implies, via `toggleSort`. A column not yet in
   * `sort` is appended as the least significant rule rather than replacing what is there, so
   * pressing a second sortable header builds a multi-column sort with no modifier key: Tab to it
   * and press Space. Cycling a rule back off — asc → desc → off — is how a column already in the
   * mix, primary or not, is removed; there is no separate "clear all" gesture here.
   */
  onSortChange: (sort: SortRule<K>[]) => void
  /**
   * The table's name, read out as its `<caption>`. Required: it is the one string only the caller
   * knows, so there is no English default to fall back to. An empty string still satisfies the
   * type and leaves the table with an unnamed `<caption>` — pass a real name.
   */
  caption: string
  /** Hides the caption visually (`sr-only`) while keeping it for assistive tech. Defaults to `false`. */
  captionHidden?: boolean
  /** Shown instead of the body when `rows` is empty. Defaults to `<EmptyState title="No rows" />`. */
  empty?: ComponentChildren
  /** Optional paging; omit for every row on one page. */
  paging?: DataTablePaging
  /** Identifies one row, for anything that needs to point at it. See {@link rowKeyAttribute}. */
  rowKey: (row: T) => string | number
  /** Sets `data-e2e` on every body row, forwarded to `Table`. */
  rowDataE2E?: string
  class?: string
}

const alignClasses: Record<DataTableColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

/** `class` for one column's header and cells. */
function alignClass(align: DataTableColumnAlign = "left"): string {
  return alignClasses[align]
}

const sortButtonClasses = "inline-flex w-full items-center gap-1 rounded " +
  "focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 " +
  "focus-visible:outline-hidden hover:text-purple-900 dark:hover:text-purple-400"

/**
 * The `aria-sort` value for a column, or `undefined` for a column not currently part of `sort` —
 * `undefined` omits the attribute entirely rather than writing `aria-sort="none"`, so only a
 * sorted column carries it at all.
 */
function ariaSortValue(
  direction: SortDirection | undefined,
): "ascending" | "descending" | undefined {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return undefined
}

/**
 * Decorative sort glyph: two chevrons, muted, when the column is not sorted; one chevron, pointing
 * the sorted direction, when it is. `aria-hidden` throughout — `aria-sort` on the `<th>` is what
 * carries the state to assistive tech, so this is never more than a sighted hint.
 */
function SortGlyph({ direction }: { direction: SortDirection | undefined }) {
  return (
    <svg
      aria-hidden="true"
      class={cn("size-3.5 shrink-0", direction === undefined && "text-gray-400 dark:text-gray-500")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {direction === "asc" && <path d="m6 15 6-6 6 6" />}
      {direction === "desc" && <path d="m6 9 6 6 6-6" />}
      {direction === undefined && (
        <>
          <path d="m7 9 5-5 5 5" />
          <path d="m7 15 5 5 5-5" />
        </>
      )}
    </svg>
  )
}

/** `String(row[key])`, or nothing for a `null`/`undefined` cell. */
function defaultCell<T, K extends Extract<keyof T, string>>(row: T, key: K): ComponentChildren {
  const value = row[key]
  return value === null || value === undefined ? null : String(value)
}

/**
 * One column's `<th>`: plain text for a display column, or for a data column — sortable or not —
 * its header with `aria-sort` set from `sort`.
 *
 * A plain function returning JSX, called directly from {@link DataTable}'s own `columns.map`
 * rather than invoked as `<HeaderCell />`: `DataTable`'s render is a string-rendering unit test's
 * only way to see this markup, and a test that walks the returned tree without a renderer — this
 * package's tests do, see `ui/data-table.test.tsx` — only ever sees as far as the last JSX a
 * function *returns* without another component boundary in between. A `<HeaderCell />` element
 * would leave the button one uncalled component short of that walk.
 */
function headerCell<T, K extends Extract<keyof T, string>>(
  column: DataTableColumn<T, K>,
  sort: readonly SortRule<K>[],
  onSortChange: (next: SortRule<K>[]) => void,
) {
  if (!isDataColumn(column)) {
    return <th key={column.id} scope="col" class={alignClass(column.align)}>{column.header}</th>
  }

  const rule = sort.find((candidate) => candidate.key === column.key)

  return (
    <th
      key={column.key}
      scope="col"
      class={alignClass(column.align)}
      aria-sort={ariaSortValue(rule?.direction)}
    >
      {column.sortable
        ? (
          <button
            type="button"
            class={sortButtonClasses}
            onClick={() => onSortChange(toggleSort([...sort], column.key))}
          >
            <span class={column.align === "right" ? "ml-auto" : undefined}>{column.header}</span>
            <SortGlyph direction={rule?.direction} />
          </button>
        )
        : column.header}
    </th>
  )
}

/**
 * One column's `<td>` for one row: `render` when the column has one, `defaultCell` for a data
 * column without, `render` unconditionally for a display column (required on that shape). A plain
 * function for the same reason {@link headerCell} is one.
 *
 * @param stampRowKey `rowKeyAttribute`'s value for this row, on the row's first cell only —
 *   `undefined` for every other cell. See {@link rowKeyAttribute}.
 */
function bodyCell<T, K extends Extract<keyof T, string>>(
  column: DataTableColumn<T, K>,
  row: T,
  stampRowKey: string | undefined,
) {
  const content = isDataColumn(column)
    ? (column.render ? column.render(row) : defaultCell(row, column.key))
    : column.render(row)

  return (
    <td
      key={columnId(column)}
      class={alignClass(column.align)}
      {...(stampRowKey === undefined ? {} : { [rowKeyAttribute]: stampRowKey })}
    >
      {content}
    </td>
  )
}

/**
 * Attribute a row's first cell carries so a page — or a browser check — can find that row by the
 * identity {@link DataTableProps.rowKey} gives it, without depending on rendered cell text.
 *
 * `Table` keys its `<tr>`s by array position, not by a caller-supplied identity — extending that
 * is `ui/table.tsx`'s own change to make, tracked as a follow-up
 * (github.com/spy4x/preact-components/issues/234) rather than built here — so a sort or a page
 * turn that reorders the rows gives Preact nothing to reconcile a row's identity against. Stamping
 * the key on the DOM is what lets anything downstream tell rows apart by more than their position.
 */
export const rowKeyAttribute = "data-row-key"

/**
 * A sortable, optionally paged table: `Table`'s markup, `table-state`'s sort rules, one component
 * joining them.
 *
 * `DataTable` sorts and pages `rows` itself — with `sortRows` and a plain slice — because it is
 * the one place already holding both the full row set and the rules to apply to it; asking every
 * caller to pre-sort and pre-slice its own rows would just move that pairing back out to the two
 * call sites the issue this component closes found doing exactly that by hand. What stays
 * caller-owned is the *state* — `sort` and `paging.page` — so it can live in a signal or a URL
 * parameter the way any other filter does; `DataTable` holds none of its own.
 *
 * `paging.page` is clamped into `1…pageCount` the same way `Pagination` clamps its own `page`
 * prop, before it is used for both the slice and the pager it renders — a page past the end, or
 * `0` or less, renders the nearest real page rather than an empty body beside a pager that
 * disagrees with it.
 *
 * Every sortable header is a real `<button>`, so Tab, Space and Enter all reach it — see
 * `pages/checks/ui.ts`. `aria-sort` goes on the `<th>` of whichever data column or columns are in
 * `sort`, `ascending` or `descending`; a column not in `sort`, and a {@link DataTableDisplayColumn}
 * always, carries no
 * `aria-sort` at all. The chevron beside a sortable header's text is `aria-hidden` — `aria-sort`
 * is what a screen reader is told, the glyph is only ever a sighted hint.
 */
export function DataTable<T, K extends Extract<keyof T, string>>(
  {
    columns,
    rows,
    sort,
    onSortChange,
    caption,
    captionHidden = false,
    empty,
    paging,
    rowKey,
    rowDataE2E,
    class: className,
  }: DataTableProps<T, K>,
): JSX.Element {
  const sorted = sortRows([...rows], [...sort])

  let visible = sorted
  let currentPage: number | undefined
  let pageCount: number | undefined
  if (paging) {
    pageCount = Math.ceil(sorted.length / paging.pageSize)
    currentPage = Math.max(1, Math.min(Math.max(pageCount, 1), Math.round(paging.page)))
    visible = sorted.slice((currentPage - 1) * paging.pageSize, currentPage * paging.pageSize)
  }

  const headerSlot = (
    <>
      {columns.map((column) => headerCell(column, sort, onSortChange))}
    </>
  )

  const bodySlots = visible.length > 0
    ? visible.map((row) =>
      columns.map((column, index) =>
        bodyCell(column, row, index === 0 ? String(rowKey(row)) : undefined)
      )
    )
    : [
      <td key="empty" colspan={columns.length}>
        {empty ?? <EmptyState title="No rows" />}
      </td>,
    ]

  return (
    <div class={className}>
      <Table
        caption={caption}
        captionClass={captionHidden ? "sr-only" : undefined}
        headerSlot={headerSlot}
        bodySlots={bodySlots}
        rowDataE2E={rowDataE2E}
      />
      {paging && (
        <Pagination
          class="mt-4"
          page={currentPage ?? 1}
          pageCount={pageCount ?? 0}
          onChange={paging.onChange}
          label={paging.label}
          previousLabel={paging.previousLabel}
          nextLabel={paging.nextLabel}
          pageLabel={paging.pageLabel}
        />
      )}
    </div>
  )
}
