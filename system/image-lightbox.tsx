/**
 * `ImageLightbox` — makes images in rendered prose zoomable, with a `<dialog>` lightbox.
 *
 * Progressive enhancement in the strict sense: the server renders the article, this adds a
 * click-to-zoom layer after hydration, and nothing is added to the markup that a reader without
 * JavaScript would miss. The dialog itself is the only element the component renders, and it is
 * empty until an image is opened.
 *
 * The click layer is delegated to the container rather than attached to each image: one listener
 * instead of N, images that arrive after hydration still work, and cleanup is complete — the
 * source version left a listener on every image for the life of the page.
 */

import { cn } from "@preact-components/cn"
import { IconXMark } from "@preact-components/icons"
import { useEffect, useRef, useState } from "preact/hooks"

/** An image the lightbox can show. */
export interface LightboxImage {
  /** Absolute URL where the browser resolved one, the raw attribute otherwise. */
  src: string
  /** Never empty: falls back to the enhancer's `fallbackAlt`. */
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
 * Turn a click target into a lightbox image, or `null` when the click missed an image.
 *
 * Returning `null` for a non-image — including a click on a link wrapping an image — is what keeps
 * the enhancer from stealing navigation from prose.
 *
 * @param target The event target, or `null`.
 * @param imageSelector Selector an image must match, default `"img"`.
 * @param fallbackAlt `alt` used when the image has none.
 */
export function resolveImage(
  target: ImageElementLike | null,
  imageSelector = "img",
  fallbackAlt = "Blog image",
): LightboxImage | null {
  if (!target || !target.matches(imageSelector)) return null

  const src = target.src ?? target.getAttribute?.("src") ?? ""
  if (!src) return null

  const alt = (target.alt ?? target.getAttribute?.("alt") ?? "").trim()
  return { src, alt: alt || fallbackAlt }
}

/** Mark every current image as zoomable. Images added later are picked up by the click layer. */
function markZoomable(container: Element, imageSelector: string): void {
  for (const image of container.querySelectorAll(imageSelector)) {
    ;(image as HTMLElement).style.cursor = "zoom-in"
  }
}

export interface ImageLightboxProps {
  /** Container whose images become zoomable. Defaults to `".blog-content"`. */
  containerSelector?: string
  /** Selector an image must match. Defaults to `"img"`. */
  imageSelector?: string
  /** `alt` used when an image has none. Defaults to `"Blog image"`. */
  fallbackAlt?: string
  /** Give matching images a zoom-in cursor. Defaults to `true`. */
  zoomCursor?: boolean
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

/**
 * Zoomable images inside a prose container.
 *
 * Escape and the backdrop both close the lightbox: the first is native `<dialog>` behaviour, the
 * second is the click comparison below. Either way `close` clears the state, which is why no
 * global key listener is needed — the source version kept one alive alongside the native close,
 * so state and dialog could disagree.
 */
export function ImageLightbox(
  {
    containerSelector = ".blog-content",
    imageSelector = "img",
    fallbackAlt = "Blog image",
    zoomCursor = true,
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

    if (zoomCursor) markZoomable(container, imageSelector)

    const onClick = (event: Event) => {
      const resolved = resolveImage(
        event.target as ImageElementLike | null,
        imageSelector,
        fallbackAlt,
      )
      if (!resolved) return
      setImage(resolved)
      dialogRef.current?.showModal()
      onOpen?.(resolved)
    }

    container.addEventListener("click", onClick)
    return () => container.removeEventListener("click", onClick)
  }, [containerSelector, imageSelector, fallbackAlt, zoomCursor, onOpen])

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
        <div class="relative flex h-full w-full items-center justify-center">
          <button type="button" onClick={close} aria-label={closeLabel} class={closeClass}>
            <IconXMark class="size-8" />
          </button>
          <img
            src={image.src}
            alt={image.alt}
            class="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </dialog>
  )
}
