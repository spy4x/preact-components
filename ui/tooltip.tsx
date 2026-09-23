import { cn } from "@preact-components/cn"
import { type Signal, useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId } from "preact/hooks"

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
   * Makes the trigger a `<button>`, so the tooltip is reachable without a pointer.
   *
   * Defaults to `true`; pass `false` when the trigger children are themselves interactive (a
   * `<button>`, an `<a>`), so a keyboard user does not land on two stops for one control and one
   * interactive element is not nested inside another. The wrapper is then a `role="group"` around
   * the caller's control; what that costs is on the component's own documentation.
   */
  focusable?: boolean
  /** Extra utilities for the trigger wrapper. */
  class?: string
  /** Extra utilities for the tooltip surface: its anchoring, its width and its reveal. */
  contentClass?: string
}

const triggerBase =
  "relative inline-flex cursor-help rounded-sm group focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden"

/**
 * The anchored surface: where the hint sits, when it is revealed, and the bridge that reaches it.
 *
 * `opacity-0` + `invisible` rather than `hidden`: a `display: none` surface is pruned from the
 * accessibility tree, so `aria-describedby` would have nothing to resolve. `visibility: hidden`
 * also takes the surface out of hit testing, so a hint that is not shown catches no pointer and no
 * click anywhere in its box, bridge included.
 *
 * The surface is transparent and carries no padding of its own beyond that bridge; everything a
 * reader sees is {@link bubbleBase} inside it. The surface **does** take pointer events, which is
 * the point of it: it is a descendant of the trigger wrapper, so a pointer resting on the hint
 * keeps the wrapper's `:hover` and the hint stays up long enough to be read.
 */
const surfaceBase =
  "invisible absolute z-50 w-max max-w-xs opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"

/**
 * The visible bubble, inside the surface.
 *
 * Background, padding, rounding and shadow live here rather than on the surface, which is what
 * lets the gap between trigger and bubble be the surface's padding instead of a margin. A margin
 * would leave dead space between the two, and a pointer crossing dead space leaves the wrapper:
 * the hint would vanish on the way to it, which is no better than not being hoverable at all.
 */
const bubbleBase =
  "block rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-md dark:bg-gray-700"

/**
 * Where the surface sits, and which of its sides carries the bridge back to the trigger.
 *
 * The padding is the gap: `pb-2` on a surface anchored above the trigger puts 8px of transparent,
 * hoverable surface between the bubble's bottom edge and the trigger's top edge, so the two boxes
 * touch and the pointer never leaves the wrapper on its way from one to the other.
 */
const placementClasses: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 pb-2",
  right: "top-1/2 left-full -translate-y-1/2 pl-2",
  bottom: "top-full left-1/2 -translate-x-1/2 pt-2",
  left: "top-1/2 right-full -translate-y-1/2 pr-2",
}

/**
 * Supplementary hint attached to a trigger, revealed on hover and on keyboard focus.
 *
 * Positioning is CSS-only: the wrapper is `relative`, the surface `absolute` plus one of four
 * static anchor utility sets. There is no measurement, no scroll listener and no resize listener,
 * so the component renders on the server and costs nothing while nobody is on it.
 *
 * The wrapper is the described element: it carries `aria-describedby`, and the tooltip surface
 * carries that id and `role="tooltip"`. The trigger keeps its own name through `label`, so the
 * tooltip text is always a description and never the only label. That wrapper is a `<button>`
 * rather than a `<span>` with a tab stop, because `aria-label` on an element with no role is not
 * guaranteed to reach the accessibility tree: the hint used to hang off something that might carry
 * neither a name nor a description.
 *
 * A hint nobody can get rid of and nobody can point at is worse than no hint, so both are handled.
 *
 * - **Dismissible.** While the trigger is hovered or focused, one `keydown` listener sits on
 *   `document`, and Escape hides the surface and drops `aria-describedby` without moving focus.
 *   The listener belongs on `document` because the hint can be up while focus is elsewhere
 *   entirely — that is what hovering means. The key is neither consumed nor stopped, so whatever
 *   else Escape does on that page still happens. The hint returns on the next fresh hover or
 *   focus, not during the one it was dismissed in.
 *
 *   Registering the listener only while the trigger is engaged is a **cost** decision rather than
 *   a behavioural one, and nothing tests it, on purpose: a component that kept one listener for
 *   its whole life would behave identically for every user on every device, since engaging the
 *   trigger clears the dismissed state anyway. What it buys is a page of fifty hints holding no
 *   listeners while nobody is on any of them.
 * - **Hoverable.** The surface takes pointer events and the gap to it is padding rather than a
 *   margin, so the pointer can travel onto the hint and rest there while it is read. The accepted
 *   cost: while a hint is up, its box — bridge included — sits over whatever is behind it and
 *   takes the clicks that would have gone there. It is inert again the moment the hint is hidden.
 *
 * With `focusable={false}` the wrapper is a `role="group"` instead, since the caller's control is
 * the interactive element and nesting one inside another is invalid. The name and the description
 * then belong to that group: a reader that announces a group on entering it reads both, and one
 * that announces only the focused control reads the control's own name. A caller who needs the
 * description on the control itself puts `aria-describedby` there and leaves the layout here.
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
): JSX.Element {
  const tooltipId = useId()
  const hovered = useSignal(false)
  const focused = useSignal(false)
  const dismissed = useSignal(false)
  const engaged = hovered.value || focused.value

  useEffect(() => {
    if (!engaged) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissed.value = true
    }
    document.addEventListener("keydown", dismiss)

    return () => document.removeEventListener("keydown", dismiss)
  }, [engaged])

  /**
   * Mark one channel — the pointer or focus — engaged.
   *
   * A dismissed hint comes back only when the trigger is engaged again from nothing, so releasing
   * one channel while the other still holds it does not resurrect it: hovering a focused trigger,
   * pressing Escape and then moving the pointer away leaves the hint dismissed.
   *
   * @param channel The signal for the channel that just engaged.
   */
  const engage = (channel: Signal<boolean>) => {
    if (!hovered.value && !focused.value) dismissed.value = false
    channel.value = true
  }

  const hidden = dismissed.value
  const surface = (
    <span
      id={tooltipId}
      role="tooltip"
      hidden={hidden}
      class={cn(surfaceBase, placementClasses[placement], contentClass)}
    >
      <span class={bubbleBase}>{content}</span>
    </span>
  )
  const wrapper = {
    class: cn(triggerBase, className),
    "aria-label": label,
    "aria-describedby": hidden ? undefined : tooltipId,
    onPointerEnter: () => engage(hovered),
    onPointerLeave: () => hovered.value = false,
    onFocusIn: () => engage(focused),
    onFocusOut: () => focused.value = false,
  }

  if (!focusable) {
    return (
      <span role="group" {...wrapper}>
        {children}
        {surface}
      </span>
    )
  }

  return (
    <button type="button" {...wrapper}>
      {children}
      {surface}
    </button>
  )
}
