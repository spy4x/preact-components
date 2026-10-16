import { IconPlus, IconSearch } from "@spy4x/preact-icons"
import { cn } from "@spy4x/preact-cn"
import { Badge } from "@spy4x/preact-ui/badge"
import { EmptyState } from "@spy4x/preact-ui/empty-state"
import { ErrorState } from "@spy4x/preact-ui/error-state"
import { PageTitle, type PageTitleProps } from "@spy4x/preact-ui/page-title"
import { Pagination, type PaginationProps } from "@spy4x/preact-ui/pagination"
import { Stack } from "@spy4x/preact-ui/layout"
import { Table } from "@spy4x/preact-ui/table"
import { batch, effect, type ReadonlySignal, type Signal, useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId } from "preact/hooks"
import { filterRows } from "@spy4x/platform/universal/text"
import type { CrudListStore } from "./store.ts"
import type { CrudModel, CrudStatus, StoreErrorLike } from "./types.ts"

/** Debounce of the search box, in milliseconds. Matches the delay the source lists used. */
const defaultSearchDelay = 300

/**
 * Where a list reads its rows.
 *
 * A model store gives the Active/Archived split, the count badge, the load error and whether the
 * collection has loaded. A plain signal is what a nested list scoped to a parent reads, and what a
 * read-only collection with no soft-delete column exposes; the status filter is then off, and the
 * error and the loading flag arrive as props.
 */
export type CrudListSource<M extends CrudModel> =
  | { store: CrudListStore<M> }
  | {
    rows: ReadonlySignal<M[]>
    error?: ReadonlySignal<StoreErrorLike | null>
    /**
     * True while the rows are still on their way. The list then keeps its table and holds the
     * empty state back, since "nothing here" is not known yet. Omit it for rows that are there
     * from the first render.
     */
    loading?: ReadonlySignal<boolean>
  }

/**
 * What every CRUD list needs, whatever it is listing.
 *
 * The two slots that matter are `row` and `actions`: the table's cells come from the caller, so a
 * list with a running-hours counter, a status switch or a reset button in a row is the same
 * component as one with a single name column.
 */
export interface CrudListBaseProps<M extends CrudModel> {
  /** Page title text. */
  title: string
  /** Replaces the default `<span>{title}</span>` — for a back button, or the parent entity. */
  titleSlot?: ComponentChildren
  /**
   * Level of the title's heading, `<h1>` to `<h6>`. Defaults to `1`. Pick another when the page
   * already has its `<h1>`, such as a list nested under a parent's page; the look stays the same.
   */
  headingLevel?: PageTitleProps["headingLevel"]
  /** Badge after the title. Defaults to the non-deleted row count; `false` hides it. */
  badge?: ComponentChildren | false
  /** Whether one search word matches a row. Words are ANDed; an empty query matches every row. */
  match: (row: M, word: string) => boolean
  /** Header cells of the table, excluding the actions column. */
  header: ComponentChildren
  /** Cells of one body row, excluding the actions cell. */
  row: (row: M) => ComponentChildren
  /** Right-aligned actions cell of one body row. Omit for a table with no actions column. */
  actions?: (row: M) => ComponentChildren
  /** Header text of the actions column. Defaults to `"Actions"`. */
  actionsLabel?: string
  /** Where the add action points. Omit to hide it. */
  addHref?: string
  /** Label of the add action. Defaults to `"Add new"`. */
  addLabel?: string
  /** Whether the current user may add. Defaults to `true`. */
  canAdd?: () => boolean
  searchPlaceholder?: string
  /**
   * Accessible name of the search field. Defaults to the placeholder, which is `"Search"` unless
   * `searchPlaceholder` replaces it.
   */
  searchFieldLabel?: string
  /** Name of the Search button, for a screen reader and the tooltip. Defaults to `"Search"`. */
  searchLabel?: string
  /** Debounce of the search box, in milliseconds. Defaults to `300`. */
  searchDelay?: number
  /** External search term, so a URL filter can own it. Defaults to a signal local to the list. */
  query?: Signal<string>
  /** External status, so a URL filter can own it. Ignored when `statusFilter` is `false`. */
  status?: Signal<CrudStatus>
  /**
   * The Active/Archived select. `false` hides it — a nested list scoped to a parent has nothing to
   * filter, and a read-only collection has no archived slice. The names are configurable because
   * "Archived" is not every app's word for it (a user is *banned*).
   */
  statusFilter?: false | StatusFilterLabels
  /**
   * How many rows one page shows. Omit it and every row is rendered, as before; with it, the rows
   * the search and the status filter leave are cut into pages and the library's `Pagination` sits
   * under the table once there is more than one page.
   */
  pageSize?: number
  /**
   * External page number, `1`-based, so a URL filter can own it. Defaults to a signal local to the
   * list. Ignored without `pageSize`.
   *
   * The list writes it in two cases only: a press on the pager, and its own search box or status
   * select, which go back to page 1 in the same write as the new term or status. A `query` or
   * `status` changed from outside (an address that carries both a search and a page, Back, a
   * reload) leaves it alone. A number past the last page shows the last page and is not written
   * back, so the signal keeps the number it was given.
   */
  page?: Signal<number>
  /** Wording of the pager: the names `Pagination` takes, each with its English default. */
  paginationLabels?: Pick<PaginationProps, "label" | "previousLabel" | "nextLabel" | "pageLabel">
  /** Headline shown in place of the table when the list has no row. Defaults to `"Nothing here yet"`. */
  emptyTitle?: string
  /** Second line under `emptyTitle`, usually what to do about it. Defaults to none. */
  emptyDescription?: string
  /**
   * Headline shown in place of the table when the search leaves no row. Defaults to
   * `"Nothing matches your search"`.
   */
  noMatchTitle?: string
  /** Second line under `noMatchTitle`. Defaults to none. */
  noMatchDescription?: string
  class?: string
}

/** Wording of the status select. */
export interface StatusFilterLabels {
  /** Legend above the select. Defaults to `"Status"`. */
  label?: string
  /** Option for the non-deleted rows. Defaults to `"Active"`. */
  active?: string
  /** Option for the soft-deleted rows. Defaults to `"Archived"`. */
  archived?: string
}

/** {@link CrudListBaseProps} plus one of the two row sources. */
export type CrudListProps<M extends CrudModel> = CrudListBaseProps<M> & CrudListSource<M>

/** The status slice of a store's collection. */
export function rowsForStatus<M extends CrudModel>(
  store: CrudListStore<M>,
  status: CrudStatus,
): M[] {
  return status === "archived" ? store.list.deleted.value : store.list.nonDeleted.value
}

/**
 * The rows a store-backed list renders: the status slice, filtered by the search term.
 *
 * Split out of the component so the status switch and the filter are testable without a DOM.
 */
export function listRows<M extends CrudModel>(
  store: CrudListStore<M>,
  status: CrudStatus,
  query: string,
  match: (row: M, word: string) => boolean,
): M[] {
  return filterRows(rowsForStatus(store, status), query, match)
}

/** One page of a list: its rows, its number and how many pages there are. */
export interface ListPage<M> {
  /** The rows of this page. */
  rows: M[]
  /** The page shown, `1`-based: the page asked for, brought into `1…pageCount`. */
  page: number
  /** How many pages the rows fill; `1` for an empty list. */
  pageCount: number
}

/**
 * Cut one page out of a list's rows.
 *
 * The page asked for is brought into range rather than trusted, because it outlives the rows it
 * was chosen for: a search or a removal can leave fewer pages than the one the person was on, and
 * they then see the last page instead of an empty table. A `pageSize` below one shows one row.
 */
export function pageOf<M>(rows: M[], page: number, pageSize: number): ListPage<M> {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.max(1, Math.min(pageCount, Math.round(page) || 1))
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pageCount }
}

/**
 * Whether a store's collection has loaded: its load settled with a result, or it already holds a
 * row.
 *
 * `inProgress` alone does not say so. A store that fills its collection from a pushed list, as
 * `buildModelStore` does, never sets it, and before the first rows arrive its `op.list` is the
 * same `{ inProgress: false, error: null }` as after an empty answer; only `result` tells the two
 * apart. A row held with no settled load (one created before any list arrived) counts as loaded
 * too, so a search over those rows can still say that nothing matches.
 */
function hasLoaded<M extends CrudModel>(store: CrudListStore<M>): boolean {
  const load = store.op.list.value
  if (load.inProgress) return false
  return (load.result !== null && load.result !== undefined) ||
    store.list.nonDeleted.value.length > 0 || store.list.deleted.value.length > 0
}

/**
 * Listed collection: title, count, search, status filter, an add action and a table.
 *
 * Rows come from a store or from a signal, the cells come from the caller, and the search term and
 * status live in signals the caller may take over. Nothing here knows which entity it is showing.
 *
 * A list with no row to show renders the library's `EmptyState` in place of the table, worded for
 * an empty collection or for a search that matched nothing. It is held back until the collection
 * has loaded ({@link hasLoaded}, or the signal source's `loading`) and when the load failed, where
 * "nothing here" would be false. With `pageSize` the
 * rows are paged by the library's `Pagination`.
 */
export function CrudList<M extends CrudModel>(props: CrudListProps<M>): JSX.Element {
  // Both hooks run on every render, whether or not the caller supplied a signal, so the hook order
  // stays stable.
  const ownQuery = useSignal("")
  const ownStatus = useSignal<CrudStatus>("active")
  const ownPage = useSignal(1)
  const query = props.query ?? ownQuery
  const status = props.status ?? ownStatus
  const page = props.page ?? ownPage

  const showStatus = props.statusFilter !== false && "store" in props
  const effectiveStatus: CrudStatus = showStatus ? status.value : "active"

  const rows = "store" in props
    ? listRows(props.store, effectiveStatus, query.value, props.match)
    : filterRows(props.rows.value, query.value, props.match)
  const count = "store" in props
    ? props.store.list.nonDeleted.value.length
    : props.rows.value.length
  const error = "store" in props ? props.store.op.list.value.error : props.error?.value ?? null
  const loaded = "store" in props ? hasLoaded(props.store) : props.loading?.value !== true

  // The list's own search and status changes go back to page 1, in the same write as the change:
  // the page number belonged to the old rows. A change from outside (the address, Back) is not
  // the list's to answer, or it would overwrite the page that address names.
  const paged = props.pageSize !== undefined
  const toFirstPage = () => {
    if (paged) page.value = 1
  }

  const shown = props.pageSize === undefined
    ? { rows, page: 1, pageCount: 1 }
    : pageOf(rows, page.value, props.pageSize)
  const showEmpty = rows.length === 0 && error === null && loaded
  const searching = query.value.trim() !== ""
  // One level under the title, down to the deepest `EmptyState` draws. Under a title at level 4
  // or deeper it stays at 4 and so sits at or above its title: `headingLevel` 5 and 6 are for a
  // list nested that deep, where no level is left for it.
  const emptyHeadingLevel = Math.min((props.headingLevel ?? 1) + 1, 4) as 2 | 3 | 4

  const canAdd = props.canAdd?.() ?? true
  const showAdd = props.addHref !== undefined && canAdd

  return (
    <Stack gap="lg" class={cn("mx-auto max-w-6xl", props.class)}>
      <PageTitle headingLevel={props.headingLevel}>
        {props.titleSlot ?? <span>{props.title}</span>}
        {props.badge !== false &&
          (props.badge ?? <Badge color="gray" class="translate-y-0.5" text={String(count)} />)}
      </PageTitle>

      <ErrorState message={error?.message ?? null} class="mx-0 max-w-none text-left" />

      <div class="flex gap-2 items-center">
        <SearchBox
          value={query}
          placeholder={props.searchPlaceholder}
          fieldLabel={props.searchFieldLabel}
          label={props.searchLabel}
          delay={props.searchDelay}
          onChange={toFirstPage}
        />
        {showStatus && (
          <StatusSelect status={status} labels={props.statusFilter} onChange={toFirstPage} />
        )}
        {showAdd && (
          <div class="ml-auto">
            <a href={props.addHref} class="btn btn-primary">
              <IconPlus class="size-5 -ml-1 hidden md:block" />
              {props.addLabel ?? "Add new"}
            </a>
          </div>
        )}
      </div>

      {showEmpty
        ? (
          <EmptyState
            title={searching
              ? props.noMatchTitle ?? "Nothing matches your search"
              : props.emptyTitle ?? "Nothing here yet"}
            description={searching ? props.noMatchDescription : props.emptyDescription}
            headingLevel={emptyHeadingLevel}
            class="max-w-none"
          />
        )
        : (
          <Table
            headerSlot={
              <>
                {props.header}
                {props.actions !== undefined && (
                  <th class="text-right" scope="col">{props.actionsLabel ?? "Actions"}</th>
                )}
              </>
            }
            // Keyed by id, so a page turn or a search moves a row's own state (an open menu, a
            // typed draft) with the row instead of handing it to the row that takes its place.
            bodyKeys={shown.rows.map((row) => row.id)}
            bodySlots={shown.rows.map((row) => (
              <>
                {props.row(row)}
                {props.actions !== undefined && (
                  <td class="text-right whitespace-nowrap">{props.actions(row)}</td>
                )}
              </>
            ))}
          />
        )}

      {shown.pageCount > 1 && (
        <Pagination
          {...props.paginationLabels}
          page={shown.page}
          pageCount={shown.pageCount}
          onChange={(next) => page.value = next}
        />
      )}
    </Stack>
  )
}

/**
 * Debounced search box.
 *
 * The input is bound to a draft signal, so a keystroke is never swallowed by the debounce, and the
 * settled term is copied into `value` once typing pauses. Binding the input's `value` to the
 * debounced signal instead is what dropped a typed term in one of the source lists.
 *
 * The magnifier is the form's submit button, so a click on it and Enter in the field both search
 * now instead of waiting for the pause.
 *
 * The draft follows `value` when something else changes it, such as Back restoring an earlier
 * search from the address: without that the field would keep the term the rows no longer show.
 * A change that only trims what was typed is the box's own commit and leaves the draft alone.
 *
 * `onChange` runs inside the same `batch` as a commit that changes the term, and never for a
 * commit that leaves it as it was (the typing pause after the address set it), so what it writes
 * lands as one change with the term.
 */
function SearchBox(
  { value, placeholder, fieldLabel, label, delay, onChange }: {
    value: Signal<string>
    placeholder?: string
    fieldLabel?: string
    label?: string
    delay?: number
    onChange: () => void
  },
) {
  const draft = useSignal(value.value)
  const commit = () => {
    const term = draft.value.trim()
    if (term === value.peek()) return
    batch(() => {
      value.value = term
      onChange()
    })
  }

  useEffect(() => {
    const timer = setTimeout(commit, delay ?? defaultSearchDelay)
    return () => clearTimeout(timer)
  }, [draft.value])

  // A signal effect, so the draft follows in the same task as the write. A render effect waits for
  // the next paint, and what happened in between was lost: the late effect put the old term back
  // into a field the person had just typed in, or the typing pause committed the old draft over a
  // term set from outside. Keyed on the signal, so a caller that hands over another one is followed.
  useEffect(() =>
    effect(() => {
      const settled = value.value
      if (settled !== draft.peek().trim()) draft.value = settled
    }), [value])

  return (
    <form
      class="w-full max-w-xs relative flex gap-2 items-center"
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <input
        type="text"
        placeholder={placeholder ?? "Search"}
        aria-label={fieldLabel ?? placeholder ?? "Search"}
        class="pc-input pr-12"
        value={draft.value}
        onInput={(event) => draft.value = event.currentTarget.value}
      />
      <div class="absolute right-1.5">
        <button class="btn-input-icon" type="submit" title={label ?? "Search"}>
          <IconSearch class="size-4" />
        </button>
      </div>
    </form>
  )
}

/**
 * Active/Archived select, bound to the status signal the caller owns. `onChange` runs in the same
 * `batch` as the new status.
 */
function StatusSelect(
  { status, labels, onChange }: {
    status: Signal<CrudStatus>
    labels?: false | StatusFilterLabels
    onChange: () => void
  },
) {
  const id = useId()
  const wording = labels === undefined || labels === false ? {} : labels
  return (
    <div class="-mt-6">
      <label class="pc-label" for={id}>{wording.label ?? "Status"}</label>
      <div>
        <select
          id={id}
          class="pc-input mt-1"
          value={status.value}
          // The two options below are the only values this select can report.
          onChange={(event) => {
            const next = event.currentTarget.value as CrudStatus
            batch(() => {
              status.value = next
              onChange()
            })
          }}
        >
          <option value="active">{wording.active ?? "Active"}</option>
          <option value="archived">{wording.archived ?? "Archived"}</option>
        </select>
      </div>
    </div>
  )
}
