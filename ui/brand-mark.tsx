import type { IconProps } from "@spy4x/preact-icons"
import type { ComponentType, JSX } from "preact"

/** Props of {@link BrandMark}. */
export interface BrandMarkProps {
  /** The glyph in the tile, such as `IconSprout`. Drawn in the text colour on the accent fill. */
  Icon: ComponentType<IconProps>
  /** The product's name, printed after the tile. */
  name: string
}

/**
 * A product's brand mark: a rounded square at `--radius-card`, filled with the brand hue and
 * holding one glyph, followed by the product's name in weight 500 — the construction the design
 * language gives every app's mark (`docs/design-language.md`, "The brand mark").
 *
 * The tile is the accent (`--color-accent`, which is the app's `--color-primary` unless it set the
 * two apart) in both palettes, so the mark matches the favicon drawn from the same square. The
 * glyph is `--color-accent-foreground`, the text colour the theme works out for that fill.
 *
 * The tile is decoration, hidden from assistive technology; the name is plain text, so a link or
 * heading around the mark is named by it. The mark is not a link itself: the caller wraps it in
 * one, with its own `href` and router port.
 *
 * @param props See {@link BrandMarkProps}.
 * @returns The tile and the name, in one inline row.
 */
export function BrandMark({ Icon, name }: BrandMarkProps): JSX.Element {
  return (
    <span class="inline-flex items-center gap-2 font-medium text-foreground" data-e2e="brand-mark">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-card bg-accent-900 text-accent-foreground"
        aria-hidden="true"
      >
        <Icon class="size-5" />
      </span>
      <span>{name}</span>
    </span>
  )
}
