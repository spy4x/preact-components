/**
 * `ImageGallery` — a strip of thumbnails that opens {@link Lightbox} on the one that was pressed.
 *
 * The second of the two ways into the shared lightbox; `ZoomableImages`
 * is the other. Both render the same `Lightbox`, so what this component owns is only the strip:
 * which image is open, and turning a thumbnail into a real, keyboard-reachable control.
 *
 * **Thumbnails are real `<button>` elements**, not an image carrying `role="button"` the way
 * `ZoomableImages`'s zoomable images do — that component marks up somebody else's
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

import { join } from "@spy4x/preact-cn/join"
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
  /**
   * Where the lightbox puts its counter and previous/next buttons: over the image (`"overlay"`, the
   * default) or in a row below it (`"below"`).
   */
  controls?: "overlay" | "below"
  /**
   * How the images are laid out: a wrapping grid of small square thumbnails (`"grid"`, the default)
   * or one row of large, uncropped images that scrolls sideways and snaps to each image
   * (`"strip"`), for a hero or case-study gallery. The strip shows each image's full `src`, since
   * its images are large; `thumbSrc` is for the grid.
   */
  layout?: "grid" | "strip"
  /**
   * Extra utilities for the thumbnail strip, appended after its own and not merged into them. To
   * replace one of its own utilities, mark the replacement important with a trailing `!`.
   */
  class?: string
}

const thumbButtonClass =
  "block cursor-pointer overflow-hidden rounded-md border border-subtle transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
const thumbImageClass = "size-20 object-cover sm:size-24"

/**
 * The strip's row. It scrolls sideways and snaps each image's start to the row's start. The `p-1`
 * keeps a focused image's ring (2px, offset by 2px) inside the row, which would otherwise clip it,
 * and `scroll-px-1` snaps to that padding rather than to the row's edge. There is no smooth
 * scrolling: the row moves instantly, so the reduced-motion preference has nothing to stop.
 */
const stripListClass = "flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto p-1"
/** One image of the strip: most of the row's width, so the next image peeks in at the edge. */
const stripItemClass = "w-5/6 shrink-0 snap-start sm:w-2/3"
const stripButtonClass = join(thumbButtonClass, "w-full")
const stripImageClass = "block h-auto w-full"

/**
 * Bring a focused strip image wholly into view, its start on the row's snap point. Chromium scrolls
 * a focused element only when none of it is visible, so Tab onto the half-shown next image would
 * otherwise leave it half-shown. `inline: "start"` is the snap position itself, so snapping does not
 * pull the row back; `block: "nearest"` moves the page only when the row is off screen. The scroll
 * follows the row's own `scroll-behavior`, which the strip leaves instant.
 */
function revealInStrip(event: JSX.TargetedFocusEvent<HTMLButtonElement>): void {
  event.currentTarget.scrollIntoView({ block: "nearest", inline: "start" })
}

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
 * Thumbnails that open the shared {@link Lightbox} on the one pressed: a wrapping grid by default,
 * or a sideways-scrolling, snapping row of large images with `layout="strip"`.
 */
export function ImageGallery(
  {
    images,
    label,
    closeLabel,
    previousLabel,
    nextLabel,
    counterLabel,
    controls,
    layout = "grid",
    class: className,
  }: ImageGalleryProps,
): JSX.Element {
  const shown = describedImages(images)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const strip = layout === "strip"

  return (
    <>
      <ul class={join(strip ? stripListClass : "flex flex-wrap gap-3", className)}>
        {shown.map((image, index) => (
          <li key={thumbnailKey(shown, index)} class={strip ? stripItemClass : undefined}>
            <button
              type="button"
              class={strip ? stripButtonClass : thumbButtonClass}
              aria-label={image.alt}
              onClick={() =>
                setOpenIndex(index)}
              onFocus={strip ? revealInStrip : undefined}
            >
              <img
                src={strip ? image.src : image.thumbSrc ?? image.src}
                alt=""
                class={strip ? stripImageClass : thumbImageClass}
              />
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
        controls={controls}
      />
    </>
  )
}
