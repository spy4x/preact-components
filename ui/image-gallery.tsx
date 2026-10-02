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
 * name on the image inside it would be read twice by some screen readers. A strip with `captions`
 * turns that around: the image carries its `alt`, which names the button, and the button has no
 * `aria-label`, so the visible caption and the button's name are the same text.
 *
 * **The strip's navigation is measured, not assumed.** The counter under the row and the
 * Previous/Next buttons read the row's scroll position and size in the browser
 * ({@link stripPosition}); a server render shows the counter at the first slide and no buttons,
 * since it cannot know whether the row will overflow. The buttons scroll instantly, like the rest
 * of the strip, and at either end they stay focusable with `aria-disabled` rather than `disabled`,
 * so a keyboard press that reaches the end does not drop focus to the page.
 *
 * **An image with no description is dropped from the strip.** {@link describedImages} is applied to
 * `images` before anything else, and the same filtered list is what `Lightbox` receives — so an
 * index computed against the strip's own thumbnails always lands on the same image inside the
 * dialog, without this component and `Lightbox` running the filter twice and risking disagreement.
 */

import { join } from "@spy4x/preact-cn/join"
import { IconChevronLeft, IconChevronRight } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { Button } from "./button.tsx"
import {
  counterText,
  describedImages,
  Lightbox,
  type LightboxImage,
  type LightboxProps,
} from "./lightbox.tsx"

/** One image a gallery's strip can show, and hand to the lightbox it opens. */
export interface ImageGalleryImage extends LightboxImage {
  /**
   * Thumbnail image source. Defaults to `src` — the full image — when left out, so a caller with
   * one image size for both does not have to repeat it.
   */
  thumbSrc?: string
  /**
   * The full image's intrinsic width in pixels, with `height`. A strip renders both on its `<img>`,
   * so the browser reserves the image's height before it loads and nothing below the strip moves
   * when it arrives. The grid ignores them: its thumbnails are fixed-size squares already.
   */
  width?: number
  /** The full image's intrinsic height in pixels, with `width`. */
  height?: number
}

export interface ImageGalleryProps {
  /** The images the strip draws thumbnails for, and the lightbox pages through. */
  images: readonly ImageGalleryImage[]
  /**
   * Accessible name of the lightbox dialog. Defaults to `"Image viewer"`. A function names it after
   * the image it shows, as `Lightbox`'s own `label` does: `(image) => image.alt`.
   */
  label?: LightboxProps["label"]
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
   * Whether the lightbox shows the image's `alt` as a visible caption. Defaults to `true`; see
   * `Lightbox`'s `caption`.
   */
  lightboxCaption?: boolean
  /** Strip only: the name of the row's Previous button. Defaults to `previousLabel`. */
  stripPreviousLabel?: string
  /** Strip only: the name of the row's Next button. Defaults to `nextLabel`. */
  stripNextLabel?: string
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
   * Strip only: the strip is the page's hero, so its first image is likely the largest thing on the
   * first screen. That image loads with `loading="eager"` and `fetchpriority="high"`; every later
   * one with `loading="lazy"` and `decoding="async"`. Defaults to `false`.
   */
  hero?: boolean
  /**
   * Strip only: show each image's `alt` as a visible caption (`<figcaption>`) under it. The image
   * then carries the same text as its own `alt`, and that is what names its button. Defaults to
   * `false`: the button is named through `aria-label` and the image is decorative.
   */
  captions?: boolean
  /**
   * Strip only: a counter under the row that follows the slide in view, worded by `counterLabel`,
   * and Previous/Next buttons, named by `stripPreviousLabel` and `stripNextLabel` (by default
   * `previousLabel` and `nextLabel`), that scroll the row by one slide. The buttons render only
   * while the row is wider than its box. The row carries `data-gallery-strip` and the counter
   * `data-gallery-counter`, stable hooks for an app's tests and styles. Defaults to `false`.
   */
  navigation?: boolean
  /**
   * Strip only: where a slide snaps to, the row's start (`"start"`, the default) or its centre
   * (`"center"`).
   */
  snap?: "start" | "center"
  /**
   * Strip only: how wide a slide is. `"wide"` (the default) gives each slide most of the row, so
   * the next one peeks in. `"orientation"` does the same when the first image is landscape, and
   * gives narrower slides when its `width` and `height` say it is portrait, so a phone screenshot
   * does not fill the column.
   */
  slideWidth?: "wide" | "orientation"
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
 * The strip's row. It scrolls sideways and snaps each image to the row's start, or with
 * `snap="center"` to its centre. The `p-1`
 * keeps a focused image's ring (2px, offset by 2px) inside the row, which would otherwise clip it,
 * and `scroll-px-1` snaps to that padding rather than to the row's edge. There is no smooth
 * scrolling: the row moves instantly, so the reduced-motion preference has nothing to stop.
 */
const stripListClass = "flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto p-1"
/** One image of the strip: most of the row's width, so the next image peeks in at the edge. */
const stripItemClass = "w-5/6 shrink-0 snap-start sm:w-2/3"
/** A slide's width with `slideWidth="orientation"` and a portrait first image: about a third. */
const portraitWidthClass = "w-11/20 sm:w-7/20 lg:w-2/7"

/**
 * A strip slide's classes. The default, start-snapped and wide, is the one string the strip has
 * always rendered, so a strip that sets neither option renders the same classes in the same order.
 */
function stripSlideClass(snap: "start" | "center", portrait: boolean): string {
  if (snap === "start" && !portrait) return stripItemClass
  return join(
    portrait ? portraitWidthClass : "w-5/6 sm:w-2/3",
    "shrink-0",
    snap === "center" ? "snap-center" : "snap-start",
  )
}
/** A slide with its caption: the image's button, then the caption under it. */
const figureClass = "flex flex-col gap-2"
const captionClass = "text-sm text-muted"
/** The counter and Previous/Next under the row. The counter stays centred with or without them. */
const navRowClass = "flex items-center gap-3"
const navCounterClass = "mx-auto text-sm text-muted tabular-nums"
const navButtonClass = "size-10 aria-disabled:pointer-events-none aria-disabled:opacity-50"
const stripButtonClass = join(thumbButtonClass, "w-full")
/**
 * `h-auto w-full` keeps a strip image responsive. With `width` and `height` on the `<img>`, the
 * browser takes their ratio as the image's aspect ratio, so the row has its final height before any
 * image has loaded. Every image after the first is `loading="lazy"`: only the one a reader sees first
 * loads up front.
 */
const stripImageClass = "block h-auto w-full"

/**
 * Bring a focused strip image wholly into view, on the row's snap point (its start, or its centre
 * with `snap="center"`). Chromium scrolls
 * a focused element only when none of it is visible, so Tab onto the half-shown next image would
 * otherwise leave it half-shown. `inline` is the snap position itself, so snapping does not pull
 * the row back; `block: "nearest"` moves the page only when the row is off screen. The scroll
 * follows the row's own `scroll-behavior`, which the strip leaves instant.
 *
 * Only keyboard focus scrolls, which `:focus-visible` tells apart. A mouse press focuses the button
 * before it is released; scrolling then would move the image out from under the pointer, the
 * release would land on another element, and the click on the half-shown image would open nothing.
 */
function revealInStrip(
  event: JSX.TargetedFocusEvent<HTMLButtonElement>,
  snap: "start" | "center",
): void {
  const button = event.currentTarget
  if (!button.matches(":focus-visible")) return
  button.scrollIntoView({ block: "nearest", inline: snap })
}

/** Where a strip's row has scrolled to, as {@link stripPosition} reads it. */
export interface StripScroll {
  /** The row's `scrollLeft`. */
  scrollLeft: number
  /** How far the row can scroll: its `scrollWidth` minus its `clientWidth`. */
  maxScroll: number
  /** One slide's width plus the gap after it: the distance between two slides' starts. */
  step: number
  /** How many slides the row holds. */
  total: number
}

/**
 * The slide a strip's counter names, `0`-based, for where its row has scrolled to.
 *
 * The first slide at the row's start and the last at its end, so Next and Previous always walk the
 * counter to either end even when several slides fit in the row at once. In between, the slide
 * whose snap position is nearest, never the first or the last: a row part-way along is past the
 * first slide and short of the last. Both snap modes land a slide at about a whole number of steps,
 * since a centred slide sits less than half a step before its start position.
 *
 * @param scroll Where the row is, and how its slides are spaced.
 */
export function stripPosition({ scrollLeft, maxScroll, step, total }: StripScroll): number {
  if (total <= 1 || scrollLeft <= 1) return 0
  if (scrollLeft >= maxScroll - 1) return total - 1
  if (step <= 0) return 0
  return Math.min(total - 2, Math.max(1, Math.round(scrollLeft / step)))
}

/** The distance between the first two slides' starts, or the row's width with only one slide. */
function stripStep(row: HTMLElement): number {
  const [first, second] = Array.from(row.children)
  if (!first) return row.clientWidth
  if (!second) return first.getBoundingClientRect().width
  return second.getBoundingClientRect().left - first.getBoundingClientRect().left
}

/** What the strip's navigation shows: which slide, whether the row scrolls, and at which end. */
interface StripNavState {
  position: number
  overflows: boolean
  atStart: boolean
  atEnd: boolean
}

/** A picture with a WebP source when the image has one, else the `<img>` alone. */
function withWebp(webpSrc: string | undefined, img: JSX.Element): JSX.Element {
  if (!webpSrc) return img
  return (
    <picture class="block">
      <source type="image/webp" srcset={webpSrc} />
      {img}
    </picture>
  )
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
    previousLabel = "Previous image",
    nextLabel = "Next image",
    counterLabel = counterText,
    lightboxCaption,
    stripPreviousLabel = previousLabel,
    stripNextLabel = nextLabel,
    controls,
    layout = "grid",
    hero = false,
    captions = false,
    navigation = false,
    snap = "start",
    slideWidth = "wide",
    class: className,
  }: ImageGalleryProps,
): JSX.Element {
  const shown = describedImages(images)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const strip = layout === "strip"
  const rowRef = useRef<HTMLUListElement>(null)
  const [nav, setNav] = useState<StripNavState>({
    position: 0,
    overflows: false,
    atStart: true,
    atEnd: false,
  })
  const navigates = strip && navigation && shown.length > 1

  const first = shown[0]
  const portrait = slideWidth === "orientation" && first?.width !== undefined &&
    first.height !== undefined && first.height > first.width
  const slideClass = stripSlideClass(snap, portrait)

  /** Read the row back into the counter and the buttons' state. */
  const measure = () => {
    const row = rowRef.current
    if (!row) return
    const maxScroll = row.scrollWidth - row.clientWidth
    const next: StripNavState = {
      position: stripPosition({
        scrollLeft: row.scrollLeft,
        maxScroll,
        step: stripStep(row),
        total: row.children.length,
      }),
      overflows: maxScroll > 1,
      atStart: row.scrollLeft <= 1,
      atEnd: row.scrollLeft >= maxScroll - 1,
    }
    setNav((was) =>
      was.position === next.position && was.overflows === next.overflows &&
        was.atStart === next.atStart && was.atEnd === next.atEnd
        ? was
        : next
    )
  }

  // Whether the row overflows changes with its own width and with the size of each slide in it, so
  // the buttons follow both, not only the row's scroll.
  useEffect(() => {
    if (!navigates) return
    const row = rowRef.current
    if (!row) return
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    for (const slide of Array.from(row.children)) observer.observe(slide)
    return () => observer.disconnect()
  }, [navigates, shown.length])

  /** Scroll the row by one slide, clamped to its ends; snapping settles it on a slide. */
  const scrollByOne = (direction: 1 | -1) => {
    const row = rowRef.current
    if (!row) return
    const maxScroll = row.scrollWidth - row.clientWidth
    row.scrollTo({
      left: Math.min(maxScroll, Math.max(0, row.scrollLeft + direction * stripStep(row))),
    })
  }

  const list = (
    <ul
      ref={rowRef}
      class={join(strip ? stripListClass : "flex flex-wrap gap-3", className)}
      data-gallery-strip={navigates ? "" : undefined}
      onScroll={navigates ? measure : undefined}
    >
      {shown.map((image, index) => {
        if (!strip) {
          return (
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
          )
        }
        const lead = hero && index === 0
        const button = (
          <button
            type="button"
            class={stripButtonClass}
            aria-label={captions ? undefined : image.alt}
            onClick={() => setOpenIndex(index)}
            onFocus={(event) => revealInStrip(event, snap)}
          >
            {withWebp(
              image.webpSrc,
              <img
                src={image.src}
                alt={captions ? image.alt : ""}
                width={image.width}
                height={image.height}
                loading={lead ? "eager" : index === 0 ? undefined : "lazy"}
                fetchpriority={lead ? "high" : undefined}
                decoding={hero && !lead ? "async" : undefined}
                class={stripImageClass}
              />,
            )}
          </button>
        )
        return (
          <li key={thumbnailKey(shown, index)} class={slideClass}>
            {captions
              ? (
                <figure class={figureClass}>
                  {button}
                  <figcaption class={captionClass}>{image.alt}</figcaption>
                </figure>
              )
              : button}
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {navigates
        ? (
          <div class="flex flex-col gap-2">
            {list}
            <div class={navRowClass}>
              {nav.overflows && (
                <Button
                  variant="outline"
                  size="none"
                  class={navButtonClass}
                  aria-label={stripPreviousLabel}
                  aria-disabled={nav.atStart ? "true" : undefined}
                  onClick={() => {
                    if (!nav.atStart) scrollByOne(-1)
                  }}
                >
                  <IconChevronLeft class="size-5" />
                </Button>
              )}
              <p
                class={navCounterClass}
                data-gallery-counter=""
                aria-live="polite"
                aria-atomic="true"
              >
                {counterLabel(nav.position + 1, shown.length)}
              </p>
              {nav.overflows && (
                <Button
                  variant="outline"
                  size="none"
                  class={navButtonClass}
                  aria-label={stripNextLabel}
                  aria-disabled={nav.atEnd ? "true" : undefined}
                  onClick={() => {
                    if (!nav.atEnd) scrollByOne(1)
                  }}
                >
                  <IconChevronRight class="size-5" />
                </Button>
              )}
            </div>
          </div>
        )
        : list}
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
        caption={lightboxCaption}
      />
    </>
  )
}
