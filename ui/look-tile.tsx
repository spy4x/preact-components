import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useLabels } from "./i18n.tsx"
import { type LookPhoto, LookPicture, TILE_LINK } from "./look-picture.tsx"

export type { LookPhoto } from "./look-picture.tsx"

/** One size of a {@link LookTile}'s item, such as `"M"`. */
export interface LookSize {
  /** The size as the shop names it. */
  label: string
  /** None left in this size: it is struck through and announced as sold out. */
  soldOut?: boolean
}

/** One colour of a {@link LookTile}'s item, drawn as a dot. */
export interface LookColor {
  /** The colour's name, which a screen reader hears in place of the dot. */
  name: string
  /** Any CSS colour, such as `"#7a5230"`. */
  color: string
}

/** The words a {@link LookTile} shows or announces. */
export interface LookTileLabels {
  /** Names the list of sizes. Default: `"Sizes"`. */
  sizes: string
  /** Names the list of colours. Default: `"Colours"`. */
  colors: string
  /** Said after a struck-through size. Default: `"sold out"`. */
  sizeSoldOut: string
  /** Said after the size the shopper picked. Default: `"your size"`. */
  chosenSize: string
  /** Shown beside the struck price when nothing is left. Default: `"Sold out"`. */
  soldOut: string
}

/** The English words {@link LookTile} shows when the caller passes none. */
export const LOOK_TILE_LABELS: LookTileLabels = {
  sizes: "Sizes",
  colors: "Colours",
  sizeSoldOut: "sold out",
  chosenSize: "your size",
  soldOut: "Sold out",
}

/** Props of {@link LookTile}. */
export interface LookTileProps {
  /** Where the tile links to: the item's page. */
  href: string
  /** The item's name: the link's text and accessible name. */
  name: string
  /** The price, formatted by the caller, such as `"590.000 ₫"` or a `MoneyDisplay`. */
  price: ComponentChildren
  photo: LookPhoto
  /** The sizes, in the shop's order. Left out or empty, the tile shows none. */
  sizes?: readonly LookSize[]
  /** The size the shopper picked (a {@link LookSize.label}), marked in the accent. */
  chosenSize?: string
  /** The colours, drawn as dots after the sizes. */
  colors?: readonly LookColor[]
  /** Nothing is left: the price is struck through and "Sold out" stands beside it. */
  soldOut?: boolean
  /**
   * A `view-transition-name` for the photo, unique on the page, such as `look-ao-khoac-zip`. Give
   * the item page's photo the same name, and the photo grows from the tile into that page in a
   * browser that runs cross-document view transitions. Both pages opt in with
   * `@view-transition { navigation: auto; }`.
   */
  viewTransitionName?: string
  /** Load the photo at once and first, for the tiles above the fold. Lazy otherwise. */
  priority?: boolean
  /** Level of the name's heading, `<h2>` to `<h4>`. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4
  /** The words; see {@link LOOK_TILE_LABELS}. */
  labels?: Partial<LookTileLabels>
  /** Utilities on the tile. */
  class?: string
}

/**
 * One look of a shop's catalog: a tall 3:4 photo as the whole card, and under it the name, the
 * price, the sizes and the colours.
 *
 * Plain markup and CSS, so it works on a server-rendered page with no JavaScript. The whole tile
 * takes the click, while a screen reader hears one link named by the item, then the price and the
 * sizes. A sold-out size is struck through and also says "sold out", so it does not rest on the
 * line alone. The photo is a `<picture>` with a `srcset` per stored width, from `responsiveImage`.
 *
 * @param props The item and options, see {@link LookTileProps}.
 * @throws {Error} When the photo has no variant, or a variant `responsiveImage` refuses.
 */
export function LookTile(
  {
    href,
    name,
    price,
    photo,
    sizes = [],
    chosenSize,
    colors = [],
    soldOut = false,
    viewTransitionName,
    priority = false,
    headingLevel = 2,
    labels,
    class: className,
  }: LookTileProps,
): JSX.Element {
  const words = useLabels("LookTile", LOOK_TILE_LABELS, labels)
  const Heading = `h${headingLevel}` as const
  return (
    <div class={join("relative flex flex-col gap-3", className)} data-e2e="look-tile">
      <LookPicture photo={photo} priority={priority} viewTransitionName={viewTransitionName} />
      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3">
          <Heading class="min-w-0 text-base font-medium text-balance sm:text-lg">
            <a href={href} class={TILE_LINK}>{name}</a>
          </Heading>
          <p class="shrink-0 text-lg font-bold tabular-nums">
            {soldOut ? <s class="text-muted">{price}</s> : price}
          </p>
        </div>
        {(soldOut || sizes.length > 0 || colors.length > 0) && (
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-medium">
            {soldOut && <p class="font-semibold">{words.soldOut}</p>}
            {sizes.length > 0 && (
              <ul aria-label={words.sizes} class="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const chosen = size.label === chosenSize
                  return (
                    <li
                      key={size.label}
                      class={join(
                        "rounded-sm px-1 tabular-nums",
                        chosen
                          ? "bg-selected font-semibold text-selected-foreground"
                          : size.soldOut
                          ? "text-muted"
                          : "text-foreground",
                      )}
                    >
                      {size.soldOut ? <s>{size.label}</s> : size.label}
                      {size.soldOut && <span class="sr-only">{`, ${words.sizeSoldOut}`}</span>}
                      {chosen && <span class="sr-only">{`, ${words.chosenSize}`}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            {colors.length > 0 && (
              <ul aria-label={words.colors} class="flex gap-1">
                {colors.map((color) => (
                  <li key={color.name}>
                    <span
                      aria-hidden="true"
                      class="block size-3 rounded-full border border-strong"
                      style={{ backgroundColor: color.color }}
                    />
                    <span class="sr-only">{color.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
