import { cn } from "@preact-components/cn"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { buttonClasses } from "./button.tsx"

/**
 * How the trigger button gets its accessible name. One of the two is required, which is what makes
 * an unnamed trigger a type error rather than something a screen-reader user discovers at runtime.
 *
 * The two shapes exist because one `aria-label` cannot serve both triggers this component has. An
 * icon trigger renders no text, so a name has to be supplied: that is `triggerLabel`. A trigger
 * that renders its own text already has one, and an `aria-label` there would *replace* the words
 * on screen rather than add to them — the accessible name has to contain the visible label (WCAG
 * 2.5.3, Label in Name), so such a caller declares `triggerNamedByContent` and no `aria-label` is
 * written. `DateRangePicker` names its trigger the same way and says so.
 */
export type DropdownTriggerName =
  | {
    /** Accessible name for a trigger that renders no text, applied as `aria-label`. */
    triggerLabel: string
    triggerNamedByContent?: never
  }
  | {
    /**
     * The trigger's own visible text is its name, so no `aria-label` is written over it.
     *
     * Passing this is a promise that `trigger` renders text. No type can check it — a component
     * cannot know what a caller's children will render — so the promise is the caller's to keep.
     * Break it, by passing this on a trigger that renders only an icon, and the button has no
     * accessible name at all: a screen reader announces "button" and nothing else, which is the
     * defect `triggerLabel` exists to prevent. `pages/checks/ui.ts` asks the browser for the
     * computed name of every dropdown trigger the catalogue renders, so a broken promise inside
     * this repository fails the browser phase.
     */
    triggerNamedByContent: true
    triggerLabel?: never
  }

/** Everything about a dropdown except how its trigger is named. */
export interface DropdownBaseProps {
  /** Content of the trigger button. */
  trigger: ComponentChildren
  /** Utilities for the trigger button; defaults to the library's icon button. */
  triggerClasses?: string
  /** Sets `data-e2e` on the trigger button. */
  triggerDataE2E?: string
  /** Utilities for the root container; defaults to `relative inline-flex text-left`. */
  containerClasses?: string
  /** Extra utilities for the panel. */
  panelClasses?: string
  /** Menu content. Items are {@link DropdownItem}s; anything else the keyboard cannot reach. */
  children: ComponentChildren
  /** Vertical anchor relative to the trigger. Defaults to `"down"`. */
  vertical?: "up" | "down"
  /** Horizontal anchor relative to the trigger. Defaults to `"right"`. */
  horizontal?: "left" | "right"
  /** Accessible name for the menu, applied as `aria-label` on the panel. */
  menuLabel?: string
}

export type DropdownProps = DropdownBaseProps & DropdownTriggerName

/**
 * Index the open menu moves focus to for `key`, or `undefined` for a key the menu does not own.
 *
 * Pure and exported so the keyboard map is unit-testable on its own: the DOM wiring that calls it
 * only runs in a browser, this decision table does not need one. Focus wraps at both ends, the
 * same rule `Tabs` and `Combobox` follow — a menu is short by construction, and a dead end reads
 * as a broken key. `current` of `-1` means nothing in the menu has focus yet, and both arrows
 * answer it: Arrow Down lands on the first item, Arrow Up on the last.
 *
 * @param key Value of `KeyboardEvent.key`.
 * @param current Index of the item that has focus, or `-1` when none does.
 * @param count Number of focusable items in the menu.
 * @returns The index to focus, or `undefined` when this menu does not act on `key` — which
 * includes every key press in an empty menu.
 */
export function nextMenuIndex(key: string, current: number, count: number): number | undefined {
  if (count === 0) return undefined
  const last = count - 1

  switch (key) {
    case "ArrowDown":
      return current >= last ? 0 : current + 1
    case "ArrowUp":
      return current <= 0 ? last : current - 1
    case "Home":
      return 0
    case "End":
      return last
    default:
      return undefined
  }
}

const itemClasses =
  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:bg-gray-700"

export interface DropdownItemProps {
  /** Target of the item. It is a link when this is set and a `<button>` otherwise. */
  href?: string
  onClick?: () => void
  /** Disables the button form. A disabled item is skipped by the arrow keys. */
  disabled?: boolean
  /** Extra utilities, merged over the item's own. */
  class?: string
  /** Sets `data-e2e` on the item. */
  dataE2E?: string
  children: ComponentChildren
}

/**
 * One item of a {@link Dropdown}'s menu.
 *
 * It exists because `role="menuitem"` cannot be applied from outside: `Dropdown` receives its
 * children already rendered, and a menu whose children carry no role is, to a screen reader, a
 * menu with nothing in it. Rendering the item here is what puts the role on the element the user
 * actually activates.
 *
 * The item is out of the tab order (`tabindex="-1"`): inside a menu the arrow keys move between
 * items and Tab leaves the menu altogether, which is the behaviour {@link Dropdown} implements.
 * Focus is styled like hover, because focus now moves through these items without a pointer.
 *
 * @param props See {@link DropdownItemProps}.
 */
export function DropdownItem(
  { href, onClick, disabled, class: className, dataE2E, children }: DropdownItemProps,
) {
  const classes = cn(itemClasses, className)

  return href !== undefined
    ? (
      <a
        href={href}
        class={classes}
        role="menuitem"
        tabindex={-1}
        data-e2e={dataE2E}
        onClick={onClick}
      >
        {children}
      </a>
    )
    : (
      <button
        type="button"
        class={classes}
        role="menuitem"
        tabindex={-1}
        disabled={disabled}
        data-e2e={dataE2E}
        onClick={onClick}
      >
        {children}
      </button>
    )
}

/**
 * The menu's focusable items, in DOM order.
 *
 * Read out of the DOM rather than counted from props, because the panel takes arbitrary children:
 * a caller may wrap its items in a divider row or a `role="none"` group, and only the rendered
 * tree knows where the items ended up. {@link DropdownItem} is what marks them.
 *
 * A disabled item is left out rather than focused-but-inert. ARIA allows either, and this is the
 * half a native `<button disabled>` can actually do: it is not focusable at all, so landing on it
 * would silently leave focus where it already was.
 *
 * @param panel The panel element, or `null` before it is mounted.
 * @returns The items the arrow keys move between.
 */
function menuItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []

  return Array.from(panel.querySelectorAll<HTMLElement>(`[role="menuitem"]`))
    .filter((item) =>
      !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true"
    )
}

/**
 * Trigger plus a real menu: opening moves focus into it, the arrow keys move between its items,
 * Escape closes it and gives the trigger its focus back, and it closes as soon as focus leaves.
 *
 * Open/closed is local visual state, so it stays inside the component. Every `document` access
 * lives in an effect or an event handler, which keeps the first render free of the DOM and the
 * component server-renderable.
 *
 * Opening moves focus from an effect rather than from the click handler: the items are only in
 * the layout after the render that drops `hidden`, and `focus()` on a hidden element does nothing.
 * Escape returns focus to the trigger; closing because focus left does not, because focus has
 * already gone where the user sent it.
 *
 * @param props See {@link DropdownProps}.
 */
export function Dropdown(props: DropdownProps) {
  const {
    trigger,
    triggerClasses,
    triggerDataE2E,
    triggerLabel,
    containerClasses,
    panelClasses,
    children,
    vertical = "down",
    horizontal = "right",
    menuLabel,
  } = props

  const isOpen = useSignal(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = isOpen.value

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        isOpen.value = false
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    menuItems(panelRef.current)[0]?.focus()
  }, [open])

  const close = (returnFocus: boolean) => {
    isOpen.value = false
    if (returnFocus) triggerRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen.value) return

    if (event.key === "Escape") {
      event.preventDefault()
      // The innermost open layer answers Escape: a dropdown inside a dialog closes itself and
      // leaves the dialog where it is.
      event.stopPropagation()
      close(true)
      return
    }

    const items = menuItems(panelRef.current)
    const target = nextMenuIndex(
      event.key,
      items.indexOf(document.activeElement as HTMLElement),
      items.length,
    )
    if (target === undefined) return

    event.preventDefault()
    items[target]?.focus()
  }

  // Tab is deliberately not handled here. The items are out of the tab order, so one Tab press
  // already takes focus out of the menu; this listener is what notices and closes behind it.
  const handleFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next) {
      if (!rootRef.current?.contains(next)) isOpen.value = false
      return
    }

    // A null `relatedTarget` means two opposite things: focus left for somewhere the event cannot
    // name, and focus went **nowhere**. The second is an ordinary left click on the panel's own
    // padding — the strip above the first item, the gap between two rows — which blurs the item
    // and lands on nothing. Closing on that loses the menu and the user's place over a click a
    // few pixels off target. The event cannot tell them apart, so this waits a tick and reads
    // where focus actually ended up.
    const left = event.target as HTMLElement | null
    setTimeout(() => {
      const root = rootRef.current
      // Already closed — an outside click, which `handleClickOutside` answers first — or gone.
      // Deliberate belt and braces, with no check behind it: a review removed this line and
      // nothing went red, because a closed panel is `display:none`, its items cannot take focus,
      // and the restore below is already a no-op. Kept because it states the intent where a later
      // change could make it matter, not because it is load-bearing today.
      if (!isOpen.value || !root) return

      const active = document.activeElement
      if (active !== null && active !== document.body && !root.contains(active)) {
        isOpen.value = false
        return
      }
      // Focus went nowhere and the menu is still open, so the click was inside it. Hand the item
      // its focus back: leaving focus on `<body>` would keep the menu open with its arrow keys
      // dead, which is no better than closing it.
      if (!root.contains(active)) left?.focus()
    }, 0)
  }

  // Activating an item ends the interaction, so the menu closes and hands focus back. The click
  // lands on whatever is inside the item — an icon, a span — hence `closest` rather than `target`.
  const handlePanelClick = (event: MouseEvent) => {
    if (!(event.target as HTMLElement | null)?.closest(`[role="menuitem"]`)) return
    close(true)
  }

  const verticalClass = vertical === "up" ? "bottom-full mb-2" : "top-full mt-2"
  const horizontalClass = horizontal === "left" ? "left-0" : "right-0"
  const originClass = vertical === "up"
    ? (horizontal === "left" ? "origin-bottom-left" : "origin-bottom-right")
    : (horizontal === "left" ? "origin-top-left" : "origin-top-right")

  return (
    <div
      class={cn("relative inline-flex text-left", containerClasses)}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onFocusOut={handleFocusOut}
    >
      <button
        ref={triggerRef}
        onClick={() => isOpen.value = !isOpen.value}
        type="button"
        class={triggerClasses ?? buttonClasses("icon")}
        data-e2e={triggerDataE2E}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel}
      >
        {trigger}
      </button>
      <div
        ref={panelRef}
        class={cn(
          "absolute z-10 whitespace-nowrap rounded-md bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-gray-600 focus:outline-hidden",
          horizontalClass,
          verticalClass,
          originClass,
          open ? "" : "hidden",
          panelClasses,
        )}
        role="menu"
        aria-orientation="vertical"
        aria-label={menuLabel}
        onClick={handlePanelClick}
      >
        {children}
      </div>
    </div>
  )
}
