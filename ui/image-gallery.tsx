/**
 * `ImageGallery` — a strip of thumbnails that opens {@link Lightbox} on the one that was pressed.
 *
 * The second of the two ways into the shared lightbox; `system/image-lightbox.tsx`'s content mode
 * is the other. Both render the same `Lightbox`, so what this component owns is only the strip:
 * which image is open, and turning a thumbnail into a real, keyboard-reachable control.
 *
 * **Thumbnails are real `<button>` elements**, not an image carrying `role="button"` the way
 * `system/image-lightbox.tsx`'s zoomable images do — that component marks up somebody else's
 * `<img>` after the fact and has no `<button>` to reach for; this one draws its own markup and a
 * native button is simpler and gets Enter and Space for free in every real browser. The thumbnail's
 * own `<img>` is `alt=""`: the button already carries the name, through `aria-label`, and a second
 * name on the image inside it would be read twice by some screen readers.
 *
 * **An image with no description is dropped from the strip.** {@link describedImages} is applied to
 * `images` before anything else, and the same filtered list is what `Lightbox` receives — so an
 * index computed against the strip's own thumbnails always lands on the same image inside the
 * dialog, without this component and `Lightbox` running the filter twice and risking disagreement.
 */

import { cn } from "@preact-components/cn"
import type { JSX } from "preact"
import { useState } from "preact/hooks"
import { describedImages, Lightbox, type LightboxImage } from "./lightbox.tsx"

/** One image a gallery's strip can show, and hand to the lightbox it opens. */
export interface ImageGalleryImage extends LightboxImage {
  /**
   * Thumbnail image source. Defaults to `src` — the full image — when left out, so a caller with
   * one image size for both does not have to repeat it.
   */
  thumbSrc?: string
}

export interface ImageGalleryProps {
  /** The images the strip draws thumbnails for, and the lightbox pages through. */
  images: readonly ImageGalleryImage[]
  /** Accessible name of the lightbox dialog. Defaults to `"Image viewer"`. */
  label?: string
  /** Accessible name of the lightbox's close control. Defaults to `"Close"`. */
  closeLabel?: string
  /** Accessible name of the lightbox's previous control. Defaults to `"Previous image"`. */
  previousLabel?: string
  /** Accessible name of the lightbox's next control. Defaults to `"Next image"`. */
  nextLabel?: string
  /**
   * How the lightbox's visible and announced counter reads. Defaults to
   * `` (position, total) => `${position} of ${total}` ``.
   */
  counterLabel?: (position: number, total: number) => string
  /** Extra utilities for the thumbnail strip. */
  class?: string
}

const thumbButtonClass =
  "block cursor-pointer overflow-hidden rounded-md border border-gray-200 transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 dark:border-gray-700"
const thumbImageClass = "size-20 object-cover sm:size-24"

/**
 * A strip of thumbnails that opens the shared {@link Lightbox} on the one pressed.
 */
export function ImageGallery(
  {
    images,
    label,
    closeLabel,
    previousLabel,
    nextLabel,
    counterLabel,
    class: className,
  }: ImageGalleryProps,
): JSX.Element {
  const shown = describedImages(images)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <ul class={cn("flex flex-wrap gap-3", className)}>
        {shown.map((image, index) => (
          // Position, not `image.src`: two thumbnails can legitimately share one source (the same
          // picture shown twice, captioned differently), and a duplicate key there would make
          // Preact's reconciliation treat them as one element instead of two.
          <li key={index}>
            <button
              type="button"
              class={thumbButtonClass}
              aria-label={image.alt}
              onClick={() => setOpenIndex(index)}
            >
              <img src={image.thumbSrc ?? image.src} alt="" class={thumbImageClass} />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        images={shown}
        index={openIndex ?? 0}
        open={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
        label={label}
        closeLabel={closeLabel}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        counterLabel={counterLabel}
      />
    </>
  )
}
