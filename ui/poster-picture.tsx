/**
 * The poster both `DemoVideo` and `LoopVideo` draw: an `<img>`, or a `<picture>` with a dark
 * `<source>` when the poster has a dark variant. Internal: not one of the package's entry points.
 *
 * @module
 */

import type { JSX } from "preact"

/** The dark variant of a poster, drawn while its media query matches. */
export interface DemoVideoDarkPoster {
  /** The dark image's files, as a `srcset`. A single file is just its URL. */
  srcset: string
  /**
   * When the dark image shows, such as `"(prefers-color-scheme: dark)"`. A site whose dark theme
   * needs JavaScript adds `and (scripting: enabled)`, so a page without it keeps the light poster.
   */
  media: string
}

/** The still frame a `DemoVideo` or `LoopVideo` shows before its clip. */
export interface DemoVideoPoster {
  /** Where the browser loads the poster image from. */
  src: string
  /** Other sizes of the same image, as the `<img>`'s `srcset`. */
  srcset?: string
  /** The `<img>`'s `sizes`, for `srcset`; the dark `<source>` takes it too. */
  sizes?: string
  /** The poster's intrinsic width in pixels; the clip is drawn at the same aspect. */
  width: number
  /** The poster's intrinsic height in pixels. */
  height: number
  /** The same frame in the dark theme, so a dark page never shows a light still. */
  dark?: DemoVideoDarkPoster
}

/** Props of {@link PosterPicture}. */
export interface PosterPictureProps {
  poster: DemoVideoPoster
  /** Load at once, at high priority, for a poster on the first screen. */
  eager: boolean
  /** Utilities on the `<img>`. */
  class: string
  /** The image's text alternative. Defaults to `""`: decorative, and hidden from assistive tech. */
  alt?: string
}

/**
 * The poster image: decorative by default, `alt=""` and hidden from assistive tech, since the
 * component around it carries the name. With `poster.dark` it is wrapped in a `display: contents` `<picture>`, so
 * the image lays out exactly as it does alone.
 *
 * @param props See {@link PosterPictureProps}.
 * @returns The `<img>`, or the `<picture>` around it.
 */
export function PosterPicture(
  { poster, eager, class: className, alt = "" }: PosterPictureProps,
): JSX.Element {
  const image = (
    <img
      src={poster.src}
      srcset={poster.srcset}
      sizes={poster.sizes}
      width={poster.width}
      height={poster.height}
      alt={alt}
      aria-hidden={alt === "" ? "true" : undefined}
      loading={eager ? "eager" : "lazy"}
      fetchpriority={eager ? "high" : undefined}
      decoding={eager ? undefined : "async"}
      class={className}
    />
  )
  if (poster.dark === undefined) return image
  return (
    <picture class="contents">
      <source media={poster.dark.media} srcset={poster.dark.srcset} sizes={poster.sizes} />
      {image}
    </picture>
  )
}
