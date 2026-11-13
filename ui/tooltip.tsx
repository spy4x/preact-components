import { cn } from "@spy4x/preact-cn"
import { type Signal, useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"
import { hintBubbleClasses, shiftIntoView } from "./hint-bubble.ts"

/**
 * Side of the trigger the tooltip is anchored to. `start` and `end` are the ends of a line in the
 * reading direction, so they mirror in a right-to-left page; `left` and `right` are their old
 * names and mirror the same way.
 */
export type TooltipPlacement = "top" | "end" | "bottom" | "start" | "right" | "left"

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
  /**
   * Side of the trigger the tooltip is anchored to. Defaults to `"top"`. A side placement opens
   * toward the inline end with `"end"` (`"right"`) and toward the start with `"start"` (`"left"`).
   */
  placement?: TooltipPlacement
  /**
   * Makes the trigger a `<button>`, so the tooltip is reachable without a pointer.
   *
   * Defaults to `true`; pass `false` when the trigger children are themselves interactive (a
   * `<button>`, an `<a>`), so a keyboard user does not land on two stops for one control and one
   * interactive element is not nested inside another. The wrapper is then a `role="group"` around
   * the caller's control, and the first focusable element inside it carries the description.
   */
  focusable?: boolean
  /** Extra utilities for the trigger wrapper. */
  class?: string
  /** Extra utilities for the tooltip surface: its anchoring, its width and its reveal. */
  contentClass?: string
}

const triggerBase =
  "relative inline-flex cursor-help rounded-sm group focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden"

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
const bubbleBase = hintBubbleClasses

/** The first focusable element inside a `focusable={false}` wrapper, which takes the description. */
const controlSelector =
  "button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])"

/** Centred on the trigger in either direction: the half-width shift swaps sign under `rtl:`. */
const centred = "start-1/2 -translate-x-1/2 [&:dir(rtl)]:translate-x-1/2"

/**
 * Where the surface sits, and which of its sides carries the bridge back to the trigger.
 *
 * The padding is the gap: `pb-2` on a surface anchored above the trigger puts 8px of transparent,
 * hoverable surface between the bubble's bottom edge and the trigger's top edge, so the two boxes
 * touch and the pointer never leaves the wrapper on its way from one to the other.
 */
const placementClasses: Record<TooltipPlacement, string> = {
  top: `bottom-full ${centred} pb-2`,
  end: "top-1/2 start-full -translate-y-1/2 ps-2",
  bottom: `top-full ${centred} pt-2`,
  start: "top-1/2 end-full -translate-y-1/2 pe-2",
  right: "top-1/2 start-full -translate-y-1/2 ps-2",
  left: "top-1/2 end-full -translate-y-1/2 pe-2",
}

/**
 * Supplementary hint attached to a trigger, revealed on hover and on keyboard focus.
 *
 * Positioning is CSS first: the wrapper is `relative`, the surface `absolute` plus one of four
 * static anchor utility sets, so the component renders on the server. When the trigger is hovered
 * or focused, the bubble is measured once and the surface slides sideways to stay inside the
 * viewport with an 8 px gutter, the same `shiftIntoView` `ThemeToggle` and `Coachmark` use. There
 * is no scroll listener and no resize listener, so it costs nothing while nobody is on it.
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
 * - **Dismissible.** One `keydown` listener sits on `document` for the component's whole life, and
 *   while the trigger is hovered or focused, Escape hides the surface and drops
 *   `aria-describedby` without moving focus. The listener belongs on `document` because the hint
 *   can be up while focus is elsewhere entirely — that is what hovering means. The key is neither
 *   consumed nor stopped, so whatever else Escape does on that page still happens. The hint
 *   returns on the next fresh hover or focus, not during the one it was dismissed in.
 *
 *   Attached once on mount rather than only while engaged, and reading `hovered`/`focused` at
 *   press time rather than closing over `engaged`: an effect that (re)attaches only once
 *   `engaged` has caught up runs *after* the render an `onPointerEnter`/`onFocusIn` handler
 *   already committed synchronously (`#252`), so an Escape in the same task as the engagement
 *   would have found no listener yet. `system/mobile-panel.ts` fixes the same shape the same way.
 *   The cost is one listener alive for the component's whole life instead of only while engaged;
 *   `pages/checks/ui.ts`'s `tooltipEscapeRaceCheck` is what makes that cost non-negotiable.
 * - **Hoverable.** The surface takes pointer events and the gap to it is padding rather than a
 *   margin, so the pointer can travel onto the hint and rest there while it is read. The accepted
 *   cost: while a hint is up, its box — bridge included — sits over whatever is behind it and
 *   takes the clicks that would have gone there. It is inert again the moment the hint is hidden.
 *
 * With `focusable={false}` the wrapper is a `role="group"` instead, since the caller's control is
 * the interactive element and nesting one inside another is invalid. The group keeps the name,
 * and after hydration the first focusable element inside it gets `aria-describedby`, added to any
 * ids it already has, so a reader hears the hint on the control it is focused on. A server render
 * carries no description until then.
 *
 * Limits, accepted on purpose: the surface slides sideways only. It does not flip to the other
 * side, and nothing moves it up or down, so a `top` hint on a trigger at the very top of the page
 * still runs past it.
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
  const wrapperRef = useRef<HTMLElement>(null)
  const surfaceRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  // Counts engagements from nothing; each one measures the bubble again, after the render that may
  // have just un-hidden a dismissed surface.
  const engagements = useSignal(0)

  // Empty dependency array, deliberately: this attaches once on mount rather than reacting to
  // whether the trigger is engaged, and reads `hovered.value`/`focused.value` straight off the
  // signals at press time instead of closing over a render's value of that condition. See the
  // class doc's "Dismissible" bullet.
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (!hovered.value && !focused.value) return
      dismissed.value = true
    }
    document.addEventListener("keydown", dismiss)

    return () => document.removeEventListener("keydown", dismiss)
  }, [])

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
    if (!hovered.value && !focused.value) {
      dismissed.value = false
      engagements.value++
    }
    channel.value = true
  }

  // Slide the surface sideways so the bubble fits the viewport, before the browser paints it. The
  // bubble is measured where its anchor puts it, with no slide, so a hint that fits again after a
  // resize goes back to centre. A `transform` rather than `translate`: the anchor utilities already
  // set `translate`, and the two properties add up.
  const engagement = engagements.value
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    const bubble = bubbleRef.current
    if (engagement === 0 || !surface || !bubble) return
    surface.style.transform = ""
    const box = bubble.getBoundingClientRect()
    const shift = shiftIntoView(box.left, box.right, document.documentElement.clientWidth)
    if (shift !== 0) surface.style.transform = `translateX(${shift}px)`
  }, [engagement])

  const hidden = dismissed.value

  // With `focusable={false}` the description goes on the caller's control, not on the group. It is
  // added to the ids the control already has and taken off again when the hint is dismissed.
  useEffect(() => {
    if (focusable || hidden) return
    const control = wrapperRef.current?.querySelector(controlSelector)
    if (!control) return
    const own = control.getAttribute("aria-describedby")
    control.setAttribute("aria-describedby", own ? `${own} ${tooltipId}` : tooltipId)
    return () => {
      if (own === null) control.removeAttribute("aria-describedby")
      else control.setAttribute("aria-describedby", own)
    }
  }, [focusable, hidden, tooltipId])

  const surface = (
    <span
      ref={surfaceRef}
      id={tooltipId}
      role="tooltip"
      hidden={hidden}
      class={cn(surfaceBase, placementClasses[placement], contentClass)}
    >
      <span ref={bubbleRef} class={bubbleBase}>{content}</span>
    </span>
  )
  const wrapper = {
    class: cn(triggerBase, className),
    "aria-label": label,
    onPointerEnter: () => engage(hovered),
    onPointerLeave: () => hovered.value = false,
    onFocusIn: () => engage(focused),
    onFocusOut: () => focused.value = false,
  }

  if (!focusable) {
    return (
      <span ref={wrapperRef} role="group" {...wrapper}>
        {children}
        {surface}
      </span>
    )
  }

  return (
    <button type="button" aria-describedby={hidden ? undefined : tooltipId} {...wrapper}>
      {children}
      {surface}
    </button>
  )
}
