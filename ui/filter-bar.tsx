import { cn } from "@spy4x/preact-cn"
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconSearch,
  IconXMark,
} from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { badgeClasses } from "./badge.tsx"
import { Dropdown, DropdownItem } from "./dropdown.tsx"
import { HotkeyHint } from "./hotkey-hint.tsx"
import { ariaKeyShortcuts, useApplePlatform } from "./hotkeys.ts"
import type { KbdLabels } from "./kbd-keys.tsx"
import { ToggleChips, toggleChipSelection } from "./toggle-chips.tsx"
import { translate, useLabels, useT } from "./i18n.tsx"

/** One choice of a {@link FilterBarMenu}. */
export interface FilterBarOption {
  /** What the menu's `value` and `onChange` carry for this choice. Unique within the menu. */
  value: string
  /** The choice's visible text, also used in the trigger and the chip. */
  label: string
  /** How many rows this choice would show, drawn muted at the item's right edge. */
  count?: number
}

interface FilterBarMenuBase {
  /** Unique within the bar. */
  id: string
  /** The trigger's text with nothing chosen, and the menu's name, such as `"Tags"`. */
  label: string
  /** What a chip says before the choice, such as `"Tag"` in "Tag: Design". Defaults to `label`. */
  chipLabel?: string
  options: FilterBarOption[]
  /**
   * The trigger's text while something is chosen. Defaults to {@link filterTriggerLabel}:
   * "Tags: Design" for one choice, "Tags: 3" for several.
   */
  activeLabel?: (chosen: FilterBarOption[]) => string
  /**
   * Drawn at the top of the menu, above the choices and a divider, such as an "Any of these tags /
   * All of these tags" switch. Pass `DropdownItem`s with `checked` and `keepOpen` inside a
   * `<div role="group" aria-label="…">`, so the arrow keys reach them and the menu stays open.
   * With `headerLabel`, pass the items alone: the bar wraps them in that group itself.
   */
  header?: ComponentChildren
  /**
   * A visible heading over `header`, such as `"Show notes with"`, which also names the group the
   * bar then wraps `header` in.
   */
  headerLabel?: string
}

/** A menu where any number of choices can be on, drawn as boxes; the menu stays open on a choice. */
export interface FilterBarMultipleMenu extends FilterBarMenuBase {
  multiple: true
  /** The chosen values, in the order of `options`. */
  value: string[]
  onChange: (value: string[]) => void
}

/** A menu with at most one choice; choosing closes the menu. */
export interface FilterBarSingleMenu extends FilterBarMenuBase {
  multiple?: false
  /** The chosen value, or `null` for no filter. */
  value: string | null
  onChange: (value: string | null) => void
  /** Text of a first item that clears the filter, such as `"Anyone"`. Left out, there is none. */
  anyLabel?: string
}

/** One filter menu of a {@link FilterBar}: one shape per `multiple`. */
export type FilterBarMenu = FilterBarMultipleMenu | FilterBarSingleMenu

/** A one-tap filter of a {@link FilterBar}, such as "Created by me". */
export interface FilterBarToggle {
  /** Unique within the bar. */
  id: string
  /** The chip's text, and its chip's while pressed. */
  label: string
  pressed: boolean
  onChange: (pressed: boolean) => void
}

/** The search field of a {@link FilterBar}. */
export interface FilterBarSearch {
  value: string
  /** Called with the field's whole text on every keystroke, and with `""` by the clear button. */
  onChange: (value: string) => void
  /** The field's accessible name. Defaults to `"Search"`. */
  label?: string
  /** Defaults to `label`. */
  placeholder?: string
  /**
   * A key the app already binds to focus the field, such as `"/"`. The field shows it while empty
   * (on a device with a fine pointer) and announces it in `aria-keyshortcuts`; it binds nothing.
   */
  hotkeyHint?: string
  /** The words the hint's keys show. */
  kbdLabels?: Partial<KbdLabels>
  /** Name of the clear button. Defaults to `"Clear search"`. */
  clearLabel?: string
}

/** The sort menu of a {@link FilterBar}. */
export interface FilterBarSort {
  /** Shown before the current order from `sm` up, and part of the trigger's name. Defaults to `"Sort by"`. */
  label?: string
  options: FilterBarSortOption[]
  value: string
  onChange: (value: string) => void
  /** Which way the list runs. With `onDirectionChange`, an option with `directions` gets an Order group. */
  direction?: SortDirection
  onDirectionChange?: (direction: SortDirection) => void
}

/** Which way a sorted list runs: ascending or descending. */
export type SortDirection = `asc` | `desc`

/** One order of a {@link FilterBarSort}. */
export interface FilterBarSortOption {
  value: string
  label: string
  /** The words of each direction for this order, such as "Newest first" and "Oldest first". */
  directions?: Record<SortDirection, string>
}

/** One active filter, drawn as a removable chip under the bar. */
export interface FilterBarChip {
  /** Unique within the bar: the menu or toggle id, and the value for a menu. */
  key: string
  /** The chip's text, such as "Tag: Design". */
  label: string
  /** The chosen thing alone, such as "Design": what the remove button's name says. */
  valueLabel: string
  /** Takes this one filter away, through its menu's or toggle's `onChange`. */
  remove: () => void
}

/** Props of {@link FilterBar}. */
export interface FilterBarProps {
  search?: FilterBarSearch
  /** One menu button each, in this order, after the search field. */
  filters?: FilterBarMenu[]
  /** One pressable chip each, after the menus. */
  toggles?: FilterBarToggle[]
  /** A menu at the end of the row, pushed right from `sm` up. */
  sort?: FilterBarSort
  /** The muted result count, such as "42 notes", at the end of the chips row; announced politely. */
  count?: ComponentChildren
  /**
   * Clears every filter at once, for "Clear filters": the `clearFilters` of a `useUrlFilters` that
   * holds only the filters, say, which makes it one history entry. Left out, each menu and toggle
   * with a value gets its own `onChange`. Search and sort are not filters, so the default leaves
   * them as they are.
   */
  onClear?: () => void
  /** Name of the bar, a `search` landmark. Defaults to `"Search and filters"`. */
  label?: string
  /** Name of the toggles' group. Defaults to `"Quick filters"`. */
  togglesLabel?: string
  /** Name of the list of chips. Defaults to `"Active filters"`. */
  chipsLabel?: string
  /** Text of the item that closes a `multiple` menu's sheet on a phone. Defaults to `"Done"`. */
  doneLabel?: string
  /** Text of the button that clears every filter. Defaults to `"Clear filters"`. */
  clearLabel?: string
  /** Name of a chip's remove button. Defaults to `"Remove the Design filter"`. */
  removeLabel?: (chip: FilterBarChip) => string
  class?: string
}

/**
 * The chosen options of a menu, in the order of its `options`.
 *
 * @param menu The menu.
 * @returns Its chosen options; a value no option carries is skipped.
 */
function chosenOptions(menu: FilterBarMenu): FilterBarOption[] {
  const values = menu.multiple ? menu.value : menu.value === null ? [] : [menu.value]
  return menu.options.filter((option) => values.includes(option.value))
}

/**
 * A filter menu's trigger text: its `label` with nothing chosen, "Tags: Design" with one choice,
 * and "Tags: 3" with several. A menu's own `activeLabel` replaces the last two.
 *
 * @param menu The menu.
 * @returns The trigger's visible text, which is also its accessible name.
 */
export function filterTriggerLabel(menu: FilterBarMenu): string {
  const chosen = chosenOptions(menu)
  if (chosen.length === 0) return menu.label
  if (menu.activeLabel) return menu.activeLabel(chosen)
  return chosen.length === 1
    ? `${menu.label}: ${chosen[0].label}`
    : `${menu.label}: ${chosen.length}`
}

/**
 * Every active filter as a chip: one per chosen option of each menu, in menu order, then one per
 * pressed toggle. Removing a chip calls its menu's `onChange` without that value (or with `null`),
 * or its toggle's with `false`.
 *
 * @param filters The bar's menus.
 * @param toggles The bar's toggles.
 * @returns The chips, in the order they are drawn.
 */
export function activeFilterChips(
  filters: readonly FilterBarMenu[],
  toggles: readonly FilterBarToggle[],
): FilterBarChip[] {
  const chips: FilterBarChip[] = []
  for (const menu of filters) {
    const prefix = menu.chipLabel ?? menu.label
    for (const option of chosenOptions(menu)) {
      chips.push({
        key: `${menu.id}:${option.value}`,
        label: `${prefix}: ${option.label}`,
        valueLabel: option.label,
        remove: menu.multiple
          ? () => menu.onChange(menu.value.filter((value) => value !== option.value))
          : () => menu.onChange(null),
      })
    }
  }
  for (const toggle of toggles) {
    if (!toggle.pressed) continue
    chips.push({
      key: toggle.id,
      label: toggle.label,
      valueLabel: toggle.label,
      remove: () => toggle.onChange(false),
    })
  }
  return chips
}

/**
 * Clears every menu and toggle that has a value, one `onChange` each.
 *
 * @param filters The bar's menus.
 * @param toggles The bar's toggles.
 */
function clearEach(filters: readonly FilterBarMenu[], toggles: readonly FilterBarToggle[]): void {
  for (const menu of filters) {
    if (menu.multiple) {
      if (menu.value.length > 0) menu.onChange([])
    } else if (menu.value !== null) menu.onChange(null)
  }
  for (const toggle of toggles) if (toggle.pressed) toggle.onChange(false)
}

/**
 * A chip-shaped trigger, the look of an unpressed `ToggleChips` chip: 44 px tall on a phone, 32 px
 * from `sm` up. An active menu takes the pressed chip's accent fill, so the row shows at a glance
 * which filters are on.
 */
const triggerBase =
  "normal-case shrink-0 gap-1 min-h-11 sm:min-h-8 px-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden"

/**
 * Trigger classes for a menu that is on or off.
 *
 * @param active Whether the menu has a choice.
 * @returns The trigger's class list.
 */
function triggerClasses(active: boolean): string {
  return active ? badgeClasses("purple", "filled", triggerBase) : badgeClasses(
    "gray",
    "outline",
    cn(triggerBase, "bg-surface text-foreground border-subtle hover:bg-hover"),
  )
}

/**
 * On a phone the controls row scrolls sideways, which would clip a panel hanging below it, so the
 * panel leaves the row: it is fixed to the bottom of the screen as a sheet, full width, with 44 px
 * rows (every button or link inside it, a `header`'s items included), and a shadow as wide as the screen dims the page behind it the way a dialog's scrim does.
 * The shadow takes no clicks, so a press on the dimmed page still reaches `Dropdown`'s outside-press
 * close. From `sm` up it is the ordinary dropdown under its trigger.
 */
const sheetPanel =
  "max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:z-50 max-sm:m-0 max-sm:max-h-[70dvh] max-sm:overflow-y-auto max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:pb-4 max-sm:shadow-[0_0_0_100vmax_var(--color-scrim)] max-sm:whitespace-normal max-sm:[&_button]:min-h-11 max-sm:[&_a]:min-h-11 sm:min-w-56"

/** The sheet's visible title, on a phone only: a sheet at the bottom has no trigger beside it. */
function SheetTitle({ children }: { children: string }): JSX.Element {
  return (
    <div aria-hidden="true" class="px-4 pt-4 pb-2 text-sm font-medium text-muted sm:hidden">
      {children}
    </div>
  )
}

/** The divider between a menu's header and its choices. */
const divider = <div role="separator" class="my-1 border-t border-subtle" />

/**
 * One filter menu: a chip trigger and a `Dropdown` of its choices, boxes when `multiple`. A
 * `multiple` menu ends with a Done item on a phone, where its sheet covers the bar and a reader
 * picking several needs an obvious way out; it is a plain item, so choosing it closes the menu.
 *
 * @param props.menu The menu.
 * @param props.doneLabel The Done item's text.
 */
function FilterMenuButton(
  { menu, doneLabel }: { menu: FilterBarMenu; doneLabel: string },
): JSX.Element {
  const headingId = useId()
  const chosen = chosenOptions(menu)
  const active = chosen.length > 0
  const isChosen = (value: string) => chosen.some((option) => option.value === value)
  const choose = (value: string) => {
    if (menu.multiple) {
      menu.onChange(toggleChipSelection(menu.options, menu.value, value))
    } else menu.onChange(value)
  }
  return (
    <Dropdown
      triggerNamedByContent
      trigger={
        <>
          {filterTriggerLabel(menu)}
          <IconChevronDown class="size-3.5" />
        </>
      }
      triggerClasses={triggerClasses(active)}
      triggerDataE2E={`filter-${menu.id}`}
      containerClasses="shrink-0"
      panelClasses={sheetPanel}
      horizontal="start"
      menuLabel={menu.label}
    >
      <SheetTitle>{menu.label}</SheetTitle>
      {menu.header !== undefined
        ? (
          <>
            {menu.headerLabel === undefined
              ? menu.header
              : (
                <div role="group" aria-labelledby={headingId}>
                  <div id={headingId} class="px-4 pt-2 pb-1 text-xs font-medium text-muted">
                    {menu.headerLabel}
                  </div>
                  {menu.header}
                </div>
              )}
            {divider}
          </>
        )
        : null}
      {!menu.multiple && menu.anyLabel !== undefined
        ? (
          <DropdownItem
            checked={menu.value === null}
            onClick={() => menu.onChange(null)}
          >
            {menu.anyLabel}
          </DropdownItem>
        )
        : null}
      {menu.options.map((option) => (
        <DropdownItem
          key={option.value}
          checked={isChosen(option.value)}
          multiple={menu.multiple === true}
          onClick={() => choose(option.value)}
        >
          <span class="min-w-0 flex-1 truncate">{option.label}</span>
          {option.count !== undefined
            ? <span class="ps-4 text-xs text-muted tabular-nums">{option.count}</span>
            : null}
        </DropdownItem>
      ))}
      {menu.multiple
        ? (
          <DropdownItem class="mt-2 justify-center border-t border-subtle font-medium text-foreground sm:hidden">
            {doneLabel}
          </DropdownItem>
        )
        : null}
    </Dropdown>
  )
}

/** A pending move of focus after a chip or every chip went: where, and how many chips there were. */
interface Refocus {
  /** The removed chip's index, or `-1` for "Clear filters". */
  index: number
  chips: number
}

/** The English words of `FilterBar`, each one a prop of its own. */
const FILTER_BAR_LABELS = {
  label: "Search and filters",
  togglesLabel: "Quick filters",
  chipsLabel: "Active filters",
  clearLabel: "Clear filters",
  doneLabel: "Done",
}

/**
 * Search, filter menus, one-tap toggles and a sort over a list, with the active filters as
 * removable chips under them and a result count.
 *
 * Pure and controlled: every value comes in as a prop and every change goes out through that
 * control's `onChange`, so the caller keeps them wherever it likes — in the URL with
 * `useUrlFilters` from `@spy4x/preact-signals`, for one.
 *
 * The bar is a `search` landmark. The search field is a labelled `type="search"` input with a
 * clear button that hands focus back to the field. Each menu is a `Dropdown` whose trigger is a
 * chip that names the choice ("Tags: Design"); a `multiple` menu draws boxes
 * (`menuitemcheckbox`) and stays open while the reader picks several. Toggles are `ToggleChips`.
 * Each chip's remove button takes one filter away and moves focus to the next chip, or to the
 * search field (else the first control) when it was the last; "Clear filters" does the same.
 *
 * From `sm` up the search field and every control share one row that wraps, search first. On a
 * phone the search field has its own row, the controls scroll sideways on theirs, and a menu opens
 * as a sheet fixed to the bottom of the screen, since a panel hanging from a scrolling row would be
 * clipped.
 */
export function FilterBar(props: FilterBarProps): JSX.Element {
  const {
    search,
    filters = [],
    toggles = [],
    sort,
    count,
    onClear,
    class: className,
  } = props
  const translator = useT()
  const { label, togglesLabel, chipsLabel, clearLabel, doneLabel } = useLabels(
    "FilterBar",
    FILTER_BAR_LABELS,
    props,
  )
  const removeLabel = props.removeLabel ??
    ((chip: FilterBarChip) =>
      translate(translator, "FilterBar.remove", `Remove the ${chip.valueLabel} filter`, {
        value: chip.valueLabel,
      }))
  const searchWord = translate(translator, "FilterBar.search", "Search")
  const sortWord = translate(translator, "FilterBar.sort", "Sort by")
  const orderWord = translate(translator, "FilterBar.order", "Order")
  const orderId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const refocus = useRef<Refocus | null>(null)
  const searchId = useId()
  const apple = useApplePlatform()
  const chips = activeFilterChips(filters, toggles)

  // After a chip went, focus the chip that took its place (or the one before it, when it was the
  // last), else the start of the bar. A removal the caller refused leaves the chips as they were,
  // and then nothing moves.
  useEffect(() => {
    const pending = refocus.current
    if (pending === null) return
    refocus.current = null
    const root = rootRef.current
    if (!root || chips.length >= pending.chips) return
    const removes = root.querySelectorAll<HTMLElement>("[data-filter-chip-remove]")
    const next = pending.index < 0
      ? undefined
      : removes[Math.min(pending.index, removes.length - 1)]
    const start = searchRef.current ??
      root.querySelector<HTMLElement>("[data-filter-controls] button")
    ;(next ?? start)?.focus()
  })

  const clearAll = () => {
    refocus.current = { index: -1, chips: chips.length }
    if (onClear) onClear()
    else clearEach(filters, toggles)
  }

  const searchLabel = search?.label ?? searchWord
  const searchField = search
    ? (
      <div class="relative w-full sm:w-64 sm:shrink-0">
        <label for={searchId} class="sr-only">{searchLabel}</label>
        <IconSearch class="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={search.value}
          placeholder={search.placeholder ?? searchLabel}
          autocomplete="off"
          aria-keyshortcuts={search.hotkeyHint === undefined
            ? undefined
            : ariaKeyShortcuts(search.hotkeyHint, apple)}
          onInput={(event) => search.onChange((event.currentTarget as HTMLInputElement).value)}
          class="pc-input h-11 pe-12 ps-8 text-sm sm:h-8 [&::-webkit-search-cancel-button]:appearance-none"
          data-e2e="filter-search"
        />
        {search.value !== ""
          ? (
            <button
              type="button"
              aria-label={search.clearLabel ??
                translate(translator, "FilterBar.clearSearch", "Clear search")}
              class="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-primary text-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus sm:w-8"
              onClick={() => {
                search.onChange("")
                searchRef.current?.focus()
              }}
            >
              <IconXMark class="size-4" />
            </button>
          )
          : search.hotkeyHint !== undefined
          ? (
            <HotkeyHint
              keys={search.hotkeyHint}
              apple={apple}
              labels={search.kbdLabels}
              class="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2"
            />
          )
          : null}
      </div>
    )
    : null

  const sortCurrent = sort?.options.find((option) => option.value === sort.value)
  // The Order group shows only for an order that names its directions, and a caller that listens.
  const directions = sort?.onDirectionChange && sort.direction ? sortCurrent?.directions : undefined
  // Every order keeps the menu open while any order has directions, so the group can follow.
  const sortDirections = sort?.onDirectionChange && sort.direction
    ? sort.options.some((option) => option.directions)
    : false
  const sortMenu = sort
    ? (
      <Dropdown
        triggerNamedByContent
        trigger={
          <>
            <span class="text-muted max-sm:sr-only">{sort.label ?? sortWord}</span>
            {sortCurrent?.label ?? sort.value}
            {directions && sort.direction
              ? (
                <>
                  {sort.direction === `asc`
                    ? <IconArrowUp class="size-3.5" aria-hidden="true" />
                    : <IconArrowDown class="size-3.5" aria-hidden="true" />}
                  <span class="sr-only">, {directions[sort.direction]}</span>
                </>
              )
              : null}
            <IconChevronDown class="size-3.5" />
          </>
        }
        triggerClasses={triggerClasses(false)}
        triggerDataE2E="filter-sort"
        containerClasses="shrink-0 sm:ms-auto"
        panelClasses={sheetPanel}
        horizontal="end"
        menuLabel={sort.label ?? sortWord}
      >
        <SheetTitle>{sort.label ?? sortWord}</SheetTitle>
        {sort.options.map((option) => (
          <DropdownItem
            key={option.value}
            checked={option.value === sort.value}
            keepOpen={sortDirections}
            onClick={() => sort.onChange(option.value)}
          >
            {option.label}
          </DropdownItem>
        ))}
        {directions
          ? (
            <>
              {divider}
              <div role="group" aria-labelledby={orderId}>
                <div id={orderId} class="px-4 pt-2 pb-1 text-xs font-medium text-muted">
                  {orderWord}
                </div>
                {([`asc`, `desc`] as const).map((direction) => (
                  <DropdownItem
                    key={direction}
                    checked={direction === sort.direction}
                    keepOpen
                    onClick={() => sort.onDirectionChange?.(direction)}
                  >
                    {directions[direction]}
                  </DropdownItem>
                ))}
              </div>
            </>
          )
          : null}
        {sortDirections
          ? (
            <DropdownItem class="mt-2 justify-center border-t border-subtle font-medium text-foreground sm:hidden">
              {doneLabel}
            </DropdownItem>
          )
          : null}
      </Dropdown>
    )
    : null

  const hasControls = filters.length > 0 || toggles.length > 0 || sort !== undefined
  const showFooter = chips.length > 0 || count !== undefined

  return (
    <div
      ref={rootRef}
      role="search"
      aria-label={label}
      class={cn("flex flex-col gap-3", className)}
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {searchField}
        {hasControls
          ? (
            <div
              data-filter-controls=""
              class="pc-scrollbar flex min-w-0 flex-1 items-center gap-2 p-1 sm:contents"
            >
              {filters.map((menu) => (
                <FilterMenuButton key={menu.id} menu={menu} doneLabel={doneLabel} />
              ))}
              {toggles.length > 0
                ? (
                  <ToggleChips
                    label={togglesLabel}
                    class="shrink-0 flex-nowrap"
                    options={toggles.map((toggle) => ({ value: toggle.id, label: toggle.label }))}
                    value={toggles.filter((toggle) => toggle.pressed).map((toggle) => toggle.id)}
                    onChange={(next) => {
                      for (const toggle of toggles) {
                        const pressed = next.includes(toggle.id)
                        if (pressed !== toggle.pressed) toggle.onChange(pressed)
                      }
                    }}
                  />
                )
                : null}
              {sortMenu}
            </div>
          )
          : null}
      </div>
      {showFooter
        ? (
          <div class="flex flex-wrap items-center gap-2">
            {chips.length > 0
              ? (
                <>
                  <ul aria-label={chipsLabel} class="flex flex-wrap items-center gap-2">
                    {chips.map((chip, index) => (
                      <li
                        key={chip.key}
                        class="inline-flex min-w-0 max-w-full items-center rounded-full bg-selected-soft ps-3 text-sm text-selected"
                      >
                        <span class="truncate">{chip.label}</span>
                        <button
                          type="button"
                          data-filter-chip-remove=""
                          aria-label={removeLabel(chip)}
                          class="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-selected-soft-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus sm:size-8"
                          onClick={() => {
                            refocus.current = { index, chips: chips.length }
                            chip.remove()
                          }}
                        >
                          <IconXMark class="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    class="min-h-11 cursor-pointer rounded-primary px-2 text-sm font-medium text-selected hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus sm:min-h-8"
                    data-e2e="filter-clear"
                    onClick={clearAll}
                  >
                    {clearLabel}
                  </button>
                </>
              )
              : null}
            {count !== undefined
              ? (
                <p aria-live="polite" class="text-sm text-muted tabular-nums sm:ms-auto">
                  {count}
                </p>
              )
              : null}
          </div>
        )
        : null}
    </div>
  )
}
