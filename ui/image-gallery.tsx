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
 * A stable key for the thumbnail at `index`: its `src`, plus how many times that `src` already
 * appeared earlier in `images`.
 *
 * Not the image's position on its own — `key={index}` was tried and measured broken in review:
 * removing an *earlier* image shifts every later thumbnail's position down by one, so Preact
 * reconciles each of them against the previous render's *next* thumbnail instead of the same one,
 * and a focused thumbnail — or the lightbox's own focus-restore target, captured by reference at
 * open time — silently lands on a different image. `src` alone is not enough either: two
 * thumbnails can legitimately share one source (the same picture shown twice, captioned
 * differently), and a duplicate key would make Preact treat them as one element.
 *
 * The occurrence count keeps a thumbnail's key stable when the image removed has a *different*
 * `src`, which is the ordinary case this fixes. It is not stable against every removal: two
 * thumbnails sharing one `src` still collide with each other if the earlier one is removed, since
 * the later one's own occurrence count then recomputes to one less than it was. That residual case
 * is narrower than the bug this replaces — it takes two thumbnails sharing a source, not any two
 * thumbnails anywhere in the list — and is not fixed here.
 *
 * @param images The images the strip is drawing thumbnails for, in order.
 * @param index Position of the thumbnail to key, into `images`.
 */
export function thumbnailKey(images: readonly { src: string }[], index: number): string {
  const src = images[index].src
  let occurrence = 0
  for (let i = 0; i < index; i++) {
    if (images[i].src === src) occurrence++
  }
  return `${src}#${occurrence}`
}

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
          <li key={thumbnailKey(shown, index)}>
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
