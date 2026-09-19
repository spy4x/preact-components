import { cn } from "@preact-components/signals/cn"

/**
 * Shape-matching skeletons: variants whose boxes are computed from the same counts and widths the
 * real component takes, instead of one generic shimmering block.
 *
 * A new file rather than an addition to `loading-skeleton.tsx`: that module owns the generic
 * [`LoadingSkeleton`](./loading-skeleton.tsx), which is already merged and consumed, and the pure
 * geometry functions below are the reason these variants exist. Keeping them apart leaves the base's
 * tests untouched and makes the subpath say what the caller is importing.
 *
 * Every placeholder subtree is `aria-hidden="true"` and says nothing on its own. The announcement is
 * a sibling live region — see {@link SkeletonStatus} and {@link skeletonStatusRole}.
 */

/**
 * A text line's width. A number is a percentage (`0…100`, clamped); `"full"` and `undefined` both
 * mean the whole line. A non-finite number degrades to `"full"` rather than to a NaN width.
 */
export type SkeletonLineWidth = number | "full" | undefined

export interface SkeletonTextProps {
  /** Number of placeholder lines. Fractional counts floor; negatives render nothing. Defaults to 3. */
  lines?: number
  /**
   * Width of each line, cycled when shorter than `lines` and ignored past it. Omitted, every line is
   * full width — the block matches the paragraph it replaces.
   */
  widths?: readonly SkeletonLineWidth[]
  class?: string
}

export interface SkeletonTableProps {
  /** Number of placeholder body rows. Defaults to one row per column. */
  rows?: number
  /** Column count. Needed unless `widths` already states it, or there is nothing to render. */
  columns?: number
  /**
   * Per-column widths, ignoring `columns` when longer. Numbers are relative weights — `[3, 1]` is
   * `75% / 25%` — and a non-positive entry collapses its column, a shorter list the tail. Omitted,
   * every column is equal.
   */
  widths?: readonly number[]
  /**
   * Reserve the real table's `min-h-[300px]`. On by default because that is what `Table` renders;
   * set `false` when the real table drops it, otherwise the substitution shifts the page.
   */
  reserveHeight?: boolean
  class?: string
}

export interface SkeletonCardsProps {
  /** Cards per row. Defaults to 3. */
  columns?: number
  /** Placeholder rows of cards. Defaults to 1. */
  rows?: number
  /** Placeholder text lines inside each card. Defaults to 2. */
  lines?: number
  class?: string
}

export interface SkeletonStatusProps {
  /** Announcement text. A blank or absent label renders nothing. */
  label?: string | null
  class?: string
}

/** Width one table column is laid out at, as a percentage of the table. */
export interface TableColumnWidth {
  /** Zero-based column index. */
  index: number
  /** Percentage of the table's full width, rounded to four decimals. */
  percent: number
}

/** Resolved geometry of a skeleton table: what the table renders, in numbers. */
export interface TableGeometry {
  /** Row count actually rendered, after the fractional and negative cases are resolved. */
  rows: number
  /** Column count actually rendered, after `widths` has had its say. */
  columns: number
  /** Placeholder cells in the body — always `rows * columns`. */
  cells: number
  /** Body row height in `rem`, matching one `<tr>` of the real `Table`. */
  rowHeightRem: number
  /** Column widths, in order. */
  columnWidths: TableColumnWidth[]
  /** Value for the table's `grid-template-columns`: one track per column, weights when given. */
  gridTemplateColumns: string
}

/** Resolved geometry of a skeleton paragraph. */
export interface TextGeometry {
  /** Line count actually rendered. */
  lines: number
  /** One percentage per line, in order. */
  linePercents: number[]
}

/** Spacing tokens the real components lay out with, in `rem`. The row-height formulas use these. */
export const SKELETON_METRICS = {
  /** `text-sm` line-height — the body row font of `Table` and the base line of this module. */
  lineHeightRem: 1.25,
  /** `py-4` on a `Table` body cell. */
  cellPaddingYRem: 1,
  /** `py-3` on a `Table` header cell. */
  headerPaddingYRem: 0.75,
  /** `gap-4` between the cards of a card grid. */
  cardGapRem: 1,
  /** `p-5` inside a `Card`. */
  cardPaddingRem: 1.25,
} as const

/**
 * Height of one `Table` body row, from the same tokens the real `Table` uses.
 *
 * A `Table` body row is `text-sm *:px-6 *:py-4`: one line box of `1.25rem` plus `py-4` twice, so
 * `3.25rem` for a single-line cell. A cell wrapping to two lines is taller, which is why the
 * skeleton reserves one line per row and the caller keeps cell content to one line where it wants
 * the substitution to be invisible.
 *
 * @returns The row height in `rem`.
 */
export function tableRowHeightRem(): number {
  return SKELETON_METRICS.lineHeightRem + 2 * SKELETON_METRICS.cellPaddingYRem
}

/**
 * Height of the `Table` header row, from the same tokens the real `Table` uses.
 *
 * @returns The header height in `rem`.
 */
export function tableHeaderHeightRem(): number {
  return SKELETON_METRICS.lineHeightRem + 2 * SKELETON_METRICS.headerPaddingYRem
}

/**
 * Resolve a possibly-hostile count into the number of items to render.
 *
 * Absent keeps the fallback; everything else lands on a whole count of at least zero, so a
 * fractional, negative, `NaN` or infinite value cannot produce a fractional loop bound or an
 * unbounded one.
 *
 * @param value Caller-supplied count.
 * @param fallback Count used when `value` is absent.
 * @returns A non-negative integer.
 */
export function skeletonCount(value: number | undefined, fallback: number): number {
  if (value === undefined) return Math.max(0, Math.floor(fallback))
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.floor(value))
}

/**
 * Round a percentage to four decimals, well inside what a browser honours on a grid track.
 *
 * @param percent Raw percentage.
 * @returns The rounded percentage.
 */
function roundPercent(percent: number): number {
  return Math.round(percent * 10000) / 10000
}

/**
 * Turn per-column weights into the percentages a table lays its columns out at.
 *
 * Weights are relative: `[3, 1]` is `75% / 25%`, and `[1, 1]` is the same split a `table-auto`
 * table gives two equal columns. A non-positive or non-finite weight collapses its column to `0%`,
 * which is how a caller hides one, and a call with fewer weights than columns collapses the tail —
 * a weight the caller never gave is zero, not a guess. When no weight is positive the columns are
 * equal instead: a table whose every column measured zero is a blank box rather than the shape of a
 * table, so `[0, 0]` and `[-1, -1]` are both `50% / 50%`.
 *
 * This is the shared half of the layout-shift contract: the percentages depend only on `widths`, so
 * the real table's `<colgroup>` — built from the same array at the same column count — scales
 * identically, and both sides can be asserted without a DOM.
 *
 * @param widths Per-column weights, one per column; a shorter list collapses the tail.
 * @returns One percentage per column, in order.
 */
export function columnWidthPercents(widths: readonly number[]): number[] {
  const total = widths.map((width) => (Number.isFinite(width) && width > 0 ? width : 0))
  const sum = total.reduce((acc, weight) => acc + weight, 0)
  const count = total.length || 1
  if (sum <= 0) return total.map(() => roundPercent(100 / count))

  return total.map((weight) => roundPercent((weight / sum) * 100))
}

/**
 * Normalise one text-line width into a percentage.
 *
 * @param width Percentage, `"full"` or absent.
 * @returns A percentage clamped to `0…100`.
 */
function linePercent(width: SkeletonLineWidth): number {
  if (width === undefined || width === "full" || !Number.isFinite(width)) return 100

  return Math.min(100, Math.max(0, width))
}

/**
 * Resolve the geometry a {@link SkeletonText} renders from its `lines` and `widths` props.
 *
 * With no `widths`, every line is `100%`: the honest shape for a paragraph, where a ragged right
 * edge belongs to the copy rather than to the placeholder. With `widths`, the list is cycled, so a
 * call site does not have to repeat itself and the same array means the same thing at any line
 * count.
 *
 * @param lines Line count; defaults to 3, fractional counts floor, negatives are none.
 * @param widths Per-line widths, cycled when shorter than `lines`.
 * @returns Line count and one percentage per line.
 */
export function textGeometry(
  lines = 3,
  widths: readonly SkeletonLineWidth[] = [],
): TextGeometry {
  const count = skeletonCount(lines, 3)

  return {
    lines: count,
    linePercents: Array.from(
      { length: count },
      (_, index) => widths.length > 0 ? linePercent(widths[index % widths.length]) : 100,
    ),
  }
}

/**
 * Resolve the geometry a {@link SkeletonTable} renders from its `rows`, `columns` and `widths`.
 *
 * The whole point of the function is that the answer needs no DOM: a test, or a reviewer reading a
 * PR, can ask what a table of `2 × 3` measures and compare it against the table it will replace.
 * `cells` is `rows * columns`, which is what makes "a `SkeletonTable` for N × M produces exactly
 * N × M placeholder cells" an assertion rather than a hope.
 *
 * Column count follows `widths` when they are present, because a caller that named its columns has
 * already said how many there are; `columns` then only decides whether the header is wider than the
 * body. Rows default to one per column, so `<SkeletonTable columns={4} />` is the shape of a
 * four-column table with content rather than an empty one.
 *
 * The grid declaration keeps the caller's weights as `fr` rather than the rounded percentages: `fr`
 * and `width: n%` resolve to the same ratio, so a real `<colgroup>` styled from these very
 * percentages — or from `[3, 1]` applied to a `table-fixed` table — lines up with the grid at any
 * viewport, which is the substitution guarantee stated without needing the DOM to check it.
 *
 * @param props `rows`, `columns` and `widths`, exactly as {@link SkeletonTable} takes them.
 * @returns Row, column, cell and per-column width numbers, plus the grid declaration to render.
 */
export function tableGeometry(props: {
  rows?: number
  columns?: number
  widths?: readonly number[]
} = {}): TableGeometry {
  const { rows, columns, widths } = props
  const declared = widths !== undefined && widths.length > 0 ? widths : undefined
  const columnCount = declared !== undefined ? declared.length : skeletonCount(columns, 0)
  const rowCount = skeletonCount(rows, columnCount)
  const percents = declared !== undefined ? columnWidthPercents(declared) : Array.from(
    { length: columnCount },
    () => roundPercent(columnCount > 0 ? 100 / columnCount : 0),
  )
  const tracks = declared !== undefined
    ? declared.map((width) => (Number.isFinite(width) && width > 0 ? width : 0))
    : Array.from({ length: columnCount }, () => 1)
  const trackSum = tracks.reduce((sum, weight) => sum + weight, 0)
  const grid = trackSum > 0 ? tracks : Array.from({ length: Math.max(columnCount, 1) }, () => 1)

  return {
    rows: rowCount,
    columns: columnCount,
    cells: rowCount * columnCount,
    rowHeightRem: tableRowHeightRem(),
    columnWidths: percents.map((percent, index) => ({ index, percent })),
    gridTemplateColumns: grid.join("fr ") + "fr",
  }
}

/**
 * ARIA role a loading announcement takes.
 *
 * A function rather than a string literal in the markup so the choice is nameable in a test and in
 * review: `"status"` is polite, `"alert"` would interrupt, and a placeholder that grabs the
 * conversation from a screen reader is worse than one that says nothing. `SkeletonStatus` is its
 * only caller.
 *
 * @returns `"status"`.
 */
export function skeletonStatusRole(): "status" {
  return "status"
}

/** Pulse shared with `LoadingSkeleton`, so both shimmer identically. */
const bar = "animate-pulse rounded bg-gray-200 dark:bg-gray-700"

/** Line box of a `text-sm` paragraph, short of the `h-4` utility by design. */
const textLineRem = SKELETON_METRICS.lineHeightRem

/** Cell padding of a real `Table` cell (`*:px-6`), reused as the horizontal padding of the grid. */
const tableCell = "px-6"

/**
 * Box of the real `Table`'s wrapper: same ring, radius, background, `min-h-[300px]` reservation and
 * `-mx-4 md:mx-0` bleed, so swapping one for the other moves nothing.
 *
 * Duplicated from `table.tsx` rather than exported from there because that module is merged and
 * consumed; the two are kept in step by the contract documented on {@link SkeletonTable}.
 */
const tableBox =
  "-mx-4 md:mx-0 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-600 sm:rounded-lg pb-px overflow-x-auto"

/** The height reservation `Table` ships, kept separate so `reserveHeight={false}` can drop it. */
const tableMinHeight = "min-h-[300px]"

/** `tr` utilities of the real `Table` header row. */
const tableHeaderRow =
  "bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-200"

/** `tr` utilities of a real `Table` body row, minus the hover a placeholder has no reason to have. */
const tableBodyRow = "text-sm border-t border-gray-100 dark:border-gray-600 dark:text-gray-300"

/** Grid a card grid is written with: `gap-4`, two columns on `sm`, three on `lg`. */
const cardGrid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"

/** Surface and padding of the real `Card`, so a grid of these lines up with a grid of cards. */
const cardSurface =
  "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"

/**
 * Paragraph-shaped placeholder: `lines` bars, each at its own width.
 *
 * Height and gap come from the same `text-sm` line box the real paragraph uses, so the block is the
 * shape of the copy it replaces — a caller matching different leading passes a matching `class`.
 *
 * @see textGeometry for the widths this renders, and {@link SkeletonStatus} for the announcement.
 */
export function SkeletonText({ lines, widths, class: className }: SkeletonTextProps) {
  return (
    <div class={cn("space-y-2", className)} aria-hidden="true" data-skeleton-text="true">
      {textGeometry(lines, widths).linePercents.map((percent, index) => (
        <div
          key={index}
          class={bar}
          style={{ width: `${percent}%`, height: `${textLineRem}rem` }}
          data-skeleton-line={index}
          data-width={percent}
        />
      ))}
    </div>
  )
}

/**
 * Table-shaped placeholder that mirrors a real `Table`'s boxes.
 *
 * The wrapper is the real wrapper's utility list, the header row is the real header row's, and each
 * body row is one real body row tall — {@link tableRowHeightRem} — with `*:px-6`-equivalent padding.
 * Columns are a `grid-template-columns` of equal fractions on the header *and* every body row, which
 * is what lines a column's left edge up down the whole table: a real `<table>` does that for free, a
 * stack of divs has to be told.
 *
 * ## Guaranteeing no layout shift
 *
 * "The same box dimensions" is only meaningful when both sides agree on the inputs, so the contract
 * lives on the caller's side of it. The skeleton matches the real `Table` when:
 *
 * 1. `columns` is the real table's column count, or `widths` is the array its widths came from.
 * 2. That array also goes to {@link columnWidthPercents} for the real table's `<colgroup>` — same
 *    function, same percentages, so the two scale identically at any viewport.
 * 3. `rows` times {@link tableRowHeightRem} covers the real body: an empty table reserves `0` rows
 *    and passes `reserveHeight={false}` to release the `min-h-[300px]`; a populated one reserves
 *    what it will show.
 * 4. The same `class` goes to both, since both accept one and the real table owns its own margin.
 *
 * Anything the caller's cells do beyond that — wrapping to two lines, a `Table` that is narrower
 * than its wrapper — is outside what a props-only component can know. It is the honest limit of this
 * contract rather than something the component hides: a skeleton can reserve boxes, not measure copy
 * it has never seen.
 *
 * ## Announcements
 *
 * The tree is `aria-hidden="true"` and this component has no `role`, so a screen reader is told
 * nothing by it. Pair it with a sibling {@link SkeletonStatus} — that is a component rather than a
 * `label` prop here so one region can cover several placeholders and the caller keeps the copy.
 *
 * @see tableGeometry for the numbers this renders.
 */
export function SkeletonTable(
  { rows, columns, widths, reserveHeight = true, class: className }: SkeletonTableProps,
) {
  const geometry = tableGeometry({ rows, columns, widths })
  const showRows = geometry.cells > 0
  const track = { gridTemplateColumns: geometry.gridTemplateColumns }

  return (
    <div
      class={cn(tableBox, reserveHeight && tableMinHeight, className)}
      aria-hidden="true"
      data-skeleton-table="true"
      data-skeleton-rows={geometry.rows}
      data-skeleton-columns={geometry.columns}
      data-skeleton-cells={geometry.cells}
    >
      {showRows && (
        <div
          class={cn(tableHeaderRow, "grid py-3", tableCell)}
          style={track}
          data-skeleton-row="header"
        >
          {geometry.columnWidths.map((column) => (
            <div key={column.index} data-skeleton-cell={column.index} data-width={column.percent}>
              <div
                class={cn(bar, "w-full")}
                style={{ height: `${tableHeaderHeightRem() / 2}rem` }}
              />
            </div>
          ))}
        </div>
      )}
      {showRows &&
        Array.from({ length: geometry.rows }, (_, row) => (
          <div
            key={row}
            class={cn(tableBodyRow, "grid", tableCell)}
            style={{ ...track, height: `${geometry.rowHeightRem}rem` }}
            data-skeleton-row={row}
          >
            {geometry.columnWidths.map((column) => (
              <div
                key={column.index}
                data-skeleton-cell={column.index}
                data-width={column.percent}
              >
                <div
                  class={cn(bar, "w-full")}
                  style={{ height: `${geometry.rowHeightRem / 2}rem` }}
                />
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}

/**
 * Card-grid placeholder: `columns` × `rows` card-shaped boxes, each with `lines` text bars.
 *
 * The grid utilities are the ones a card grid is written with and every box carries the real
 * `Card`'s surface utilities, so a grid of these is the box-for-box shape of the cards that replace
 * them. The column count stays a prop: the shipped utilities only express two and three columns, and
 * a component that hardcoded `lg:grid-cols-3` would be wrong for a caller using either of the other
 * two — or four.
 *
 * `columns * rows` cards and `columns * rows * lines` bars are the counts a test can assert, and both
 * come from the props rather than from a number written into the markup.
 */
export function SkeletonCards(
  { columns = 3, rows = 1, lines = 2, class: className }: SkeletonCardsProps,
) {
  const columnCount = skeletonCount(columns, 3)
  const total = columnCount * skeletonCount(rows, 1)

  return (
    <div
      class={cn(cardGrid, className)}
      aria-hidden="true"
      data-skeleton-cards={total}
      data-skeleton-columns={columnCount}
    >
      {Array.from(
        { length: total },
        (_, index) => (
          <div key={index} class={cardSurface} data-skeleton-card={index}>
            <SkeletonText lines={skeletonCount(lines, 2)} />
          </div>
        ),
      )}
    </div>
  )
}

/**
 * The live region that carries a loading announcement for the skeletons in this module.
 *
 * The skeletons are `aria-hidden`, so they announce nothing — and a component that is silent without
 * offering an announcement leaves every caller to reinvent one, which is the duplication this module
 * exists to remove. This is that announcement, as an explicit sibling rather than a prop on each
 * variant: one instance can cover a table, a card grid and a paragraph that load together, and the
 * caller keeps ownership of the copy and of where the region sits in reading order.
 *
 * `role="status"` with an explicit `aria-live="polite"`: the role already implies politeness, and the
 * attribute is what older screen readers honour. No `aria-atomic` — the text is a whole sentence
 * rather than a partial update. The text is `sr-only`, so a caller that also renders a visible
 * spinner or caption does not get the sentence twice on screen.
 *
 * A blank or absent `label` renders `null`: an empty live region announces nothing while still
 * costing a node, and a caller that drops `label` when loading ends gets the region out of the way
 * without a second boolean.
 */
export function SkeletonStatus({ label, class: className }: SkeletonStatusProps) {
  const text = label?.trim()
  if (!text) return null

  return (
    <span
      class={cn("sr-only", className)}
      role={skeletonStatusRole()}
      aria-live="polite"
      data-skeleton-status="true"
    >
      {text}
    </span>
  )
}
