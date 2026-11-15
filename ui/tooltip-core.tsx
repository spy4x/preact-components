import { type Signal, useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"
import { hintBubbleClasses, shiftIntoView } from "./hint-bubble.ts"
import type { TooltipPlacement, TooltipProps } from "./tooltip.tsx"

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
 * `Tooltip`'s whole behaviour, with the function that joins its classes passed in as `merge`.
 *
 * A module of its own, not exported from the package: `Tooltip` passes `cn`, so a caller's `class`
 * and `contentClass` replace the utilities they conflict with, and `CommandPalette` passes `join`,
 * which keeps `tailwind-merge` out of its island bundle. Behaviour and limits: `Tooltip`'s doc.
 */
export function TooltipCore(
  {
    merge,
    children,
    content,
    label,
    placement = "top",
    focusable = true,
    class: className,
    contentClass,
  }: TooltipProps & { merge: (...classes: (string | undefined)[]) => string },
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
  // signals at press time instead of closing over a render's value of that condition. See
  // `Tooltip`'s "Dismissible" bullet.
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
      class={merge(surfaceBase, placementClasses[placement], contentClass)}
    >
      <span ref={bubbleRef} class={bubbleBase}>{content}</span>
    </span>
  )
  const wrapper = {
    class: merge(triggerBase, className),
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
