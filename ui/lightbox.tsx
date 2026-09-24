/**
 * `Lightbox` — the shared image dialog: one image from a sequence, its description as a caption,
 * labelled previous/next, a "3 of 8" counter, Escape to close, focus back to where it was.
 *
 * `ImageGallery` (`./image-gallery.tsx`) and `system/image-lightbox.tsx`'s content mode are the two
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
 * is open and must exist from the first render (see the Escape-race rule in `AGENTS.md`). A listener
 * on `Modal`'s own children would only ever see a key that bubbled up from whatever is focused
 * inside it, and a `<dialog>` with no autofocus element takes focus on itself first — outside any
 * wrapper this component could listen on. A native `<dialog>` with its own `ref` sidesteps both
 * problems and keeps one dialog implementation serving both ways in, which is what the issue is
 * actually after; what carries over from `Modal` instead is its exported pure focus-restore helpers
 * ({@link shouldRetargetFocus}, {@link restoreFocus}), reused rather than rewritten.
 *
 * **Escape stays native.** The image dialog does not need a refusable close — nothing here asks
 * "are you sure" — so `<dialog>`'s own Escape handling and the `close` event it fires are the whole
 * mechanism, the same choice `system/image-lightbox.tsx`'s dialog already made. Left and Right *do*
 * need a listener, because the platform has no opinion about them: it is attached once, on mount,
 * directly on the `<dialog>` element through a `ref`, and reads `open`/the current index/the total
 * from a ref updated every render rather than closing over a stale one — the same shape
 * `ui/tooltip.tsx`'s Escape listener uses, for the same reason: an effect that (re)attached only
 * once the dialog was open would run after the render that opened it already committed, and a key
 * pressed in that gap would find nothing listening.
 *
 * **The live region is always present.** One `role="status"` region sits inside the dialog whether
 * it is open or not, empty until there is something to say — the rule every announcing component in
 * this library follows (`system/README.md`'s "A live region is always present and empty"). It
 * carries the new image's description together with its position, not the position alone: a reader
 * arrowing through the sequence needs to know what changed, not only where they now are.
 *
 * **An image with no description is not shown.** `alt` is required in {@link LightboxImage}'s type,
 * and {@link describedImages} drops an image whose `alt` is empty after trimming before this
 * component ever renders anything — not the caption, not the counter, not the sequence a reader can
 * arrow into. It does this silently: `alt` is already required by the type, so an empty one only
 * reaches this component at runtime through a caller that bypassed the type system to produce it,
 * and nothing else in this library calls `console.warn` for a value its own type already disallows.
 */

import { cn } from "@preact-components/cn"
import { IconChevronLeft, IconChevronRight, IconXMark } from "@preact-components/icons"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
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
}

/**
 * Keep only the images with a real description.
 *
 * The one rule "an image with no description is not shown" is enforced here, so every caller into
 * this component — {@link Lightbox} itself, `ImageGallery`'s thumbnail strip, and
 * `system/image-lightbox.tsx`'s snapshot of a container's zoomable images — applies exactly the same
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
  /** Accessible name of the dialog. Defaults to `"Image viewer"`. */
  label?: string
  /** Accessible name of the close control. Defaults to `"Close"`. */
  closeLabel?: string
  /** Accessible name of the previous control. Defaults to `"Previous image"`. */
  previousLabel?: string
  /** Accessible name of the next control. Defaults to `"Next image"`. */
  nextLabel?: string
  /** Extra utilities for the dialog element. */
  class?: string
}

const dialogClass =
  "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-black/95 p-0 backdrop:bg-black/80"
const controlClass =
  "absolute z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
// Positioned rather than stretched, exactly like `system/image-lightbox.tsx`'s own image: a child
// that fills the dialog is a backdrop no click can ever land on.
const imageClass =
  "absolute top-1/2 left-1/2 max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 object-contain"
const captionClass =
  "pointer-events-none absolute inset-x-0 bottom-4 mx-auto max-w-[90vw] text-center text-sm text-white/80"

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
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        restoreTarget.current = document.activeElement as FocusableElement | null
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

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

    dialog.addEventListener("keydown", onKeyDown)
    return () => dialog.removeEventListener("keydown", onKeyDown)
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

  const announced = open && current
    ? `${current.alt} — ${counterText(clampedIndex + 1, total)}`
    : ""

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
      class={cn(dialogClass, className)}
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
            class={cn(controlClass, "top-4 right-4")}
          >
            <IconXMark class="size-8" />
          </button>
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => onIndexChange(wrapIndex(clampedIndex, total, -1))}
                aria-label={previousLabel}
                class={cn(controlClass, "top-1/2 left-4 -translate-y-1/2")}
              >
                <IconChevronLeft class="size-8" />
              </button>
              <button
                type="button"
                onClick={() => onIndexChange(wrapIndex(clampedIndex, total, 1))}
                aria-label={nextLabel}
                class={cn(controlClass, "top-1/2 right-4 -translate-y-1/2")}
              >
                <IconChevronRight class="size-8" />
              </button>
            </>
          )}
          <img src={current.src} alt={current.alt} class={imageClass} />
          <p class={captionClass}>{current.alt}</p>
        </>
      )}
    </dialog>
  )
}
