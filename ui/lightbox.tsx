/**
 * `Lightbox` — the shared image dialog: one image from a sequence, its description as a caption,
 * labelled previous/next, a "3 of 8" counter, Escape to close, focus back to where it was.
 *
 * `ImageGallery` (`./image-gallery.tsx`) and `ZoomableImages` are the two
 * ways into this component — a thumbnail strip and a zoomable image inside a container — and both
 * render this dialog rather than their own. One implementation, so focus handling, the Escape path
 * and the live-region announcement are written once.
 *
 * **Built on a native `<dialog>`, not `ui/Modal`.** The issue that asked for this component wanted
 * `Modal` underneath it, so focus handling would be written once. Two things about `Modal` fight a
 * full-bleed image dialog rather than fitting it. First, `Modal` wraps `children` in a fixed
 * `<div class="px-6 py-4">` with no prop that reaches it, and every other default utility on its
 * `<dialog>` — `max-w-md`, centred, bordered, white — would have to be overridden through `class`
 * one Tailwind group at a time. Second, and the one that actually rules `Modal` out: it renders no
 * ref to its `<dialog>` element, so nothing outside it can attach a listener directly to the dialog
 * itself — which is exactly what Left and Right need, since they must work only while the lightbox
 * is open. A listener on `Modal`'s own children would only ever see a key that bubbled up from
 * whatever is focused inside it, which is one step removed from the dialog itself for no reason a
 * caller of `Modal` controls. A native `<dialog>` with its own `ref` sidesteps both problems and
 * keeps one dialog implementation serving both ways in, which is what the issue is actually after;
 * what carries over from `Modal` instead is its exported pure focus-restore helpers
 * ({@link shouldRetargetFocus}, {@link restoreFocus}), reused rather than rewritten.
 *
 * **Escape stays native.** The image dialog does not need a refusable close — nothing here asks
 * "are you sure" — so `<dialog>`'s own Escape handling and the `close` event it fires are the whole
 * mechanism, the same choice `ZoomableImages`'s dialog already made. Left and Right *do*
 * need a listener, because the platform has no opinion about them: it is attached once, on mount,
 * directly on the `<dialog>` element through a `ref`, and reads `open`/the current index/the total
 * from a ref updated every render rather than closing over a stale one — the same shape
 * `ui/tooltip.tsx`'s Escape listener uses. Measured, not assumed: a listener gated on `open` instead
 * (registered in an effect keyed to it, alongside the `showModal()` effect) turns out **not** to
 * leave a gap here — both effects commit in the same batch, so a key pressed in the same task as
 * the opening click still finds a listener. Attaching on mount is simply the same defensive shape
 * `AGENTS.md`'s Escape-race rule asks for, applied here too, not a fix for a race this component
 * was measured to have.
 *
 * **The counter is visible, not only announced.** A sighted reader sees the same "3 of 8" a screen
 * reader hears — its own small chip, present exactly when the previous/next buttons are, since
 * neither means anything for a single image. {@link LightboxProps.counterLabel} is the one prop
 * that decides its wording, with an English default (`counterText`), so this follows the same label
 * policy every other user-visible string in this library does.
 *
 * **The live region is always present.** One `role="status"` region sits inside the dialog whether
 * it is open or not, empty until there is something to say — the rule every announcing component in
 * this library follows (`system/README.md`'s "A live region is always present and empty"). It
 * carries the new image's description together with its position, not the position alone: a reader
 * arrowing through the sequence needs to know what changed, not only where they now are.
 *
 * **An image with a genuinely empty description is dropped from `images`.** `alt` is required in
 * {@link LightboxImage}'s type, and {@link describedImages} drops one whose `alt` is empty after
 * trimming before this component renders anything for it — not the caption, not the counter, not
 * the sequence a reader can arrow into; {@link LightboxProps.open} is refused the same way when
 * nothing survives the filter. It does this silently: `alt` is already required by the type, so an
 * empty one only reaches this component through a caller that bypassed the type system to produce
 * it, or supplied no description at all, and nothing else in this library calls `console.warn` for a
 * value its own type already disallows. `ZoomableImages` is the one caller
 * where `alt` is *not* usually empty even when the source `<img>` has none: it substitutes its own
 * `fallbackAlt` (default `"Image"`) first, unchanged from before this component existed, so a
 * missing description there still opens and is still captioned — named `"Image"` rather than
 * dropped — unless that substitution is itself turned off with `fallbackAlt=""`.
 *
 * **Controls overlay the image by default, or sit in a row below it** ({@link LightboxProps.controls}).
 * In the row, the image is positioned inside a box that fills the space the row leaves, with
 * `max-h-full`/`max-w-full` resolving against that box, so a tall image fits the viewport whether or
 * not it sits inside a `<picture>`.
 *
 * **Edge controls clear the phone's safe area.** Every control placed against an edge sits at
 * `max(1rem, env(safe-area-inset-*))` from it, which is `1rem` wherever the inset is zero — so a
 * page without `viewport-fit=cover` looks exactly as before — and clears a notch on a phone turned
 * sideways on a page with it.
 *
 * **A horizontal swipe on a touch screen pages through the images**, the same as Left and Right:
 * leftward for the next image, rightward for the previous one. It counts only a single finger that
 * travels at least {@link SWIPE_MIN_PX} sideways and more sideways than up or down, so a pinch or a
 * vertical drag does nothing. Touch events rather than pointer events: the browser cancels a pointer
 * the moment it starts a pan of its own, and a touch still ends.
 */

import { join } from "@spy4x/preact-cn/join"
import { IconChevronLeft, IconChevronRight, IconXMark } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useEffect, useLayoutEffect, useRef } from "preact/hooks"
import { type FocusableElement, restoreFocus, shouldRetargetFocus } from "./modal.tsx"

/** One image a {@link Lightbox} can show. */
export interface LightboxImage {
  /** Where the browser loads the full image from. */
  src: string
  /**
   * The image's description, shown as the caption and announced with the counter. Required: an
   * image whose `alt`, trimmed, is empty is dropped by {@link describedImages} before it reaches
   * this component's rendered sequence at all.
   */
  alt: string
  /**
   * The same image as WebP. When set, the image renders inside a `<picture>` with this as its
   * `image/webp` source and `src` as the fallback for a browser without WebP.
   */
  webpSrc?: string
}

/**
 * Keep only the images with a real description.
 *
 * The one rule "an image with no description is not shown" is enforced here, so every caller into
 * this component — {@link Lightbox} itself, `ImageGallery`'s thumbnail strip, and
 * `ZoomableImages`'s snapshot of a container's zoomable images — applies exactly the same
 * predicate to the same prop shape rather than three of them slowly drifting apart. Generic over
 * `LightboxImage` so a caller whose images carry extra fields — `ImageGalleryImage.thumbSrc`, for
 * one — gets that field back on the images that survive, rather than the base shape.
 *
 * @param images Candidate images, in order.
 * @returns The images whose `alt`, trimmed, is not empty — same order, same objects.
 */
export function describedImages<T extends LightboxImage>(images: readonly T[]): T[] {
  return images.filter((image) => image.alt.trim() !== "")
}

/**
 * Move `delta` steps through a sequence of `total` items, wrapping at either end.
 *
 * Pure, so the wrap-around arithmetic Left/Right and the previous/next buttons share is one
 * unit-tested function rather than four copies of a modulo. `total <= 0` has nowhere to move to and
 * answers `0`.
 *
 * @param index Current position, `0`-based.
 * @param total Length of the sequence.
 * @param delta Steps to move; negative moves backward. Not restricted to `±1`, though this
 * component only ever calls it with one.
 * @returns The new position, wrapped into `0…total-1`.
 */
export function wrapIndex(index: number, total: number, delta: number): number {
  if (total <= 0) return 0
  return ((index + delta) % total + total) % total
}

/**
 * The counter text, e.g. `"3 of 8"` — what the issue this component implements asks for by name.
 *
 * @param position `1`-based position in the sequence.
 * @param total Length of the sequence.
 */
export function counterText(position: number, total: number): string {
  return `${position} of ${total}`
}

/** How far, in CSS pixels, one finger must travel sideways for a swipe to change the image. */
export const SWIPE_MIN_PX = 50

/**
 * The step a finished touch asks for: `1` for a leftward swipe (next image), `-1` for a rightward
 * one (previous image), `0` for anything that is not a swipe.
 *
 * @param dx Horizontal travel from touch start to touch end, in CSS pixels; negative is leftward.
 * @param dy Vertical travel over the same touch.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

export interface LightboxProps {
  /**
   * The sequence a reader can arrow through. Filtered through {@link describedImages} before
   * anything else happens, so `index` below is a position into the *filtered* list — compute it
   * against the same function over the same source array, which is what both callers in this
   * repository do, and the two can never disagree about where an image landed.
   */
  images: readonly LightboxImage[]
  /** Position of the image currently shown, into `images` after {@link describedImages} filters it. */
  index: number
  /** Whether the dialog is open. */
  open: boolean
  /** Close-request port: a real Escape press, a backdrop click, or the close control. */
  onClose: () => void
  /** Called with the new position when Left/Right or the previous/next buttons are used. */
  onIndexChange: (index: number) => void
  /**
   * Accessible name of the dialog. Defaults to `"Image viewer"`. A function names the dialog after
   * the image it shows, and the name follows Previous and Next: `(image) => image.alt`.
   */
  label?: string | ((image: LightboxImage, position: number, total: number) => string)
  /** Accessible name of the close control. Defaults to `"Close"`. */
  closeLabel?: string
  /** Accessible name of the previous control. Defaults to `"Previous image"`. */
  previousLabel?: string
  /** Accessible name of the next control. Defaults to `"Next image"`. */
  nextLabel?: string
  /**
   * How the counter reads, both in its own visible chip and as the tail of the live-region
   * announcement — the label policy in `AGENTS.md` (every user-visible string has an English
   * default and an override prop) applied to the "3 of 8" the issue asks for by name. Defaults to
   * {@link counterText}: `` (position, total) => `${position} of ${total}` ``.
   */
  counterLabel?: (position: number, total: number) => string
  /**
   * Where the counter and the previous/next buttons go: `"overlay"` floats them over the image
   * (the default), `"below"` puts them in one row under the image and its caption.
   */
  controls?: "overlay" | "below"
  /**
   * Whether the image's `alt` shows as a visible caption. Defaults to `true`. With `false` the
   * caption is left out; the `alt` still names the image and is still announced with the counter.
   */
  caption?: boolean
  /**
   * Extra utilities for the dialog element, appended after its own and not merged into them. To
   * replace one of its own utilities, mark the replacement important with a trailing `!`.
   */
  class?: string
}

const dialogClass =
  "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-scrim-strong p-0 backdrop:bg-scrim-strong"
const buttonClass =
  "cursor-pointer rounded-full bg-scrim p-2 text-on-scrim-muted transition-colors hover:text-scrim-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-scrim-foreground)"
const controlClass = join("absolute z-10", buttonClass)
// `max(1rem, env(safe-area-inset-*))`: today's `1rem` wherever there is no inset to clear.
const safeTop = "top-[max(--spacing(4),env(safe-area-inset-top,0px))]"
const safeRight = "right-[max(--spacing(4),env(safe-area-inset-right,0px))]"
const safeLeft = "left-[max(--spacing(4),env(safe-area-inset-left,0px))]"
const safeBottom = "bottom-[max(--spacing(4),env(safe-area-inset-bottom,0px))]"
// Positioned rather than stretched, exactly like `ZoomableImages`'s own image: a child
// that fills the dialog is a backdrop no click can ever land on.
const imageClass =
  "absolute top-1/2 left-1/2 max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 object-contain"
const captionClass =
  `pointer-events-none absolute inset-x-0 ${safeBottom} mx-auto max-w-[90vw] text-center text-sm text-on-scrim-muted`
const chipClass = "rounded-full bg-scrim px-3 py-1 text-xs text-on-scrim-muted"
const counterClass = `pointer-events-none absolute inset-x-0 ${safeTop} mx-auto w-fit ${chipClass}`
// The row layout. The column lets clicks through to the dialog, so a click on empty space still
// lands on the backdrop and closes it; only the image and the row take clicks back.
// Positioned rather than padded, so the safe-area insets stay positions: it starts below the close
// button (its `1rem` offset plus its 3rem height) and keeps the same distance from the other edges.
const columnClass = join(
  "pointer-events-none absolute flex flex-col items-center gap-3",
  "top-[calc(max(--spacing(4),env(safe-area-inset-top,0px))+--spacing(12))]",
  safeRight,
  safeBottom,
  safeLeft,
)
const stageClass = "relative min-h-0 w-full flex-1"
const stageImageClass =
  "pointer-events-auto absolute inset-0 m-auto max-h-full max-w-full object-contain"
const belowCaptionClass = "max-w-[90vw] text-center text-sm text-on-scrim-muted"
const rowClass = "pointer-events-auto flex items-center gap-3"

/** What the mount-time keydown listener reads at press time, kept current every render. */
interface LatestState {
  open: boolean
  index: number
  total: number
  onIndexChange: (index: number) => void
}

/**
 * The shared image dialog — see the module doc for what it is built on and why.
 */
export function Lightbox(
  {
    images,
    index,
    open,
    onClose,
    onIndexChange,
    label = "Image viewer",
    closeLabel = "Close",
    previousLabel = "Previous image",
    nextLabel = "Next image",
    counterLabel = counterText,
    controls = "overlay",
    caption = true,
    class: className,
  }: LightboxProps,
): JSX.Element {
  const shown = describedImages(images)
  const total = shown.length
  const clampedIndex = total > 0 ? Math.min(Math.max(Math.trunc(index), 0), total - 1) : 0
  const current = total > 0 ? shown[clampedIndex] : null

  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreTarget = useRef<FocusableElement | null>(null)
  const latest = useRef<LatestState>({ open, index: clampedIndex, total, onIndexChange })
  latest.current = { open, index: clampedIndex, total, onIndexChange }

  // Open/close lifecycle. `showModal()`/`close()` only, never the `open` attribute — a dialog
  // carrying it is non-modal and `showModal()` on it throws, the same measured fact `ui/modal.tsx`
  // documents. The trigger is captured here, before focus moves, so it can be restored on close.
  //
  // Gated on `total > 0` as well as `open`: `open` is the caller's own state, and a caller can ask
  // for a dialog over a sequence that has nothing left in it — every image dropped by
  // `describedImages`, or `images` empty to begin with. Showing a modal then would be a full-screen
  // dialog with no image, no caption and no close control, since the content below only renders
  // when `current` is not `null`. Refusing here is the same rule as refusing to render an
  // undescribed image applied one level up, to the dialog itself rather than to one image in it.
  //
  // A layout effect, so the dialog is open as soon as the render the click started has run: a
  // caller that reads `dialog[open]` right after its click must not wait for the next paint.
  const canOpen = open && total > 0
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (canOpen) {
      if (!dialog.open) {
        restoreTarget.current = document.activeElement as FocusableElement | null
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [canOpen])

  // Left/Right, attached once on mount rather than only while open, and reading `latest.current`
  // at press time rather than closing over this render's values — see the module doc's "Escape
  // stays native" paragraph for why this one listener exists and where it lives.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onKeyDown = (event: KeyboardEvent) => {
      const state = latest.current
      if (!state.open || state.total <= 1) return
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        state.onIndexChange(wrapIndex(state.index, state.total, -1))
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        state.onIndexChange(wrapIndex(state.index, state.total, 1))
      }
    }

    // A swipe, tracked from the first finger down to the last one up. A second finger at any point
    // makes it a pinch, which never pages.
    let start: { x: number; y: number } | null = null
    const onTouchStart = (event: TouchEvent) => {
      start = event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null
    }
    const onTouchEnd = (event: TouchEvent) => {
      const state = latest.current
      const touch = event.changedTouches[0]
      if (!start || !touch || event.touches.length > 0) return
      const step = swipeStep(touch.clientX - start.x, touch.clientY - start.y)
      start = null
      if (!state.open || state.total <= 1 || step === 0) return
      state.onIndexChange(wrapIndex(state.index, state.total, step))
    }
    const onTouchCancel = () => {
      start = null
    }

    dialog.addEventListener("keydown", onKeyDown)
    dialog.addEventListener("touchstart", onTouchStart, { passive: true })
    dialog.addEventListener("touchend", onTouchEnd, { passive: true })
    dialog.addEventListener("touchcancel", onTouchCancel, { passive: true })
    return () => {
      dialog.removeEventListener("keydown", onKeyDown)
      dialog.removeEventListener("touchstart", onTouchStart)
      dialog.removeEventListener("touchend", onTouchEnd)
      dialog.removeEventListener("touchcancel", onTouchCancel)
    }
  }, [])

  // The restore itself is measured, not merely hoped for, and the measurement is the same one
  // `ui/modal.tsx`'s own `#148` paragraph records: the browser `pages/checks/ui.ts` drives hands
  // focus back to the pre-`showModal()` element by itself, so deleting the `restoreFocus` call
  // below and re-running `imageGalleryChecks` left its focus-return check green — Chromium restored
  // focus on its own. The call stays anyway, for an engine that does not, and costs nothing beyond a
  // `focus()` on an element that already has it.
  const handleClose = () => {
    onClose()
    if (shouldRetargetFocus(restoreTarget.current)) restoreFocus(restoreTarget.current)
    restoreTarget.current = null
  }

  // The counter portion is only part of the announcement — and only rendered as its own visible
  // chip below — once there is more than one image to be "N of" anything: the previous/next
  // buttons are gated on the same `total > 1`, so the two appear and disappear together.
  const counter = total > 1 ? counterLabel(clampedIndex + 1, total) : ""
  const announced = open && current ? `${current.alt}${counter ? ` — ${counter}` : ""}` : ""

  return (
    <dialog
      ref={dialogRef}
      aria-label={typeof label === "function"
        ? current ? label(current, clampedIndex + 1, total) : "Image viewer"
        : label}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
      class={join(dialogClass, className)}
    >
      {
        /* Always present, empty until there is something to say — see the module doc. */
      }
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announced}
      </div>
      {open && current && (
        <>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={closeLabel}
            class={join(controlClass, safeTop, safeRight)}
          >
            <IconXMark class="size-8" />
          </button>
          {controls === "below"
            ? (
              <div class={columnClass}>
                <div class={stageClass}>{picture(current, stageImageClass)}</div>
                {caption && <p class={belowCaptionClass}>{current.alt}</p>}
                {total > 1 && (
                  <div class={rowClass}>
                    <button
                      type="button"
                      onClick={() => onIndexChange(wrapIndex(clampedIndex, total, -1))}
                      aria-label={previousLabel}
                      class={buttonClass}
                    >
                      <IconChevronLeft class="size-8" />
                    </button>
                    <p class={chipClass}>{counter}</p>
                    <button
                      type="button"
                      onClick={() => onIndexChange(wrapIndex(clampedIndex, total, 1))}
                      aria-label={nextLabel}
                      class={buttonClass}
                    >
                      <IconChevronRight class="size-8" />
                    </button>
                  </div>
                )}
              </div>
            )
            : (
              <>
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onIndexChange(wrapIndex(clampedIndex, total, -1))}
                      aria-label={previousLabel}
                      class={join(controlClass, "top-1/2 -translate-y-1/2", safeLeft)}
                    >
                      <IconChevronLeft class="size-8" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onIndexChange(wrapIndex(clampedIndex, total, 1))}
                      aria-label={nextLabel}
                      class={join(controlClass, "top-1/2 -translate-y-1/2", safeRight)}
                    >
                      <IconChevronRight class="size-8" />
                    </button>
                  </>
                )}
                {counter && <p class={counterClass}>{counter}</p>}
                {picture(current, imageClass)}
                {caption && <p class={captionClass}>{current.alt}</p>}
              </>
            )}
        </>
      )}
    </dialog>
  )
}

/**
 * The image element, wrapped in a `<picture>` with a WebP source when the image has one.
 *
 * @param image The image to render.
 * @param className Utilities for the `<img>`; the `<picture>` stays an unstyled inline box, so the
 * `<img>` is positioned against the same ancestor either way.
 */
function picture(image: LightboxImage, className: string): JSX.Element {
  const img = <img src={image.src} alt={image.alt} class={className} />
  if (!image.webpSrc) return img
  return (
    <picture>
      <source type="image/webp" srcset={image.webpSrc} />
      {img}
    </picture>
  )
}
