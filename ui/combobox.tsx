import { cn } from "@preact-components/cn"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"

/**
 * Keys the combobox acts on, and what each does. Everything else falls through to the platform,
 * which is what keeps typing, caret movement and IME composition working.
 *
 * This is the behaviour `comboboxKeyAction` implements, and the two are asserted together: `Enter`
 * and `Escape` are consumed in **both** columns, closed included, because consuming them is what stops
 * a surrounding `<form>` from submitting on `Enter` and stops Safari from clearing the input on
 * `Escape`. Consuming them while closed changes no state, so they are no-ops in that column.
 *
 * | Key                   | Closed                                    | Open                                    |
 * | --------------------- | ----------------------------------------- | --------------------------------------- |
 * | `ArrowDown`           | opens, activates the first option         | activates the next option, wrapping     |
 * | `Alt`+`ArrowDown`     | opens, nothing active                     | clears the highlight                    |
 * | `ArrowUp`             | opens, activates the last option          | activates the previous option, wrapping |
 * | `Alt`+`ArrowUp`       | closes (already closed: no-op)            | closes                                  |
 * | `Home` / `End`        | not consumed, so the caret keeps them      | activates the first / last option       |
 * | `Enter`               | consumed, no-op                           | selects the active option, closes       |
 * | `Escape`              | consumed, no-op                           | closes and drops the query              |
 * | `Tab`                 | not consumed anywhere                     | list closes when focus leaves the input |
 */
export type ComboboxKey =
  | "ArrowDown"
  | "Alt+ArrowDown"
  | "ArrowUp"
  | "Alt+ArrowUp"
  | "Home"
  | "End"
  | "Enter"
  | "Escape"

/** Highlighted-or-not plus open-or-not of one combobox. `activeIndex` is `-1` when nothing is active. */
export interface ComboboxState {
  /** Index into the *filtered* item list, `-1` for none. */
  activeIndex: number
  isOpen: boolean
}

/** What one key press produces: the next state, plus whether the key was ours to consume. */
export interface ComboboxKeyResult extends ComboboxState {
  /** `true` when the key is in the table above, so the caller should `preventDefault()`. */
  handled: boolean
}

/** Diacritic marks left over after `String.prototype.normalize("NFD")` splits an accented letter. */
const diacritics = /[\u0300-\u036f]/g

/**
 * Fold a string for searching: Unicode-decompose, drop the combining marks, then lower-case.
 *
 * `NFD` plus the mark strip is the platform's own accent folding, so `"são"` and `"sao"` fold to
 * the same `"sao"`, and `"ÉCU"` to `"ecu"` — no dependency, no hand-written accent table. Case
 * folding is `toLowerCase()`, deliberately not `toLocaleLowerCase()`: a Turkish locale folds `I` to
 * `ı`, which would make a match depend on the host locale.
 *
 * @param value Text to fold.
 * @returns The folded text.
 */
export function fold(value: string): string {
  return value.normalize("NFD").replace(diacritics, "").toLowerCase()
}

/** The identity rule for item text: `String(item)`. Exported so a `getLabel` can fall back to it. */
export function defaultGetLabel<T>(item: T): string {
  return String(item)
}

/**
 * Whether one item matches a query.
 *
 * Substring match on the folded text — the rule `financy`'s currency selector used, minus the
 * currency fields. Diacritics fold, so `"sao"` finds `"São Paulo"`.
 *
 * @param item Item to test.
 * @param query Raw query; the caller need not trim or fold it.
 * @param getLabel How to read the item's text. Defaults to `String(item)`.
 */
export function matchesQuery<T>(
  item: T,
  query: string,
  getLabel: (item: T) => string = defaultGetLabel,
): boolean {
  const needle = fold(query.trim())
  if (needle === "") return true
  return fold(getLabel(item)).includes(needle)
}

/**
 * Filter a list down to the items matching a query, in the order they arrived.
 *
 * The pure core of the component: no DOM, no signals, no state. An empty (or whitespace-only) query
 * keeps every item; a query matching nothing returns `[]`, and the component decides that its
 * `emptyMessage` goes in that slot.
 *
 * @param items Items to filter.
 * @param query Raw query, folded internally.
 * @param getLabel How to read an item's text. Defaults to `String(item)`.
 * @returns The matching items, original order preserved.
 */
export function filterItems<T>(
  items: readonly T[],
  query: string,
  getLabel: (item: T) => string = defaultGetLabel,
): T[] {
  return items.filter((item) => matchesQuery(item, query, getLabel))
}

/**
 * Decide what one key press does to the active option and the open state.
 *
 * Pure and total: every key in {@link ComboboxKey} returns a state, and the arity is only used to
 * wrap, so there is no index to clamp wrongly. **Wrapping is the chosen rule** — `ArrowDown` on the
 * last option lands on the first — because a searchable list is short by construction (the query
 * narrows it) and a dead end reads as a broken key.
 *
 * The component's key handler takes the same path, so what these tests pin is what the browser runs.
 *
 * @param state State before the press.
 * @param key The pressed key, from the table above.
 * @param count Length of the *filtered* list — the list on screen, not the `items` prop.
 * @returns The next state, plus `handled: false` for a key the combobox does not act on.
 */
export function nextComboboxState(
  state: ComboboxState,
  key: ComboboxKey,
  count: number,
): ComboboxKeyResult {
  const { activeIndex, isOpen } = state
  const empty = count === 0
  const first = 0
  const last = count - 1
  const keep = (): ComboboxKeyResult => ({ activeIndex, isOpen, handled: true })
  const next = (active: number, open: boolean): ComboboxKeyResult => ({
    activeIndex: active,
    isOpen: open,
    handled: true,
  })

  switch (key) {
    case "ArrowDown":
      if (empty) return next(activeIndex, true)
      return next(activeIndex >= last ? first : activeIndex < first ? first : activeIndex + 1, true)
    case "ArrowUp":
      if (empty) return next(activeIndex, true)
      return next(activeIndex <= first ? last : activeIndex > last ? last : activeIndex - 1, true)
    case "Alt+ArrowDown":
      return next(-1, true)
    case "Alt+ArrowUp":
      return next(-1, false)
    case "Home":
      return isOpen && !empty ? next(first, true) : keep()
    case "End":
      return isOpen && !empty ? next(last, true) : keep()
    case "Enter":
      return isOpen ? next(-1, false) : keep()
    case "Escape":
      return isOpen ? next(-1, false) : keep()
    default:
      return { activeIndex, isOpen, handled: false }
  }
}

/** What the DOM handler must do once {@link comboboxKeyAction} has decided. */
export interface ComboboxKeyAction {
  /** Next open state and highlight. Assign both. */
  state: ComboboxState
  /** Call `preventDefault()`. `false` for the keys the browser still owns, `Home`/`End` while closed. */
  preventDefault: boolean
  /** Select `items[index]` and close. `-1` when the key selects nothing. */
  select: number
}

/**
 * The whole key decision table of the combobox: state, `preventDefault` and selection, decided
 * purely from the key, the current state and the length of the filtered list.
 *
 * A superset of {@link nextComboboxState}, which owns the highlight arithmetic. This function adds
 * the two things the DOM handler needs beyond it: whether the key belongs to the browser after all,
 * and which option `Enter` picks.
 *
 * `preventDefault` is deliberately withheld where a default is useful: `Home` and `End` while closed
 * are the caret's, and a single-character key must reach the input or nothing would ever be typed.
 * `Enter` and `Escape` are consumed unconditionally — `Enter` so a surrounding form does not submit,
 * `Escape` so Safari does not clear the input — and while closed they change nothing.
 *
 * @param key Key from the table above.
 * @param state State before the press.
 * @param count Length of the filtered list.
 */
export function comboboxKeyAction(
  key: ComboboxKey,
  state: ComboboxState,
  count: number,
): ComboboxKeyAction {
  const target = nextComboboxState(state, key, count)
  const next: ComboboxState = { activeIndex: target.activeIndex, isOpen: target.isOpen }
  const caret = key === "Home" || key === "End"
  if (key === "Escape") return { state: next, preventDefault: true, select: -1 }
  if (key === "Enter") {
    const chosen = state.isOpen && state.activeIndex >= 0 ? state.activeIndex : -1
    return { state: next, preventDefault: true, select: chosen }
  }
  return { state: next, preventDefault: !caret || state.isOpen, select: -1 }
}

/**
 * Index the `items` prop by item identity, in one pass.
 *
 * The listbox asks "is this row the selected one?" once per rendered row. Answering that with
 * `items.indexOf(item)` reads the whole prop per row, so a render costs `n²` identity comparisons:
 * at 5k items that is ~25M of them per keystroke, on top of the DOM work. One `Map` built here
 * answers each row in constant time, which leaves the render loop costing what the DOM costs.
 *
 * First occurrence wins, which is what `indexOf` reports for a repeated item, so the map answers
 * exactly what the lookup it replaced answered.
 *
 * Deliberately unexported: `ui-guide`'s subpath guard requires every `ui` value export to be either
 * barrelled or declared a helper, and neither of those files belongs to this change. The linearity
 * is asserted through the component instead — `combobox.test.tsx`, "Combobox render cost".
 *
 * @param items The item list, in the order it will be rendered.
 * @returns Item to the index of its first occurrence in `items`.
 */
function itemIndex<T>(items: readonly T[]): ReadonlyMap<T, number> {
  const positions = new Map<T, number>()
  for (const [index, item] of items.entries()) {
    if (!positions.has(item)) positions.set(item, index)
  }
  return positions
}

/**
 * Index of `value` in `items`, or `-1` when it is not one of them: what `items.indexOf(value)`
 * answers, without the scan.
 *
 * `NaN` is guarded explicitly because the two lookups disagree about it: `indexOf` compares with
 * `===`, under which `NaN` matches nothing, while a `Map` keyed on `NaN` finds it. `-0` and `0` are
 * the same value to both. A `null` or missing `value` is "no selection", never an index.
 *
 * @param positions The item index from {@link itemIndex}.
 * @param value Selected item, or `null`/`undefined` for none.
 */
function selectionIndex<T>(
  positions: ReadonlyMap<T, number>,
  value: T | null | undefined,
): number {
  if (value === null || value === undefined || Number.isNaN(value)) return -1
  return positions.get(value) ?? -1
}

/**
 * Whether a focus change **out of the input** closes the popup.
 *
 * The containment test has to mean "focus is still on the input", not "focus is still somewhere in the
 * component". Two descendants are reachable by one `Tab` in Chrome: the clear button, and — when the
 * option list overflows its `max-h-60` — the popup `<ul>` itself, which is a scrollable box and so a
 * tab stop with `tabIndex === -1`. A root-containment test keeps the list open in both cases, which is
 * a defect, not a design choice.
 *
 * A `relatedTarget` of `null` is *not* a leave: clicking an option (unfocusable `<li>`) or anything
 * else unfocusable leaves focus nowhere, and that case belongs to the outside-click listener.
 *
 * @param activeElement The input the event came from; the reference for "the same element".
 * @param relatedTarget The focus destination, or `null` for "nowhere".
 */
export function leavesCombobox(
  activeElement: Pick<Node, "isSameNode">,
  relatedTarget: Node | null,
): boolean {
  return relatedTarget !== null && !activeElement.isSameNode(relatedTarget)
}

/**
 * Whether the combobox has a usable accessible name, and which channel carries it.
 *
 * `ariaLabel` and `aria-labelledby` are alternatives; both is legal and `aria-labelledby` wins in the
 * accessibility tree, so the caller is left to set both if it wants to. Neither one is **not**
 * something this function can fix — the component cannot invent a name — which is why it exists: a
 * silent unnamed combobox is the failure mode being guarded against, and a consumer that reads this
 * JSDoc knows it must pass one.
 *
 * @param props The naming-relevant subset of the props.
 */
export function naming(props: { ariaLabel?: string; "aria-labelledby"?: string }): string | null {
  if (props["aria-labelledby"]) return "aria-labelledby"
  if (props.ariaLabel) return "aria-label"
  return null
}

/** What the popup must render: either options with ids, or nothing at all. */
export interface ComboboxListboxContent<T, M = string> {
  /**
   * The rows to render. **Empty when the query matches nothing**, because `role="listbox"` may only
   * contain `role="option"` and `role="group"`: a message row inside it is an `aria-required-children`
   * violation, which is why the empty message is rendered by the status element instead.
   */
  options: readonly T[]
  /** Message to show and announce, or `undefined` when the list is not empty. */
  emptyMessage: M | undefined
}

/**
 * Split a filtered list into "options to render" and "message to announce".
 *
 * The message is resolved here rather than in the markup so the `string | (query) => children`
 * signature is flattened once and the resolver is testable on its own.
 *
 * `M` keeps whatever the caller's function-form message returns, so a JSX empty state survives into
 * the markup. Whatever it is, the component renders it inside the one live region it keeps, so a
 * JSX empty state is announced by its text exactly as a string one is.
 *
 * @param visible Items the filter left.
 * @param query The query that produced them, handed to a function-form message.
 * @param message The caller's `emptyMessage`.
 */
export function listboxContent<T, M = string>(
  visible: readonly T[],
  query: string,
  message: M | ((query: string) => M) = "No matches" as M,
): ComboboxListboxContent<T, M> {
  if (visible.length > 0) return { options: visible, emptyMessage: undefined }
  return {
    options: [],
    emptyMessage: typeof message === "function" ? (message as (q: string) => M)(query) : message,
  }
}

/**
 * The state a keystroke leaves behind after the caller has re-filtered for the new query.
 *
 * This is the whole "type then Enter" path as one pure step: the popup opens, and the highlight moves
 * to the first item the new query still leaves, so an immediate `Enter` selects something instead of
 * doing nothing. An empty list yields `activeIndex: -1`, which is the state that makes `Enter` a no-op
 * while the status element shows the empty message.
 *
 * @param remaining The list the caller's filter produced for the new query.
 * @param isDisabled Whether an item may be highlighted.
 */
export function typingState<T>(
  remaining: readonly T[],
  isDisabled: (item: T) => boolean = () => false,
): ComboboxState {
  return { activeIndex: selectableIndex(remaining, -1, isDisabled), isOpen: true }
}

/**
 * The state a fresh list opens into: open, highlighting the selected item when the filter kept it,
 * else the first enabled one.
 *
 * @param items The full item list, for resolving the selected item.
 * @param selectedIndex Index of the selected item in `items`, `-1` for none.
 * @param visible The filtered list as it will be rendered.
 * @param isDisabled Whether an item may be highlighted.
 */
export function openingState<T>(
  items: readonly T[],
  selectedIndex: number,
  visible: readonly T[],
  isDisabled: (item: T) => boolean = () => false,
): ComboboxState {
  return {
    activeIndex: selectableIndex(visible, visible.indexOf(items[selectedIndex]), isDisabled),
    isOpen: true,
  }
}

/** Keys the combobox acts on without a modifier. */
const plainKeys: readonly string[] = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]

/**
 * Map a DOM keyboard event onto a {@link ComboboxKey}.
 *
 * `Alt` is the modifier `financy` used to open without highlighting, so it is part of the key here
 * rather than the caller's business. Anything unrecognised returns `undefined`, and the caller must
 * then leave the event alone.
 *
 * @param event Key event, or anything shaped like one.
 */
export function comboboxKey(
  event: Pick<KeyboardEvent, "key" | "altKey">,
): ComboboxKey | undefined {
  // Alt is only meaningful on the two arrows, so any other alt chord is the platform's.
  if (event.altKey && event.key !== "ArrowDown" && event.key !== "ArrowUp") return undefined
  if (!plainKeys.includes(event.key)) return undefined
  const alt = event.altKey
  return (alt ? `Alt+${event.key}` : event.key) as ComboboxKey
}

/** `id` of the popup listbox of the combobox whose base id is `id`. */
export function comboboxListboxId(id: string): string {
  return `${id}-listbox`
}

/** `id` of one option, which is also what `aria-activedescendant` points at. */
export function comboboxOptionId(id: string, index: number): string {
  return `${id}-option-${index}`
}

/**
 * `aria-activedescendant` for the combobox input, or `undefined` when nothing is highlighted.
 *
 * `undefined` rather than an empty string on purpose: Preact drops the attribute entirely, so a
 * closed combobox never carries a pointer to an option that is not on screen.
 *
 * @param id Base id of the combobox.
 * @param state Current active and open state.
 */
export function activeDescendant(id: string, state: ComboboxState): string | undefined {
  return state.isOpen && state.activeIndex >= 0
    ? comboboxOptionId(id, state.activeIndex)
    : undefined
}

/**
 * Index a freshly opened list should highlight: `preferred` when it is still in the list and taking
 * it is allowed, else the first enabled item, else `-1` when nothing can be highlighted.
 *
 * `-1` as a preference loses to every real index, which is what folds "no selection" and "the
 * selection is filtered out" into the same rule.
 *
 * @param list The filtered list as it will be rendered.
 * @param preferred Index of the selected item, `-1` for none.
 * @param isDisabled Whether an item may be highlighted at all.
 */
export function selectableIndex<T>(
  list: readonly T[],
  preferred: number,
  isDisabled: (item: T) => boolean = () => false,
): number {
  const usable = (index: number) => index >= 0 && index < list.length && !isDisabled(list[index])
  return usable(preferred) ? preferred : list.findIndex((item) => !isDisabled(item))
}

/** Extra state handed to a `renderOption` callback, so the caller can style selection and highlight. */
export interface ComboboxOptionState {
  /** `true` for the option the `value` prop selects. Also set as `aria-selected`. */
  selected: boolean
  /** `true` for the option the keyboard is on. Also set as `data-active`. */
  active: boolean
}

export interface ComboboxProps<T> extends ComboboxNamingProps {
  /** Every option, in the order the caller wants them listed. The component filters this. */
  items: readonly T[]
  /** Selected item, or `null`/`undefined` for none. `T` may be a string, a number or an object. */
  value?: T | null
  /** Selection port. Called with the item, or with `null` by the clear button. */
  onChange: (value: T | null) => void
  /**
   * Text of an item: what is shown, what the query is matched against and how `value` is compared.
   * Defaults to `String(item)`, right for `string[]` and wrong for objects — pass this for objects.
   */
  getLabel?: (item: T) => string
  /** Replaces {@link filterItems} entirely, e.g. for server-side filtering. Must be pure. */
  filter?: (items: readonly T[], query: string) => T[]
  /** Custom option markup. Keep it inside the `role="option"` element the component renders. */
  renderOption?: (item: T, state: ComboboxOptionState) => ComponentChildren
  /** Marks an item unselectable: rendered `aria-disabled`, and a click on it does nothing. */
  isItemDisabled?: (item: T) => boolean
  /** Shown in the input while nothing is selected. English default, `"Select…"`; override at will. */
  placeholder?: string
  /**
   * Shown instead of the list when the query matches nothing. A string, or a function of the query.
   *
   * English default, `"No matches"`; pass your own to translate it or to say something more
   * useful. It is shown only once the list is open or the field has a query in it — a combobox
   * nobody has touched answers a question nobody asked.
   */
  emptyMessage?: string | ((query: string) => ComponentChildren)
  /**
   * How many options the query left, worded for a screen reader, as a function of that number.
   *
   * English default, `"1 match"` / `"12 matches"`; pass your own to translate it or to count
   * something the default cannot name. It is announced only while the field carries a query and
   * that query leaves at least one option — when it leaves none, {@link ComboboxProps.emptyMessage}
   * is the answer instead. Nobody sees this text: it is rendered inside the live region, visually
   * hidden, because the matching rows are already on screen for anyone who can read them.
   */
  countMessage?: (count: number) => string
  /**
   * `id` of the search input, and the base of every id derived from it: the listbox and each option.
   * Pass one when a visible `<label for>` should point at the input. Without it a `useId()` value is
   * used — stable per instance, but not something a caller can address from outside.
   */
  id?: string
  /** Render the clear button. Defaults to `true`; it only appears when there is something to clear. */
  showClearButton?: boolean
  /** Accessible name of the clear button. English default, `"Clear selection"`; override at will. */
  clearLabel?: string
  /** Query owned by the caller. Pass with `onQueryChange` for a controlled search box. */
  query?: string
  /** Called on every keystroke with the raw input value. */
  onQueryChange?: (query: string) => void
  /** Utilities for the wrapper. */
  class?: string
  /** Utilities for the search input. */
  inputClass?: string
  /** Utilities for the popup listbox. */
  listboxClass?: string
}

/**
 * How the combobox is named. One of the two is needed: an unnamed combobox is a broken control for
 * assistive tech, and the component cannot invent a name for itself.
 *
 * `ariaLabel` is for a name with no visible text. `aria-labelledby` points at the caller's own
 * `<label id>` and is what a visible label wants — with `id`, that is the full "`<label for>` plus
 * `aria-labelledby`" pairing, which is also how `crud`'s field rows name their controls.
 */
export interface ComboboxNamingProps {
  /** Accessible name of the input and the listbox. Either this or `aria-labelledby` is required. */
  ariaLabel?: string
  /** `id` of the element that names the combobox, typically the caller's visible `<label>`. */
  "aria-labelledby"?: string
}

/*
 * Base classes first. `cn` resolves conflicts last-wins, so a state class has to come after the
 * base to win: the highlighted row repaints the background, the selected row repaints the text.
 */
const optionClasses =
  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700"
const activeOptionClasses = "bg-gray-50 dark:bg-gray-700"
const selectedOptionClasses =
  "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200"
const disabledOptionClasses = "cursor-not-allowed opacity-50"

/**
 * Chevron of the search input, inline so `ui`'s "no dependency on `icons/`" rule holds.
 *
 * `aria-hidden` because the input already announces itself as a combobox; the glyph adds nothing
 * for assistive tech.
 */
function Chevron() {
  return (
    <svg
      class="size-4 shrink-0 text-gray-400 dark:text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * English default for {@link ComboboxProps.countMessage}: `"1 match"`, `"12 matches"`.
 *
 * Deliberately unexported, like {@link itemIndex}: `ui-guide`'s subpath guard wants every `ui` value
 * export either barrelled or declared a helper, and a default string belongs to the component rather
 * than to a caller. The component's tests pin the wording.
 *
 * @param count How many options the query left; never negative.
 */
function defaultCountMessage(count: number): string {
  return count === 1 ? "1 match" : `${count} matches`
}

/** Clear glyph, inline for the same reason as {@link Chevron}. */
function Cross() {
  return (
    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

/**
 * Searchable single-select: a text input filtering a `role="listbox"` of options.
 *
 * The ARIA combobox pattern, hand-written: `role="combobox"` on the input with `aria-expanded`,
 * `aria-controls` and `aria-activedescendant`, `role="listbox"` on the popup and `role="option"`
 * with `aria-selected` on each row. Focus never leaves the input — the highlight is announced
 * through `aria-activedescendant`, which is why the options are not focusable themselves.
 *
 * Everything the component knows arrives as a prop and selection leaves through `onChange`; the
 * only state inside is visual (open-or-not, the draft query, the highlighted index). Its rules live
 * in {@link nextComboboxState} and {@link filterItems}, exported and testable without a DOM.
 *
 * The item list is indexed once per render ({@link itemIndex}), so asking which row is the selected
 * one is a lookup per row rather than a scan of `items` per row.
 *
 * ```tsx
 * <Combobox
 *   items={["BTC", "ETH", "USD"]}
 *   value={coin}
 *   onChange={(next) => coin = next}
 *   placeholder="Select a coin…"
 * />
 * ```
 *
 * The popup is in the markup at all times, marked `hidden` when closed, so even the closed-state
 * output carries `aria-controls` and the whole option list. The open and highlighted half of the
 * markup only reaches a browser through a real key press or click.
 *
 * The highlight belongs to the keyboard. Arrow keys move it, the list scrolls to follow it, and no
 * pointer handler writes it — a `mouseenter` that moved `aria-activedescendant` would drag a screen
 * reader's reading position around with a pointer its user is not holding. The row under the
 * pointer is still painted, in CSS, which announces nothing. The one thing that highlights a row
 * without a key press is options arriving under an open, empty popup: a list that lands with
 * nothing highlighted would leave `Enter` doing nothing until an arrow key was pressed.
 *
 * One live region is rendered with the field and never taken away — on the server too — and the
 * answers go into it: the count of matching options while a query is narrowing the list, the empty
 * message when the query leaves nothing. Assistive technology announces a *change* to a region it
 * is already watching and commonly says nothing about a region that arrives with its message
 * already inside it, so a region created together with its text announces nothing. Empty it has no
 * box, and it sits inside this component's own root, so a host's `flex` or `grid` container never
 * spaces a child it cannot see.
 *
 * `aria-describedby` points the input at that region while the empty message is what it holds, and
 * never while the count is: the message is a standing fact a reader should be told on focus, and a
 * count is about the last keystroke rather than about the field.
 *
 * Every string it shows is a prop with an English default: `placeholder` (`"Select…"`),
 * `emptyMessage` (`"No matches"`), `countMessage` (`"12 matches"`) and `clearLabel`
 * (`"Clear selection"`). Pass your own to translate them or to say something the default cannot.
 */
export function Combobox<T>({
  items,
  value = null,
  onChange,
  getLabel,
  filter,
  renderOption,
  isItemDisabled,
  placeholder = "Select…",
  emptyMessage = "No matches",
  countMessage = defaultCountMessage,
  id: callerId,
  ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  showClearButton = true,
  clearLabel = "Clear selection",
  query: controlledQuery,
  onQueryChange,
  class: className,
  inputClass,
  listboxClass,
}: ComboboxProps<T>) {
  const generatedId = useId()
  const id = callerId ?? generatedId
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  /** Whether the last render had nothing to show, so the next one can tell arrival from a change. */
  const wasEmpty = useRef(true)
  const draftQuery = useSignal("")
  const isOpen = useSignal(false)
  const activeIndex = useSignal(-1)
  const getText = getLabel ?? defaultGetLabel
  const isDisabled = (item: T) => isItemDisabled?.(item) === true

  const draft = controlledQuery ?? draftQuery.value
  /** The list for any query, through the caller's `filter` when given: what the input handler needs. */
  const visibleItems = (text: string) =>
    (filter ?? ((all: readonly T[], query: string) => filterItems(all, query, getText)))(
      items,
      text,
    )
  const visible = visibleItems(draft)
  const listboxId = comboboxListboxId(id)
  const statusId = `${id}-status`
  // One pass over `items` per render, and then the selection tests below cost a lookup each. Rebuilt
  // rather than memoised on `items` on purpose: a caller that mutates its list in place keeps the
  // same array reference, and a cached index would then answer with the stale positions — a wrong
  // selection is worse than the O(n) walk that a render already does over the same array.
  const positions = itemIndex(items)
  const selectedIndex = selectionIndex(positions, value)
  const hasSelection = selectedIndex >= 0
  const hasText = draft.length > 0
  const content = listboxContent(visible, draft, emptyMessage)
  // "No matches" is an answer, and an answer needs a question. A combobox nobody has opened and
  // nobody has typed in has asked nothing, so it says nothing — which is the whole of the defect
  // this guards: with an empty `items` list, a page whose options are still arriving over the
  // network used to render and announce "No matches" on a control nobody had touched. Open, or
  // with a query in it, the message is the honest answer to a real question and is shown.
  const answersEmpty = content.emptyMessage !== undefined && (isOpen.value || hasText)
  // The count answers one question — "what did my typing leave?" — so it is narrower than the
  // message above on purpose: opening the list is answered by the list itself, which a reader
  // announces along with the highlighted row, and a count repeated on every open would be noise
  // over the top of it. Nothing to count is not a count of nothing: an empty result is the empty
  // message's job, and announcing both would say the same thing twice.
  const announcesCount = hasText && visible.length > 0
  /**
   * The highlight, clamped to the list that is actually on screen.
   *
   * A highlight cannot outlive the row it names. The list can shrink under an open popup at any
   * time — options taken away by a caller that re-fetches them, a list of twenty-seven replaced by
   * one of three — and `aria-activedescendant` would then point at an element that is no longer in
   * the document: not a degraded announcement but an invalid one, a reading position inside a list
   * with no such row, on a field that may be saying there is nothing to match at the same moment.
   *
   * Clamped here rather than written back into the signal, because every reader takes this value:
   * the pointer the input carries, the row that paints itself active, and the key handler's idea of
   * where the highlight is. Writing it back would cost a second render to settle a number nothing
   * reads.
   *
   * So a highlight is suspended rather than thrown away: shrink the list under it and the highlight
   * goes, grow the list back and it returns to the row it was on, because the position was kept
   * while only the value anything reads was clamped. That is the better of the two behaviours for a
   * list that is being re-fetched, and it is the one to keep in mind when reading the effects
   * below — none of them fires on the way down, because there is nothing for them to do.
   */
  const active = activeIndex.value >= visible.length ? -1 : activeIndex.value
  // Which channel names this combobox, so each of the two labelled elements picks a consistent one.
  const named = naming({ ariaLabel, "aria-labelledby": ariaLabelledBy })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        isOpen.value = false
        activeIndex.value = -1
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  /**
   * Highlight the first usable row when options arrive under an open, empty popup.
   *
   * This is the case the silence rule above exists for, seen from the other side: a field opened
   * while its options are still on their way has nothing to highlight, and when the list lands
   * nothing would highlight it. The popup would then show rows with no `aria-activedescendant`,
   * so a screen reader would be told nothing arrived and `Enter` would do nothing until the user
   * pressed an arrow key.
   *
   * It fires only on the list going from empty to filled, which is what keeps it from fighting the
   * user. A highlight that is already somewhere is left alone, `Alt`+`ArrowDown` — the key that
   * deliberately clears the highlight — changes no length so this never runs after it, and a
   * caller swapping one non-empty list for another does not move a highlight either.
   *
   * The way back needs nothing here: a list that empties again leaves the highlight past the end
   * of what is on screen, and `active` above is clamped for exactly that.
   */
  useEffect(() => {
    const empty = visible.length === 0
    const arrived = wasEmpty.current && !empty
    wasEmpty.current = empty
    if (!isOpen.value || !arrived || active >= 0) return
    activeIndex.value = openingState(items, selectedIndex, visible, isDisabled).activeIndex
  }, [isOpen.value, visible.length])

  /**
   * Keep the highlighted option on screen.
   *
   * The popup is a fixed-height scroller, so a few `ArrowDown`s walk the highlight off the bottom
   * of it and the arrow keys go on moving something nobody can see — which makes them useless on
   * any list longer than the box. The row is read out of the list's own children by the index it
   * was rendered from, so no second lookup can disagree with the highlight.
   *
   * `block: "nearest"` is what keeps this quiet: a row already in view is not scrolled to, so
   * opening a list whose selection is visible does not jerk it, and the list scrolls by exactly
   * the row that went past the edge.
   */
  useEffect(() => {
    if (!isOpen.value || active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [isOpen.value, active])

  const setQuery = (next: string) => {
    draftQuery.value = next
    onQueryChange?.(next)
  }

  const close = () => {
    isOpen.value = false
    activeIndex.value = -1
  }

  /** Apply a state the pure functions decided. */
  const apply = (state: ComboboxState) => {
    isOpen.value = state.isOpen
    activeIndex.value = state.activeIndex
  }

  /**
   * Open the list and put the highlight where a fresh list belongs.
   *
   * Opening drops an abandoned draft query, which is what lets a closed combobox display its
   * selection and then empty itself for typing: the caller's `value` is the closed-state text, the
   * draft is the open-state text, and they never fight over the input. A controlled query belongs to
   * the caller, so it is left where it is.
   *
   * The highlight is placed against the list the popup is **about to** render, not the one the
   * render before it left behind. Dropping the query widens the list, and highlighting against the
   * narrow one put the highlight on whichever row happened to sit at that index in the wide one:
   * abandon a search, come back, and the list opened with a row highlighted that the query it no
   * longer has had chosen.
   */
  const openList = () => {
    const clears = controlledQuery === undefined && !isOpen.value
    if (clears) setQuery("")
    apply(openingState(items, selectedIndex, clears ? visibleItems("") : visible, isDisabled))
  }

  const select = (item: T) => {
    onChange(item)
    setQuery("")
    close()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = comboboxKey(event)
    if (key === undefined) return
    const action = comboboxKeyAction(key, {
      activeIndex: active,
      isOpen: isOpen.value,
    }, visible.length)
    if (action.preventDefault) event.preventDefault()
    if (action.select >= 0) {
      const item = visible[action.select]
      if (item !== undefined) select(item)
      return
    }
    // Closing drops the query with the list, matching what the input shows anyway: a closed
    // combobox displays its selection, so a kept-but-invisible draft would only be a trap.
    if (!action.state.isOpen && isOpen.value) setQuery("")
    apply(action.state)
  }

  // Closed and not being searched: the input shows the selection. Open or mid-query: it shows the
  // query, because that is what those characters are for.
  const inputValue = isOpen.value ? draft : hasSelection ? getText(items[selectedIndex]) : draft

  return (
    <div class={cn("relative", className)} ref={rootRef}>
      <div class="relative flex items-center">
        <input
          id={id}
          class={cn("input font-normal tracking-normal pr-16", inputClass)}
          type="text"
          role="combobox"
          value={inputValue}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          // Described by the region while the empty message is what it holds, and never while the
          // count is. The two are different kinds of sentence. "No matches" is a standing fact
          // about the field and stays true for as long as it is on screen, so a reader coming to
          // the field — tabbing into a server-filtered one that was rendered with a query matching
          // nothing, say — should be told it: a live region announces a change and says nothing on
          // focus, so without this the field would be silent about a message sitting in plain
          // sight. A count is not a fact about the field but about the last keystroke, and a
          // description is re-read every time the input is announced, so "12 matches" would be
          // spoken as part of the field's identity long after the number was true. Zero matches
          // never carries a count, so while `answersEmpty` holds the region's text is exactly the
          // empty message and nothing else.
          aria-describedby={answersEmpty ? statusId : undefined}
          aria-expanded={isOpen.value}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant(id, {
            activeIndex: active,
            isOpen: isOpen.value,
          })}
          aria-autocomplete="list"
          autocomplete="off"
          onInput={(event) => {
            const text = event.currentTarget.value
            setQuery(text)
            // The list is re-read on every keystroke, so the highlight starts over on the first item
            // the new query still leaves. Without this, Enter right after typing would select nothing.
            apply(typingState(visibleItems(text), isDisabled))
          }}
          onFocus={() => {
            // Focus opens the list with the same starting highlight, which is what makes a click on
            // the input behave like the ARIA combobox pattern expects.
            openList()
          }}
          onClick={() => {
            // A second click while the input already has focus fires no `onFocus`, so reopening has
            // to hang off the click as well.
            openList()
          }}
          onKeyDown={handleKeyDown}
          // Only one thing counts as "still here": focus staying on the input. A `Tab` from the input
          // lands on a descendant — the clear button, or the scrolling popup itself — and that is a
          // leave, not a stay.
          onBlur={(event) => {
            if (!leavesCombobox(event.currentTarget, event.relatedTarget as Node | null)) return
            close()
          }}
        />
        <div class="absolute inset-y-0 right-3 flex items-center gap-1">
          {showClearButton && (hasSelection || hasText) && (
            <button
              type="button"
              class="btn-input-icon size-7 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={clearLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null)
                setQuery("")
                close()
              }}
            >
              <Cross />
            </button>
          )}
          <Chevron />
        </div>
      </div>
      <ul
        id={listboxId}
        ref={listRef}
        role="listbox"
        aria-label={named === "aria-label" ? ariaLabel : undefined}
        aria-labelledby={named === "aria-labelledby" ? ariaLabelledBy : undefined}
        // The `hidden` attribute, not a `hidden` utility: the popup then disappears on markup alone,
        // without the stylesheet, and cannot be shown by a utility the caller adds.
        hidden={!isOpen.value}
        class={cn(
          "absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800",
          listboxClass,
        )}
      >
        {content.options.map((item, index) => {
          // A lookup, not a scan: reading `items` per row is what made this loop quadratic.
          const selected = positions.get(item) === selectedIndex
          const isActive = index === active
          const disabled = isDisabled(item)
          return (
            <li
              key={`${index}-${getText(item)}`}
              id={comboboxOptionId(id, index)}
              role="option"
              aria-selected={selected}
              aria-disabled={disabled || undefined}
              data-active={isActive || undefined}
              class={cn(
                optionClasses,
                isActive && activeOptionClasses,
                selected && selectedOptionClasses,
                disabled && disabledOptionClasses,
              )}
              onMouseDown={(event) => event.preventDefault()}
              // No pointer handler moves the highlight. `aria-activedescendant` is where a screen
              // reader is reading, and writing it from a `mouseenter` drags that reading around
              // with a pointer its user is not holding. The row under the pointer still lights up
              // — `hover:bg-gray-50` in the base classes does that, in CSS, announcing nothing.
              onClick={() => {
                if (!disabled) select(item)
              }}
            >
              {renderOption ? renderOption(item, { selected, active: isActive }) : getText(item)}
            </li>
          )
        })}
      </ul>
      {
        /*
        The live region, rendered on every render and empty until the field has been used.

        It is the container rather than a hidden element beside the message, which is the shape
        `Toastr` and `SWUpdater` settled on: the message is written once, so the visible text and
        the announced text cannot drift apart, and there is no second copy for a reader to meet
        twice while browsing. The count has no visible counterpart, so that one is `sr-only` — the
        rows it counts are already on screen for anyone who can see them.

        Both live outside the `role="listbox"`: a listbox's children must be `option` or `group`,
        so a message row inside it is an `aria-required-children` violation.

        Empty, the region is an ordinary in-flow element with no class, no padding, no border and
        no minimum height, so it is zero pixels tall. It is a child of this component's own root —
        a plain block container — rather than of the host's, which is what keeps a host's `flex` or
        `grid` gap from being charged for an element nobody can see.

        `aria-atomic` is written out although `role="status"` implies it, so the next person reads
        the intent: a reader announces the whole sentence rather than the one text node that
        changed.
      */
      }
      <div id={statusId} role="status" aria-live="polite" aria-atomic="true">
        {answersEmpty && (
          <p class="px-3 py-2 text-center text-sm text-gray-500 dark:text-gray-400">
            {content.emptyMessage}
          </p>
        )}
        {announcesCount && <span class="sr-only">{countMessage(visible.length)}</span>}
      </div>
    </div>
  )
}
