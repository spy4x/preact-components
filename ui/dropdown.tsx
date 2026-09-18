import { cn } from "@preact-components/signals/cn"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { buttonClasses } from "./button.tsx"

export interface DropdownProps {
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
  /** Panel content. */
  children: ComponentChildren
  /** Vertical anchor relative to the trigger. Defaults to `"down"`. */
  vertical?: "up" | "down"
  /** Horizontal anchor relative to the trigger. Defaults to `"right"`. */
  horizontal?: "left" | "right"
  /** Accessible name for the menu, applied as `aria-label` on the panel. */
  menuLabel?: string
}

/**
 * Trigger plus panel that closes on outside click.
 *
 * Open/closed is local visual state, so it stays inside the component. The outside-click
 * listener lives in an effect, which keeps the initial render free of `document` access and
 * therefore server-renderable.
 */
export function Dropdown(
  {
    trigger,
    triggerClasses,
    triggerDataE2E,
    containerClasses,
    panelClasses,
    children,
    vertical = "down",
    horizontal = "right",
    menuLabel,
  }: DropdownProps,
) {
  const isOpen = useSignal(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        isOpen.value = false
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const verticalClass = vertical === "up" ? "bottom-full mb-2" : "top-full mt-2"
  const horizontalClass = horizontal === "left" ? "left-0" : "right-0"
  const originClass = vertical === "up"
    ? (horizontal === "left" ? "origin-bottom-left" : "origin-bottom-right")
    : (horizontal === "left" ? "origin-top-left" : "origin-top-right")

  return (
    <div class={cn("relative inline-flex text-left", containerClasses)} ref={dropdownRef}>
      <button
        onClick={() => isOpen.value = !isOpen.value}
        type="button"
        class={triggerClasses ?? buttonClasses("icon")}
        data-e2e={triggerDataE2E}
        aria-expanded={isOpen.value}
        aria-haspopup="menu"
      >
        {trigger}
      </button>
      <div
        class={cn(
          "absolute z-10 whitespace-nowrap rounded-md bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-gray-600 focus:outline-hidden",
          horizontalClass,
          verticalClass,
          originClass,
          isOpen.value ? "" : "hidden",
          panelClasses,
        )}
        role="menu"
        aria-orientation="vertical"
        aria-label={menuLabel}
      >
        {children}
      </div>
    </div>
  )
}
