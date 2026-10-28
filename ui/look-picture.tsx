/**
 * The photo and the stretched link both `LookTile` and `StoryTile` draw, kept in one place so an
 * item and a post look alike in one grid. Internal: not one of the package's entry points.
 *
 * @module
 */

import { join } from "@spy4x/preact-cn/join"
import { responsiveImage, type ResponsiveImageVariant } from "@spy4x/platform/universal/srcset"
import type { JSX } from "preact"

/** The photo of a `LookTile` or the cover of a `StoryTile`. */
export interface LookPhoto {
  /**
   * The widths the photo is stored at, preferred type first (AVIF before WebP), as
   * `responsiveImage` of `@spy4x/platform/universal/srcset` takes them. Crop them to 3:4.
   */
  variants: readonly ResponsiveImageVariant[]
  /** What the photo shows. `""` when the name says it all. */
  alt: string
  /** How wide the photo is drawn. Defaults to its width in a `LookGrid`: a third, a half or all. */
  sizes?: string
}

/** The width of a tile in a `LookGrid`: one column on a phone, two from `md`, three from `lg`. */
export const LOOK_GRID_SIZES = "(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"

/** The tile's title link: the whole tile is its target, through a stretched `::after`. */
export const TILE_LINK =
  "rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-hidden " +
  "after:absolute after:inset-0 after:rounded-primary focus-visible:after:ring-2 " +
  "focus-visible:after:ring-focus focus-visible:after:ring-offset-2 " +
  "focus-visible:after:ring-offset-focus"

/** Props of {@link LookPicture}. */
export interface LookPictureProps {
  photo: LookPhoto
  /** The `sizes` when the photo names none. Defaults to {@link LOOK_GRID_SIZES}. */
  sizes?: string
  /** Load the photo at once and first. Lazy otherwise. */
  priority?: boolean
  /** A `view-transition-name` for the photo, unique on the page. */
  viewTransitionName?: string
  /** Utilities on the `<img>`, after its own; a change of aspect goes here. */
  imageClass?: string
}

/**
 * A 3:4 photo with no border, as a `<picture>` with a `srcset` per stored width.
 *
 * @param props The photo and options, see {@link LookPictureProps}.
 * @throws {Error} When the photo has no variant, or a variant `responsiveImage` refuses.
 */
export function LookPicture(
  { photo, sizes = LOOK_GRID_SIZES, priority = false, viewTransitionName, imageClass }:
    LookPictureProps,
): JSX.Element {
  const image = responsiveImage(photo.variants, photo.sizes ?? sizes)
  return (
    <picture class="block overflow-hidden rounded-primary bg-hover">
      {image.sources.map((source) => (
        <source key={source.type} type={source.type} srcset={source.srcset} sizes={image.sizes} />
      ))}
      <img
        src={image.src}
        srcset={image.srcset}
        sizes={image.sizes}
        width={image.width}
        height={image.height}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        fetchpriority={priority ? "high" : undefined}
        decoding="async"
        class={join("block aspect-3/4 w-full object-cover", imageClass)}
        style={viewTransitionName ? { viewTransitionName } : undefined}
      />
    </picture>
  )
}
