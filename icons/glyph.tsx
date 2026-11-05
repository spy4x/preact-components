// Not exported from the package: the root `<svg>` every glyph renders, shared by the main entry
// and `registry.tsx`, so a glyph drawn in either reads and labels itself the same way.
import type { JSX } from "preact"
import type { IconProps } from "./+index.tsx"

/** The accessibility attributes an icon's root `<svg>` carries. */
interface IconA11yAttributes {
  "aria-hidden"?: "true"
  "aria-label"?: string
  role?: "img"
}

/**
 * Accessibility attributes for an icon's root `<svg>`: hidden when the caller gives no name, a
 * labelled image (`role="img"`) when it passes `aria-label` or `title`.
 */
function iconA11y(props: IconProps): IconA11yAttributes {
  const label = props["aria-label"]
  if (!label && !props.title) return { "aria-hidden": "true" }
  return label ? { role: "img", "aria-label": label } : { role: "img" }
}

/** The `<title>` child for an icon given a `title`, or nothing. */
function iconTitle(props: IconProps): JSX.Element | null {
  return props.title ? <title>{props.title}</title> : null
}

/** How one glyph's root `<svg>` differs from the default: a filled 24-unit glyph at `size-5`. */
export interface SvgIconStyle {
  /** Stroke width; set, the glyph is outlined in `currentColor` with no fill. */
  stroke?: string
  /** Round line caps and joins; `"cap"` rounds the caps alone. */
  round?: true | "cap"
  /** Root `fill`, when it differs from what `stroke` implies. */
  fill?: string
  /** Default size classes, used when the caller passes no `class`. Defaults to `"size-5"`. */
  size?: string
  /** Defaults to `"0 0 24 24"`. */
  viewBox?: string
  /** Spins, and stands still under reduced motion. */
  spin?: true
  /**
   * Points along the reading direction, so it flips left to right when the page or the nearest
   * ancestor is `dir="rtl"`. Set only on the glyphs README.md → "Right to left" lists.
   */
  mirror?: true
}

/**
 * The class a mirrored glyph carries. `:dir(rtl)` reads the nearest `dir`, so a left-to-right block
 * inside an Arabic page stays unflipped; Tailwind's `rtl:` also matches any descendant of a
 * `[dir="rtl"]`, nested `dir="ltr"` or not. A `transform`, not `-scale-x-100`: that one shares
 * `--tw-scale-x` with `scale-*`, so a caller's `hover:scale-125` would undo the mirror.
 */
const MIRROR_CLASS = "[&:dir(rtl)]:[transform:scaleX(-1)]"

/**
 * The root `<svg>` every icon renders: `currentColor` paint, the caller's name or a hidden
 * decoration, `shrink-0` plus the caller's `class` or the glyph's default size, then the optional
 * `<title>` and the drawing.
 */
export function svgIcon(
  props: IconProps,
  style: SvgIconStyle,
  ...drawing: JSX.Element[]
): JSX.Element {
  const outlined = style.stroke !== undefined
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={style.viewBox ?? "0 0 24 24"}
      fill={style.fill ?? (outlined ? "none" : "currentColor")}
      stroke={outlined ? "currentColor" : undefined}
      stroke-width={style.stroke}
      stroke-linecap={style.round ? "round" : undefined}
      stroke-linejoin={style.round === true ? "round" : undefined}
      {...iconA11y(props)}
      class={`${style.spin ? "animate-spin motion-reduce:animate-none " : ""}${
        style.mirror ? `${MIRROR_CLASS} ` : ""
      }shrink-0 ${props.class || style.size || "size-5"}`}
    >
      {[iconTitle(props), ...drawing]}
    </svg>
  )
}
