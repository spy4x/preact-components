import { cn } from "@spy4x/preact-cn"
import { IconXMark } from "@spy4x/preact-icons"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX, RefObject } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { type CoachmarkSide, placeCoachmark } from "./coachmark-place.ts"

/** Side of the target a coachmark sits on. */
export type CoachmarkPlacement = CoachmarkSide

/** Why a coachmark asked to close: Escape anywhere on the page, or its own × button. */
export type CoachmarkCloseReason = "escape" | "close"

/**
 * The element a coachmark points at: a CSS selector, which names its first visible match, or a ref
 * the app holds.
 */
export type CoachmarkTarget = string | RefObject<HTMLElement>

export interface CoachmarkProps {
  /** Whether the coachmark is shown. The app owns it. */
  open: boolean
  /** The element the coachmark points at. */
  target: CoachmarkTarget
  /** The heading. It names the coachmark for a screen reader too. */
  title: string
  /** The body. It describes the target, which points at it through `aria-describedby`. */
  children?: ComponentChildren
  /**
   * Side of the target to sit on. Defaults to `"bottom"`; it flips when there is no room there, and
   * shifts along the target to stay inside the viewport.
   */
  placement?: CoachmarkPlacement
  /** Called on Escape and on the × button. The app sets `open` to `false`. */
  onClose: (reason: CoachmarkCloseReason) => void
  /** The × button's accessible name. Defaults to `"Close"`. */
  closeLabel?: string
  /**
   * The label of the button that moves focus to the target, given the target's own name. Defaults
   * to `Go to <name>`, or `"Go to the highlighted control"` when the target has no name.
   */
  goToLabel?: (targetName: string) => string
  /** The coachmark's own controls, such as `Tour`'s Back and Next, between the body and Go to. */
  footer?: ComponentChildren
  /**
   * Ids of more elements inside the coachmark that describe it, after its body: `Tour` passes its
   * step count, so a screen reader announces "Step 1 of 4" with the step's text.
   */
  describedBy?: string
  /** Extra classes for the surface. */
  class?: string
}

/** Below this viewport width, in pixels, a coachmark is drawn as a sheet along the bottom edge. */
const SHEET_BELOW = 640

/** How the surface is laid out: beside the target, at a measured place, or as a sheet. */
type CoachmarkMode = "measured" | "sheet"

/** The surface's inline style while it is placed beside the target. */
const placedStyle = (top: number, left: number) =>
  `inset: auto; top: ${top}px; left: ${left}px; margin: 0;`

const surfaceClasses =
  "w-80 rounded-lg border border-subtle bg-surface pc-focus-offset-surface p-4 text-foreground shadow-popover"

/** The target's outline colour: the chain `theme/preset.css` uses for a button's focus ring. */
const TARGET_RING =
  "var(--color-focus-ring, var(--color-primary-muted, oklch(0.558 0.288 302.321)))"

const defaultGoToLabel = (name: string) => name ? `Go to ${name}` : "Go to the highlighted control"

/** Whether an element can be pointed at: it has a box, and `visibility` does not hide it. */
function isVisible(element: HTMLElement): boolean {
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden"
}

/**
 * The visible element `target` names: for a selector, the first match that is visible, so a control
 * the page draws twice (a rail on a wide screen, a tab bar on a narrow one) is found where it shows.
 * `null` when nothing visible matches, or the selector is invalid.
 */
function resolveTarget(target: CoachmarkTarget): HTMLElement | null {
  if (typeof target !== "string") {
    return target.current !== null && isVisible(target.current) ? target.current : null
  }
  try {
    for (const element of document.querySelectorAll<HTMLElement>(target)) {
      if (isVisible(element)) return element
    }
  } catch {
    // An invalid selector names nothing.
  }
  return null
}

/** Whether a box overlaps the viewport. */
function inViewport(box: DOMRect): boolean {
  return box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth
}

/** The target's accessible name, as far as a Go to label needs it: `aria-label`, else its text. */
function nameOf(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(
    /\s+/g,
    " ",
  )
}

/** What the coachmark changes on the target, as it was before, so it can be put back. */
interface Saved {
  outline: string
  outlineOffset: string
  describedBy: string | null
  addedTabIndex: boolean
}

/**
 * One hint anchored to one element of the page, shown while the app says `open`. `Tour` walks a
 * list of them; an app that wants a single hint uses this alone.
 *
 * The surface is a `popover="manual"` element, so it sits in the top layer above every stacking
 * context with no portal. It sits beside the target, centred on it, and flips to the opposite side
 * when the asked one has no room. The whole of it stays inside the viewport with an 8 px gutter:
 * near an edge or a corner it shifts along the target instead of running past the edge, and when
 * neither side has room it moves over the target. The place is measured with
 * `getBoundingClientRect()` on every animation frame while the coachmark is shown, so it follows a
 * scroll, a resize, a target that moves and a surface that grows; on a fast scroll it can trail the
 * target by a frame. Below 640 px wide, and when the target is missing, hidden or cannot be
 * scrolled into view, the coachmark is a sheet along the bottom edge instead. A selector that
 * matches several elements names the first visible one, found when the coachmark opens or its
 * target changes. The target gets an
 * outline and `aria-describedby` while the coachmark is shown, and each goes back to what it was
 * afterwards.
 *
 * The coachmark is not modal: the page stays usable, and Tab is not trapped. Opening it remembers
 * the focused element and focuses the heading; a new target or title focuses the heading again.
 * The last control, Go to, focuses the target and leaves the coachmark open. Escape anywhere on the
 * page asks to close, unless something already handled it, a modal dialog is open or the key came
 * from inside a dialog, so Escape meant for a `Modal` closes only that. On close, focus goes back
 * to the remembered element, or to the target when that element is gone, but only when focus was
 * in the coachmark, on its target or nowhere: a user who has moved on keeps their place.
 *
 * The dialog is named by its heading and described by its body and `describedBy`. An off-screen
 * target is scrolled into view at once; if the page is still running a smooth scroll of its own,
 * that scroll can win, and the step then shows as a sheet until the target is back on screen.
 */
export function Coachmark(
  {
    open,
    target,
    title,
    children,
    placement = "bottom",
    onClose,
    closeLabel = "Close",
    goToLabel = defaultGoToLabel,
    footer,
    describedBy,
    class: className,
  }: CoachmarkProps,
): JSX.Element {
  const id = useId()
  const headingId = `${id}-title`
  const bodyId = `${id}-body`
  const hasBody = children != null && children !== false
  const surfaceRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  /** The target found when the coachmark last opened or moved, or `null` when there is none. */
  const targetRef = useRef<HTMLElement | null>(null)
  const savedRef = useRef<Saved | null>(null)
  const mode = useSignal<CoachmarkMode>("sheet")
  const spot = useSignal({ top: 0, left: 0 })
  /** The shown target's name for Go to, or `null` when there is no target to go to. */
  const goToName = useSignal<string | null>(null)
  const openRef = useRef(open)
  openRef.current = open
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Open and close: remember focus on open, hand it back on close. Declared first, so on close it
  // runs while the surface is still shown and on open it records focus before the heading takes it.
  useLayoutEffect(() => {
    if (!open) return
    const remembered = document.activeElement
    return () => {
      const active = document.activeElement
      const surface = surfaceRef.current
      const ours = active === null || active === document.body ||
        (surface !== null && surface.contains(active)) || active === targetRef.current
      if (!ours) return
      const back = remembered instanceof HTMLElement && remembered !== document.body &&
        remembered.isConnected
      if (back) remembered.focus()
      else targetRef.current?.focus()
    }
  }, [open])

  // Show the surface and mark the target, for as long as this target is shown.
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!open || surface === null) return
    try {
      if (!surface.matches(":popover-open")) surface.showPopover()
    } catch {
      // No Popover API: the element is laid out in place, which is still readable.
    }
    const element = resolveTarget(target)
    targetRef.current = element
    goToName.value = element === null ? null : nameOf(element)
    if (element === null) {
      console.warn(
        `Coachmark: no visible target for ${
          typeof target === "string" ? `"${target}"` : "the ref"
        }; showing the step as a sheet.`,
      )
    } else {
      savedRef.current = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        describedBy: element.getAttribute("aria-describedby"),
        addedTabIndex: false,
      }
      element.style.outline = `2px solid ${TARGET_RING}`
      element.style.outlineOffset = "2px"
      if (hasBody) {
        const before = savedRef.current.describedBy
        element.setAttribute("aria-describedby", before ? `${before} ${bodyId}` : bodyId)
      }
      if (!inViewport(element.getBoundingClientRect())) {
        element.scrollIntoView({ block: "center", behavior: "instant" })
      }
    }

    // Measured on every frame while shown: a scroll, a resize, a target that moves and a surface
    // that grows all change the place, and no single event or observer reports all four. It reads
    // two boxes and renders only when the place changed.
    let frame = 0
    const layout = () => {
      frame = requestAnimationFrame(layout)
      const current = targetRef.current
      const at = current?.getBoundingClientRect()
      if (!current || !at || innerWidth < SHEET_BELOW || !inViewport(at)) {
        mode.value = "sheet"
        return
      }
      // As a sheet the surface is as wide as the viewport. Give it the placed layout before its
      // size is read; the render that follows writes the same style with the measured place.
      if (mode.value !== "measured") surface.style.cssText = placedStyle(0, 0)
      const { top, left } = placeCoachmark(
        placement,
        at,
        surface.offsetWidth,
        surface.offsetHeight,
        { width: document.documentElement.clientWidth, height: innerHeight },
      )
      mode.value = "measured"
      if (top !== spot.value.top || left !== spot.value.left) spot.value = { top, left }
    }
    layout()

    return () => {
      cancelAnimationFrame(frame)
      const saved = savedRef.current
      if (element !== null && saved !== null) {
        element.style.outline = saved.outline
        element.style.outlineOffset = saved.outlineOffset
        if (saved.describedBy === null) element.removeAttribute("aria-describedby")
        else element.setAttribute("aria-describedby", saved.describedBy)
        if (saved.addedTabIndex) element.removeAttribute("tabindex")
      }
      savedRef.current = null
      targetRef.current = null
      goToName.value = null
      if (!openRef.current) {
        try {
          surface.hidePopover()
        } catch {
          // Not shown, or no Popover API.
        }
      }
    }
  }, [open, target, placement])

  // A new step: focus its heading. After the effect above, so the surface is already shown.
  useLayoutEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true })
  }, [open, target, title])

  // One listener for the component's life, reading `open` at press time (the shape `Tooltip` uses
  // for the race in #252), so an Escape in the same task as opening is not lost.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !openRef.current || event.defaultPrevented) return
      // A dialog's Escape is the dialog's. The dialog may have closed before the key reaches
      // `document`, so a key from inside any dialog is ignored too, not only one while a modal is
      // open.
      if (document.querySelector("dialog:modal") !== null) return
      if (event.target instanceof Element && event.target.closest("dialog") !== null) return
      onCloseRef.current("escape")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const goTo = () => {
    const element = targetRef.current
    if (element === null) return
    if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "-1")
      if (savedRef.current) savedRef.current.addedTabIndex = true
    }
    element.focus()
  }

  const style = mode.value === "measured"
    ? placedStyle(spot.value.top, spot.value.left)
    : "inset: auto 0 0 0; width: 100%; max-width: none; margin: 0;"

  return (
    <div
      ref={surfaceRef}
      popover="manual"
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      aria-describedby={[hasBody ? bodyId : "", describedBy ?? ""].join(" ").trim() || undefined}
      data-coachmark-mode={mode.value}
      style={style}
      class={cn(
        surfaceClasses,
        mode.value === "sheet" && "rounded-b-none border-x-0 border-b-0",
        className,
      )}
    >
      <div class="flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            class="text-base font-semibold"
          >
            {title}
          </h2>
          <Button
            variant="icon"
            size="sm"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={() => onClose("close")}
          >
            <IconXMark class="size-4" />
          </Button>
        </div>
        {hasBody && <div id={bodyId} class="text-sm text-muted">{children}</div>}
        {footer && <div class="flex flex-wrap items-center gap-2">{footer}</div>}
        {goToName.value !== null && (
          <Button variant="ghost" size="sm" class="self-start" onClick={goTo}>
            {goToLabel(goToName.value)}
          </Button>
        )}
      </div>
    </div>
  )
}
