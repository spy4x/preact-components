/**
 * `ImageLightbox` — makes the images inside a container zoomable, opening the shared `Lightbox`.
 *
 * Progressive enhancement in the strict sense: the server renders the page, this adds a zoom layer
 * after hydration, and nothing is added to the markup that a reader without JavaScript would miss.
 * `Lightbox` is the only element this component renders, and its dialog is empty until an image is
 * opened — see `@preact-components/ui/lightbox` for what it is built on and why.
 *
 * The click layer is delegated to the container rather than attached to each image: one listener
 * instead of N, images that arrive after hydration still work, and cleanup is complete — the
 * source version left a listener on every image for the life of the page.
 *
 * **A zoomable image behaves like a button**, because that is what it has become: it takes a Tab
 * stop, it carries a button's role and a name saying what activating it does, and Enter and Space
 * both open it. Space is cancelled so the page does not scroll out from under a reader who has
 * just pressed it, which is what a real button does too. A click or an Enter press is cancelled as
 * well, so an image wrapped in a link opens the lightbox instead of following the link.
 *
 * Escape closes the dialog natively and the backdrop closes it on a click, which is only true
 * because the image is positioned inside the dialog rather than filling it: a dialog whose child
 * covers it is a dialog no click can ever reach.
 *
 * **Previous and next page through the container's other zoomable images.** Which images those are
 * is decided once, at the moment one is opened: {@link collectSequence} reads every element the
 * container's `imageSelector` currently matches, in DOM order, and that snapshot is what Left,
 * Right and the lightbox's own buttons page through for as long as the dialog stays open. An image
 * that arrives in the container afterward becomes zoomable — the click layer and the
 * `MutationObserver` still cover it — but is not spliced into a sequence already being viewed, the
 * same way the source click layer already treats an image arriving after hydration: it works once
 * mounted, not retroactively.
 *
 * **A missing description gets `fallbackAlt` substituted, as it always has** — an image with no
 * `alt` attribute is still zoomable and still opens, named by `fallbackAlt` (default `"Image"`),
 * and `Lightbox` now also shows that name as a visible caption, which is new here. Only a caller
 * who sets `fallbackAlt=""` opts out of the substitution; only then can an image genuinely have no
 * description, and only then does {@link collectSequence} drop it — from the sequence, and from
 * opening at all if it is the one activated — the same refusal `Lightbox` applies to its own
 * `images` prop.
 */

import { describedImages, Lightbox } from "@preact-components/ui/lightbox"
import type { JSX } from "preact"
import { useEffect, useState } from "preact/hooks"

/** An image the lightbox can show. */
export interface LightboxImage {
  /** Absolute URL where the browser resolved one, the raw attribute otherwise. */
  src: string
  /**
   * The image's description. `resolveImage` substitutes the component's `fallbackAlt` (default
   * `"Image"`) for a missing one, so this is empty only when a caller has set `fallbackAlt` to `""`
   * too — see {@link collectSequence}, which then drops the image rather than showing one with no
   * name.
   */
  alt: string
}

/**
 * The view of a clicked element this component needs.
 *
 * Structural rather than `HTMLImageElement` so {@link resolveImage} is a pure decision that a test
 * can drive with a stub — no DOM, no jsdom.
 */
export interface ImageElementLike {
  /** `Element.matches`. */
  matches(selector: string): boolean
  /** Resolved URL property, when the element has one. */
  src?: string
  /** `alt` property, when the element has one. */
  alt?: string
  /** Attribute reader, used when the properties are absent. */
  getAttribute?: (name: string) => string | null
}

/**
 * Turn an event target into a lightbox image, or `null` when the event missed an image.
 *
 * Only the image itself answers: an event whose target is the link around it, or any other element
 * of the page, is not this component's business. A click that *did* land on a zoomable image is
 * cancelled by the caller, so a wrapping link stays unfollowed.
 *
 * @param target The event target, or `null`.
 * @param imageSelector Selector an image must match, default `"img"`.
 * @param fallbackAlt `alt` used when the image has none.
 */
export function resolveImage(
  target: ImageElementLike | null,
  imageSelector = "img",
  fallbackAlt = "Image",
): LightboxImage | null {
  if (!target || !target.matches(imageSelector)) return null

  const src = target.src ?? target.getAttribute?.("src") ?? ""
  if (!src) return null

  const alt = (target.alt ?? target.getAttribute?.("alt") ?? "").trim()
  return { src, alt: alt || fallbackAlt }
}

/** Attribute marking an image this component has made zoomable, so cleanup knows what it owns. */
const MARKER = "data-lightbox-zoom"

/** What {@link markZoomable} puts on an image, beyond the marker itself. */
interface ZoomableMarks {
  /** Selector an image must match. */
  imageSelector: string
  /** `alt` used when an image has none. */
  fallbackAlt: string
  /** Word the accessible name opens with, e.g. `Zoom`. */
  zoomLabel: string
  /** Whether to give the image a zoom-in cursor. */
  zoomCursor: boolean
}

/**
 * Make every image in the container a keyboard-reachable control.
 *
 * A Tab stop and a role are the difference between "clicking this image zooms it" and "activating
 * this image zooms it", and only the second is reachable without a mouse. Idempotent, because a
 * container whose images change calls this again.
 */
function markZoomable(container: Element, marks: ZoomableMarks): void {
  for (const element of container.querySelectorAll(marks.imageSelector)) {
    const image = element as HTMLElement
    if (image.hasAttribute(MARKER)) continue

    const alt = (image.getAttribute("alt") ?? "").trim() || marks.fallbackAlt
    image.setAttribute(MARKER, "")
    image.setAttribute("role", "button")
    image.setAttribute("tabindex", "0")
    image.setAttribute("aria-label", `${marks.zoomLabel}: ${alt}`)
    if (marks.zoomCursor) image.style.cursor = "zoom-in"
  }
}

/** Give every image this component marked back to the page exactly as it found it. */
function unmarkZoomable(container: Element): void {
  for (const element of container.querySelectorAll(`[${MARKER}]`)) {
    const image = element as HTMLElement
    for (const attribute of [MARKER, "role", "tabindex", "aria-label"]) {
      image.removeAttribute(attribute)
    }
    image.style.removeProperty("cursor")
  }
}

/** What {@link collectSequence} hands back: the lightbox's whole sequence, and where it opened. */
export interface ImageSequence {
  /** Every zoomable image the container held at the moment one was opened, in DOM order. */
  images: LightboxImage[]
  /**
   * Position of the activated image in {@link ImageSequence.images}; `-1` if it did not resolve to
   * an image at all, or resolved but was then dropped for having no description.
   */
  index: number
}

/**
 * Build the sequence a lightbox pages through, and the position of the image that was opened.
 *
 * Pure: given the container's zoomable elements, already read, and the one that was activated, it
 * decides which resolve to real images, which of those `Lightbox` will actually show, and where the
 * activated one landed among the ones that survive. That is not simply "the position in `elements`"
 * for two reasons stacked on each other. First, {@link resolveImage} can refuse an element with no
 * usable `src`, and an element `elements` still lists then never reaches this function's own list at
 * all. Second, {@link describedImages} — the same function `Lightbox` itself applies to `images`
 * before it renders anything — is applied here too, before the index is worked out, not after: with
 * a non-empty `fallbackAlt` (the default) this never removes anything, because `resolveImage` has
 * already substituted it for a missing `alt`, but a caller who passes `fallbackAlt=""` can produce a
 * resolved image whose `alt` is still empty, and that image must be missing from this function's
 * `images` at the same position it will be missing from `Lightbox`'s. Filtering afterward, in the
 * caller, would have left the two disagreeing about where a later image landed — measured in review:
 * an earlier version filtered nowhere, and clicking a described image that came after an undescribed
 * one opened a different image than the one that was clicked.
 *
 * @param elements Every element the container's `imageSelector` currently matches, in DOM order.
 * @param target The element that was clicked or activated with the keyboard.
 * @param imageSelector Selector an image must match — see {@link resolveImage}.
 * @param fallbackAlt `alt` used when an image has none. An empty string opts out of the
 * substitution, which is what lets `describedImages` drop an image here.
 * @returns `index` is `-1` both when the activated element did not resolve to an image at all and
 * when it resolved but was then dropped for having no description — the caller does not need to
 * tell those two apart, since neither is an image to open.
 */
export function collectSequence(
  elements: readonly ImageElementLike[],
  target: ImageElementLike | null,
  imageSelector = "img",
  fallbackAlt = "Image",
): ImageSequence {
  const resolved: Array<{ element: ImageElementLike; image: LightboxImage }> = []
  for (const element of elements) {
    const image = resolveImage(element, imageSelector, fallbackAlt)
    if (image) resolved.push({ element, image })
  }

  // `describedImages` filters by object identity, so the images it keeps are the very objects
  // `resolved` holds — `targetPair.image` can therefore be found in `images` by reference,
  // without restating "alt, trimmed, is not empty" as a second predicate that could drift from
  // the one `Lightbox` applies.
  const images = describedImages(resolved.map((pair) => pair.image))
  const targetPair = resolved.find((pair) => pair.element === target)
  const index = targetPair ? images.indexOf(targetPair.image) : -1

  return { images, index }
}

export interface ImageLightboxProps {
  /**
   * Container whose images become zoomable. Defaults to `"[data-lightbox]"` — an attribute the
   * host puts on the element holding the images, which names no particular kind of page.
   */
  containerSelector?: string
  /** Selector an image must match. Defaults to `"img"`. */
  imageSelector?: string
  /** `alt` used when an image has none. Defaults to `"Image"`. */
  fallbackAlt?: string
  /** Give matching images a zoom-in cursor. Defaults to `true`. */
  zoomCursor?: boolean
  /** Word a zoomable image's accessible name opens with. Defaults to `"Zoom"`. */
  zoomLabel?: string
  /** Accessible name of the lightbox. Defaults to `"Image viewer"`. */
  label?: string
  /** Accessible name of the close control. Defaults to `"Close"`. */
  closeLabel?: string
  /** Accessible name of the previous control. Defaults to `"Previous image"`. */
  previousLabel?: string
  /** Accessible name of the next control. Defaults to `"Next image"`. */
  nextLabel?: string
  /** Called when an image is opened, with the resolved `src` and `alt`. */
  onOpen?: (image: LightboxImage) => void
  /** Utilities for the dialog. */
  class?: string
}

/**
 * Zoomable images inside a container, opening the shared `Lightbox`.
 *
 * Escape and the backdrop both close it: the first is native `<dialog>` behaviour, the second is
 * `Lightbox`'s own click comparison. Either way its `close` event clears this component's state,
 * which is why no global key listener is needed for closing — the source version kept one alive
 * alongside the native close, so state and dialog could disagree.
 */
export function ImageLightbox(
  {
    containerSelector = "[data-lightbox]",
    imageSelector = "img",
    fallbackAlt = "Image",
    zoomCursor = true,
    zoomLabel = "Zoom",
    label = "Image viewer",
    closeLabel = "Close",
    previousLabel,
    nextLabel,
    onOpen,
    class: className,
  }: ImageLightboxProps,
): JSX.Element {
  const [sequence, setSequence] = useState<LightboxImage[]>([])
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const container = document.querySelector(containerSelector)
    if (!container) return

    const mark = () =>
      markZoomable(container, { imageSelector, fallbackAlt, zoomLabel, zoomCursor })
    mark()
    // Images that arrive after hydration have always worked for a click, because the click layer is
    // delegated; a Tab stop is an attribute on the image itself, so it needs this to stay true.
    const observer = new MutationObserver(mark)
    observer.observe(container, { childList: true, subtree: true })

    const openAt = (event: Event) => {
      const target = event.target as ImageElementLike | null
      const resolved = resolveImage(target, imageSelector, fallbackAlt)
      if (!resolved) return false

      // The default is what has to go: a click or an Enter press on an image inside a link would
      // otherwise open the lightbox *and* navigate away from it, and Space would scroll the page.
      event.preventDefault()
      const elements = [
        ...container.querySelectorAll(imageSelector),
      ] as unknown as ImageElementLike[]
      const collected = collectSequence(elements, target, imageSelector, fallbackAlt)
      // `index < 0` only when `fallbackAlt` is itself empty and the activated image has no real
      // `alt`: `collectSequence` has already dropped it, the same refusal `Lightbox` applies to its
      // own `images` prop. Nothing opens — no dialog, no `onOpen` — rather than opening on whatever
      // happens to sit at position 0.
      if (collected.index < 0) return false
      setSequence(collected.images)
      setIndex(collected.index)
      setOpen(true)
      onOpen?.(resolved)
      return true
    }

    const onClick = (event: Event) => openAt(event)
    const onKeyDown = (event: Event) => {
      const key = (event as KeyboardEvent).key
      if (key !== "Enter" && key !== " ") return
      openAt(event)
    }

    container.addEventListener("click", onClick)
    container.addEventListener("keydown", onKeyDown)
    return () => {
      observer.disconnect()
      container.removeEventListener("click", onClick)
      container.removeEventListener("keydown", onKeyDown)
      unmarkZoomable(container)
    }
  }, [containerSelector, imageSelector, fallbackAlt, zoomCursor, zoomLabel, onOpen])

  return (
    <Lightbox
      images={sequence}
      index={index}
      open={open}
      onClose={() => setOpen(false)}
      onIndexChange={setIndex}
      label={label}
      closeLabel={closeLabel}
      previousLabel={previousLabel}
      nextLabel={nextLabel}
      class={className}
    />
  )
}
