import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { TooltipCore } from "./tooltip-core.tsx"

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
export function Tooltip(props: TooltipProps): JSX.Element {
  return <TooltipCore {...props} merge={cn} />
}
