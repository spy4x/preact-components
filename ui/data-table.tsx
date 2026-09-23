import { cn } from "@preact-components/cn"
import {
  type SortDirection,
  sortRows,
  type SortRule,
  toggleSort,
} from "@preact-components/signals/table-state"
import type { ComponentChildren } from "preact"
import { EmptyState } from "./empty-state.tsx"
import { Pagination } from "./pagination.tsx"
import { Table } from "./table.tsx"

/** Horizontal alignment of one column's header and cells. Defaults to `"left"`. */
export type DataTableColumnAlign = "left" | "center" | "right"

/**
 * One column of a {@link DataTable}.
 *
 * `key` doubles as the identity `toggleSort`/`sortRows` sort by, so it has to be one of `T`'s own
 * string keys — including a column with no `render`-free reading of its own, such an "actions"
 * column, which picks any convenient key (its row's id, say) and leaves `sortable` unset.
 */
export interface DataTableColumn<T, K extends Extract<keyof T, string>> {
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
}

/**
 * Paging, all of it caller-owned like `sort` — see {@link DataTableProps.sort}. Omit the whole
 * object for an unpaged table.
 */
export interface DataTablePaging {
  /** Current page, `1`-based. */
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
   * knows, so there is no English default to fall back to.
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
 * Attribute a row's first cell carries so a page — or a browser check — can find that row by the
 * identity {@link DataTableProps.rowKey} gives it, without depending on rendered cell text.
 *
 * `Table` keys its `<tr>`s by array position, not by a caller-supplied identity — extending that
 * is `ui/table.tsx`'s own change to make, and out of scope here — so a sort or a page turn that
 * reorders the rows gives Preact nothing to reconcile a row's identity against. Stamping the key
 * on the DOM is what lets anything downstream tell rows apart by more than their position.
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
 * Every sortable header is a real `<button>`, so Tab and Space reach it (a real Enter press does
 * not activate a focused button in this repository's browser checks — see `pages/checks/ui.ts`).
 * `aria-sort` goes on the `<th>` of whichever column or columns are in `sort`, `ascending` or
 * `descending`; a column not in `sort` carries no `aria-sort` at all. The chevron beside a
 * sortable header's text is `aria-hidden` — `aria-sort` is what a screen reader is told, the
 * glyph is only ever a sighted hint.
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
) {
  const sortRuleFor = (key: K) => sort.find((rule) => rule.key === key)

  const sorted = sortRows([...rows], [...sort])
  const pageCount = paging === undefined ? undefined : Math.ceil(sorted.length / paging.pageSize)
  const visible = paging === undefined
    ? sorted
    : sorted.slice((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize)

  const headerSlot = (
    <>
      {columns.map((column) => {
        const rule = sortRuleFor(column.key)
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
                  <span class={column.align === "right" ? "ml-auto" : undefined}>
                    {column.header}
                  </span>
                  <SortGlyph direction={rule?.direction} />
                </button>
              )
              : column.header}
          </th>
        )
      })}
    </>
  )

  const bodySlots = visible.length > 0
    ? visible.map((row) =>
      columns.map((column, index) => (
        <td
          key={column.key}
          class={alignClass(column.align)}
          {...(index === 0 ? { [rowKeyAttribute]: String(rowKey(row)) } : {})}
        >
          {column.render ? column.render(row) : defaultCell(row, column.key)}
        </td>
      ))
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
          page={paging.page}
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
