import { cn } from "@preact-components/cn"
import type { ComponentChildren } from "preact"
import { useId } from "preact/hooks"

/** Side of the trigger the tooltip is anchored to. */
export type TooltipPlacement = "top" | "right" | "bottom" | "left"

export interface TooltipProps {
  /** Visible content of the trigger. It also carries the trigger's accessible name. */
  children: ComponentChildren
  /** Tooltip text. Supplementary to {@link TooltipProps.label}, never the trigger's only name. */
  content: ComponentChildren
  /**
   * Accessible name for the trigger, applied as `aria-label`.
   *
   * Required, so the trigger always has a name of its own. Screen readers announce it first and
   * the tooltip only as the description.
   */
  label: string
  /** Side of the trigger the tooltip is anchored to. Defaults to `"top"`. */
  placement?: TooltipPlacement
  /**
   * Makes the trigger wrapper a tab stop, so the tooltip is reachable without a pointer.
   *
   * Defaults to `true`; pass `false` when the trigger children are themselves interactive (a
   * `<button>`, an `<a>`) so a keyboard user does not land on two stops for one control.
   */
  focusable?: boolean
  /** Extra utilities for the trigger wrapper. */
  class?: string
  /** Extra utilities for the tooltip surface. */
  contentClass?: string
}

const triggerBase =
  "relative inline-flex cursor-help rounded-sm group focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden"

/**
 * Rounded surface, no pointer events and visually hidden until the trigger is hovered or focused.
 *
 * `opacity-0` + `invisible` rather than `hidden`: a `display: none` surface is pruned from the
 * accessibility tree, so `aria-describedby` would have nothing to resolve.
 */
const surfaceBase =
  "pointer-events-none invisible absolute z-50 w-max max-w-xs rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:bg-gray-700"

const placementClasses: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  right: "top-1/2 left-full ml-2 -translate-y-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "top-1/2 right-full mr-2 -translate-y-1/2",
}

/**
 * Supplementary hint attached to a trigger, revealed on hover and on keyboard focus.
 *
 * Positioning is CSS-only: the wrapper is `relative`, the surface `absolute` plus one of four
 * static anchor utility sets. There is no measurement, no scroll or resize listener and no
 * `document` access, so the component is fully server-renderable and costs nothing at runtime.
 *
 * The wrapper is the described element: it carries `aria-describedby`, and the tooltip surface
 * carries that id and `role="tooltip"`. The trigger keeps its own name through `label`, so the
 * tooltip text is always a description and never the only label.
 *
 * Limits, accepted on purpose: anchored placement means the surface can overflow the viewport at
 * an edge, and it does not flip or clamp. Nothing in this repository needs that — every anchored
 * popup here (`Dropdown`, `CopyButton`'s `title`, `GeoButton`) uses a static anchor too — and a
 * collision pass would cost layout reads on every reveal.
 */
export function Tooltip(
  {
    children,
    content,
    label,
    placement = "top",
    focusable = true,
    class: className,
    contentClass,
  }: TooltipProps,
) {
  const tooltipId = useId()

  return (
    <span
      class={cn(triggerBase, className)}
      tabindex={focusable ? 0 : undefined}
      aria-label={label}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        class={cn(surfaceBase, placementClasses[placement], contentClass)}
      >
        {content}
      </span>
    </span>
  )
}
