import { IconEllipsisVertical, IconPlus, IconSearch } from "@preact-components/icons"
import { cn } from "@preact-components/cn"
import { Badge } from "@preact-components/ui/badge"
import { Dropdown, DropdownItem } from "@preact-components/ui/dropdown"
import { ErrorState } from "@preact-components/ui/error-state"
import { PageTitle } from "@preact-components/ui/page-title"
import { Table } from "@preact-components/ui/table"
import { type ReadonlySignal, type Signal, useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId } from "preact/hooks"
import { filterRows } from "./search.ts"
import type { CrudListStore } from "./store.ts"
import type { CrudModel, CrudStatus, StoreErrorLike } from "./types.ts"

/** Debounce of the search box, in milliseconds. Matches the delay the source lists used. */
const defaultSearchDelay = 300

/**
 * Where a list reads its rows.
 *
 * A model store gives the Active/Archived split, the count badge and the load error. A plain signal
 * is what a nested list scoped to a parent reads, and what a read-only collection with no
 * soft-delete column exposes; the status filter is then off and the error arrives as a prop.
 */
export type CrudListSource<M extends CrudModel> =
  | { store: CrudListStore<M> }
  | { rows: ReadonlySignal<M[]>; error?: ReadonlySignal<StoreErrorLike | null> }

/**
 * What every CRUD list needs, whatever it is listing.
 *
 * The two slots that matter are `row` and `actions`: the table's cells come from the caller, so a
 * list with a lamp's running hours, a status switch or a reset button in a row is the same
 * component as one with a single name column.
 */
export interface CrudListBaseProps<M extends CrudModel> {
  /** Page title text. */
  title: string
  /** Replaces the default `<span>{title}</span>` — for a back button, or the parent entity. */
  titleSlot?: ComponentChildren
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

/**
 * Listed collection: title, count, search, status filter, an add action and a table.
 *
 * Rows come from a store or from a signal, the cells come from the caller, and the search term and
 * status live in signals the caller may take over. Nothing here knows which entity it is showing.
 */
export function CrudList<M extends CrudModel>(props: CrudListProps<M>): JSX.Element {
  // Both hooks run on every render, whether or not the caller supplied a signal, so the hook order
  // stays stable.
  const ownQuery = useSignal("")
  const ownStatus = useSignal<CrudStatus>("active")
  const query = props.query ?? ownQuery
  const status = props.status ?? ownStatus

  const showStatus = props.statusFilter !== false && "store" in props
  const effectiveStatus: CrudStatus = showStatus ? status.value : "active"

  const rows = "store" in props
    ? listRows(props.store, effectiveStatus, query.value, props.match)
    : filterRows(props.rows.value, query.value, props.match)
  const count = "store" in props
    ? props.store.list.nonDeleted.value.length
    : props.rows.value.length
  const error = "store" in props ? props.store.op.list.value.error : props.error?.value ?? null

  const canAdd = props.canAdd?.() ?? true
  const showAdd = props.addHref !== undefined && canAdd

  return (
    <div class={cn("page-layout", props.class)}>
      <PageTitle>
        {props.titleSlot ?? <span>{props.title}</span>}
        {props.badge !== false &&
          (props.badge ?? <Badge color="gray" class="translate-y-0.5" text={String(count)} />)}
      </PageTitle>

      <ErrorState message={error?.message ?? null} class="mx-0 my-4 max-w-none text-left" />

      <div class="flex gap-2 items-center mb-4 md:mb-6">
        <SearchBox value={query} placeholder={props.searchPlaceholder} delay={props.searchDelay} />
        {showStatus && <StatusSelect status={status} labels={props.statusFilter} />}
        {showAdd && (
          <div class="ml-auto">
            <a href={props.addHref} class="btn btn-primary">
              <IconPlus class="size-5 -ml-1 hidden md:block" />
              {props.addLabel ?? "Add new"}
            </a>
          </div>
        )}
      </div>

      <Table
        headerSlot={
          <>
            {props.header}
            {props.actions !== undefined && (
              <th class="text-right" scope="col">{props.actionsLabel ?? "Actions"}</th>
            )}
          </>
        }
        bodySlots={rows.map((row) => (
          <>
            {props.row(row)}
            {props.actions !== undefined && (
              <td class="text-right whitespace-nowrap">{props.actions(row)}</td>
            )}
          </>
        ))}
      />
    </div>
  )
}

/**
 * Debounced search box.
 *
 * The input is bound to a draft signal, so a keystroke is never swallowed by the debounce, and the
 * settled term is copied into `value` once typing pauses. Binding the input's `value` to the
 * debounced signal instead is what dropped a typed term in one of the source lists.
 */
function SearchBox(
  { value, placeholder, delay }: {
    value: Signal<string>
    placeholder?: string
    delay?: number
  },
) {
  const draft = useSignal(value.value)

  useEffect(() => {
    const timer = setTimeout(() => {
      value.value = draft.value.trim()
    }, delay ?? defaultSearchDelay)
    return () => clearTimeout(timer)
  }, [draft.value])

  return (
    <form
      class="w-full max-w-xs relative flex gap-2 items-center"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        type="text"
        placeholder={placeholder ?? "Search"}
        class="input pr-11"
        value={draft.value}
        onInput={(event) => draft.value = event.currentTarget.value}
      />
      <div class="absolute right-1.5">
        <button class="btn-input-icon" type="button" title="Search">
          <IconSearch class="size-4" />
        </button>
      </div>
    </form>
  )
}

/** Active/Archived select, bound to the status signal the caller owns. */
function StatusSelect(
  { status, labels }: { status: Signal<CrudStatus>; labels?: false | StatusFilterLabels },
) {
  const id = useId()
  const wording = labels === undefined || labels === false ? {} : labels
  return (
    <div class="-mt-7">
      <label class="label" for={id}>{wording.label ?? "Status"}</label>
      <div>
        <select
          id={id}
          class="input mt-2"
          value={status.value}
          // The two options below are the only values this select can report.
          onChange={(event) => status.value = event.currentTarget.value as CrudStatus}
        >
          <option value="active">{wording.active ?? "Active"}</option>
          <option value="archived">{wording.archived ?? "Archived"}</option>
        </select>
      </div>
    </div>
  )
}

export interface RowActionProps {
  /** Target of the action. A menu item is a link when this is set, a button otherwise. */
  href?: string
  onClick?: () => void
  /** Renders the item in red. */
  danger?: boolean
  disabled?: boolean
  children: ComponentChildren
}

/**
 * One item of a {@link RowActions} menu.
 *
 * The element itself is a `DropdownItem`, so it carries `role="menuitem"` and the arrow keys of
 * the menu around it can reach it. The spacing row it sits in is `role="none"`, which keeps it a
 * direct child of the menu as far as assistive tech is concerned.
 */
export function RowAction(
  { href, onClick, danger, disabled, children }: RowActionProps,
): JSX.Element {
  return (
    <div class="py-1" role="none">
      <DropdownItem
        href={href}
        onClick={onClick}
        disabled={disabled}
        class={cn(danger && "text-red-600 dark:text-red-400")}
      >
        {children}
      </DropdownItem>
    </div>
  )
}

/** The per-row actions menu: a vertical ellipsis trigger over {@link RowAction} items. */
export function RowActions(
  { children, label }: { children: ComponentChildren; label?: string },
): JSX.Element {
  return (
    <Dropdown
      trigger={<IconEllipsisVertical />}
      triggerLabel={label ?? "Actions"}
      menuLabel={label ?? "Actions"}
    >
      <div class="divide-y divide-gray-100 dark:divide-gray-600" role="none">{children}</div>
    </Dropdown>
  )
}
