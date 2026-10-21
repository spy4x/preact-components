/**
 * The small decisions behind `Combobox` and the components that share its keyboard table
 * (`TagInput`, `CommandPalette`): which key an event is, where the highlight starts, when a focus
 * change closes the popup and which prop names the input. Apart from the component so they can be
 * tested without a browser. Not an entry point of the package: an app imports `./combobox.tsx`
 * alone.
 *
 * @module
 */
import type { ComboboxKey, ComboboxState } from "./combobox.tsx"

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
 * `Alt` is the modifier a source application used to open without highlighting, so it is part of the key here
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
