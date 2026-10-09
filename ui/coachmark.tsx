import { cn } from "@spy4x/preact-cn"
import { IconXMark } from "@spy4x/preact-icons"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX, RefObject } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { COACHMARK_GAP, type CoachmarkSide, placeCoachmark } from "./coachmark-place.ts"

/** Side of the target a coachmark sits on. */
export type CoachmarkPlacement = CoachmarkSide

/** Why a coachmark asked to close: Escape anywhere on the page, or its own × button. */
export type CoachmarkCloseReason = "escape" | "close"

/** The element a coachmark points at: a CSS selector, or a ref the app holds. */
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
  /** Side of the target to sit on. Defaults to `"bottom"`; it flips when there is no room there. */
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

/** How the surface is laid out: beside the target by CSS or by measurement, or as a sheet. */
type CoachmarkMode = "anchor" | "measured" | "sheet"

const surfaceClasses =
  "w-80 rounded-lg border border-subtle bg-surface pc-focus-offset-surface p-4 text-foreground shadow-popover"

/** The target's outline colour: the chain `theme/preset.css` uses for a button's focus ring. */
const TARGET_RING =
  "var(--color-focus-ring, var(--color-primary-muted, oklch(0.558 0.288 302.321)))"

const defaultGoToLabel = (name: string) => name ? `Go to ${name}` : "Go to the highlighted control"

/** The element `target` names, or `null` when it names nothing, or names an invalid selector. */
function resolveTarget(target: CoachmarkTarget): HTMLElement | null {
  if (typeof target !== "string") return target.current
  try {
    return document.querySelector<HTMLElement>(target)
  } catch {
    return null
  }
}

/** Whether a box overlaps the viewport. */
function inViewport(box: DOMRect): boolean {
  return box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth
}

/** Whether this browser lays out `position-anchor`. Read at use, so a check can switch it off. */
function anchorSupported(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" &&
    CSS.supports("anchor-name: --a")
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
  anchorName: string
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
 * context with no portal. It is placed beside the target by CSS anchor positioning, which flips it
 * when there is no room. A browser without anchor positioning gets the same placement measured
 * with `getBoundingClientRect()`, again on scroll and resize. Below 640 px wide, and when the
 * target is missing, has no box or cannot be scrolled into view, the coachmark is a sheet along the
 * bottom edge instead. The target gets an outline, `anchor-name` and `aria-describedby` while the
 * coachmark is shown, and each goes back to what it was afterwards.
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
  const anchorName = `--pc-anchor-${typeof CSS !== "undefined" ? CSS.escape(id) : id}`
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
    const candidate = resolveTarget(target)
    const box = candidate?.getBoundingClientRect()
    const element = candidate !== null && box !== undefined && box.width > 0 && box.height > 0
      ? candidate
      : null
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
        anchorName: element.style.getPropertyValue("anchor-name"),
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        describedBy: element.getAttribute("aria-describedby"),
        addedTabIndex: false,
      }
      // Keep any anchor name the app gave the target, so its own anchored elements stay put.
      const others = getComputedStyle(element).getPropertyValue("anchor-name").trim()
      element.style.setProperty(
        "anchor-name",
        others && others !== "none" ? `${others}, ${anchorName}` : anchorName,
      )
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

    let frame = 0
    const layout = () => {
      frame = 0
      const current = targetRef.current
      const at = current?.getBoundingClientRect()
      if (!current || !at || innerWidth < SHEET_BELOW || !inViewport(at)) {
        mode.value = "sheet"
      } else if (anchorSupported()) {
        mode.value = "anchor"
      } else {
        mode.value = "measured"
        const view = { width: document.documentElement.clientWidth, height: innerHeight }
        const { top, left } = placeCoachmark(
          placement,
          at,
          surface.offsetWidth,
          surface.offsetHeight,
          view,
        )
        spot.value = { top, left }
      }
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(layout)
    }
    layout()
    // A measured surface has its real size only after the mode's render, so measure once more.
    schedule()
    addEventListener("scroll", schedule, { capture: true, passive: true })
    addEventListener("resize", schedule, { passive: true })

    return () => {
      removeEventListener("scroll", schedule, { capture: true })
      removeEventListener("resize", schedule)
      if (frame !== 0) cancelAnimationFrame(frame)
      const saved = savedRef.current
      if (element !== null && saved !== null) {
        const restore = (name: string, value: string) =>
          value ? element.style.setProperty(name, value) : element.style.removeProperty(name)
        restore("anchor-name", saved.anchorName)
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

  const style = mode.value === "anchor"
    ? `position-anchor: ${anchorName}; position-area: ${placement}; ` +
      `position-try-fallbacks: flip-block, flip-inline; inset: auto; margin: ${COACHMARK_GAP}px;`
    : mode.value === "measured"
    ? `inset: auto; top: ${spot.value.top}px; left: ${spot.value.left}px; margin: 0;`
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
