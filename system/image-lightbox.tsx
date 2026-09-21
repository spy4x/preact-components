/**
 * `ImageLightbox` — makes the images inside a container zoomable, with a `<dialog>` lightbox.
 *
 * Progressive enhancement in the strict sense: the server renders the page, this adds a zoom layer
 * after hydration, and nothing is added to the markup that a reader without JavaScript would miss.
 * The dialog itself is the only element the component renders, and it is empty until an image is
 * opened.
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
 */

import { cn } from "@preact-components/cn"
import { IconXMark } from "@preact-components/icons"
import { useEffect, useRef, useState } from "preact/hooks"

/** An image the lightbox can show. */
export interface LightboxImage {
  /** Absolute URL where the browser resolved one, the raw attribute otherwise. */
  src: string
  /** Never empty: falls back to the lightbox's `fallbackAlt`. */
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
  /** Called when an image is opened, with the resolved `src` and `alt`. */
  onOpen?: (image: LightboxImage) => void
  /** Utilities for the dialog. */
  class?: string
}

const dialogClass =
  "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-black/95 p-0 backdrop:bg-black/80"
const closeClass =
  "absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
// Positioned rather than stretched: the dialog has to be the thing under the pointer everywhere the
// image is not, or a backdrop click lands on a full-size child and the documented close is a lie.
const imageClass =
  "absolute top-1/2 left-1/2 max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 object-contain"

/**
 * Zoomable images inside a container.
 *
 * Escape and the backdrop both close the lightbox: the first is native `<dialog>` behaviour, the
 * second is the click comparison below. Either way `close` clears the state, which is why no
 * global key listener is needed — the source version kept one alive alongside the native close,
 * so state and dialog could disagree.
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
    onOpen,
    class: className,
  }: ImageLightboxProps,
) {
  const [image, setImage] = useState<LightboxImage | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

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

    const open = (event: Event) => {
      const resolved = resolveImage(
        event.target as ImageElementLike | null,
        imageSelector,
        fallbackAlt,
      )
      if (!resolved) return false

      // The default is what has to go: a click or an Enter press on an image inside a link would
      // otherwise open the lightbox *and* navigate away from it, and Space would scroll the page.
      event.preventDefault()
      setImage(resolved)
      dialogRef.current?.showModal()
      onOpen?.(resolved)
      return true
    }

    const onClick = (event: Event) => open(event)
    const onKeyDown = (event: Event) => {
      const key = (event as KeyboardEvent).key
      if (key !== "Enter" && key !== " ") return
      open(event)
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

  const close = () => dialogRef.current?.close()

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onClose={() => setImage(null)}
      onClick={(event) => {
        if (event.target === dialogRef.current) close()
      }}
      class={cn(dialogClass, className)}
    >
      {image && (
        <>
          <button type="button" onClick={close} aria-label={closeLabel} class={closeClass}>
            <IconXMark class="size-8" />
          </button>
          <img src={image.src} alt={image.alt} class={imageClass} />
        </>
      )}
    </dialog>
  )
}
