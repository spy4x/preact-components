import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/**
 * Palette entries a {@link Badge} can use. `purple` and `purpleNav` are the theme's accent: they
 * draw purple by default and follow the accent when an app sets it — `--color-primary` in the light
 * palette, `--color-accent` in both.
 */
export type BadgeColor = "red" | "orange" | "green" | "gray" | "blue" | "purple" | "purpleNav"

/** Whether a {@link Badge} is tinted (`filled`, the default) or only outlined. */
export type BadgeType = "filled" | "outline"

export interface BadgeProps {
  /** The label, shown exactly as given: the badge changes no letter's case. */
  text: string
  /** Defaults to `"purple"`, the accent. */
  color?: BadgeColor
  /** Defaults to `"filled"`. */
  type?: BadgeType
  class?: string
  /**
   * Makes the whole badge a link: it renders an `<a>` with a keyboard focus ring, and its content is
   * the link's accessible name. Leave it out for a static `<span>`. A plain `href`, with no
   * navigation port: an app that routes on the client intercepts the click the way it does for any
   * other link.
   */
  href?: string
}

/**
 * A {@link Badge} with element content in place of `text` — a `StatusMark` beside a word, say, or a
 * link inside the pill. A badge holds one or the other, never both.
 */
export interface BadgeElementProps extends Omit<BadgeProps, "text"> {
  children: ComponentChildren
  text?: undefined
}

/**
 * An outline badge draws its label straight on whatever is behind it, so each colour takes a shade
 * that reads at 4.5:1 or better on the canvas and the surface of its palette. In light, red and
 * orange take their 700 shade and green its 800 (#463): red, orange and green at 600 or lighter
 * read below 4.5:1 on the gray-100 canvas. In dark, red, orange, green, blue and the accent take
 * their 400 shade: at 600 they read below 4.5:1 on the gray-900 canvas and the gray-800 surface.
 * Grey reads the muted text token, which each palette sets itself.
 */
const outlineClasses: Record<BadgeColor, string> = {
  red: "border-red-700 text-red-700 dark:border-red-400 dark:text-red-400",
  orange: "border-orange-700 text-orange-700 dark:border-orange-400 dark:text-orange-400",
  green: "border-green-800 text-green-800 dark:border-green-400 dark:text-green-400",
  gray: "border-control text-muted",
  blue: "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400",
  purple: "border-accent-600 text-accent-600 dark:border-accent-400 dark:text-accent-400",
  purpleNav: "border-accent-700 bg-accent-900 text-accent-100",
}

const filledClasses: Record<BadgeColor, string> = {
  red: "border-red-600 bg-red-600 text-red-50",
  orange: "border-orange-400 bg-orange-400 text-orange-50",
  green: "border-green-600 bg-green-600 text-green-50",
  gray: "border-subtle bg-track text-foreground",
  blue: "border-blue-600 bg-blue-600 text-blue-50",
  purple: "border-transparent bg-selected text-selected-foreground",
  purpleNav: "border-accent-700 bg-accent-900 text-accent-100",
}

const base =
  "inline-flex items-center border rounded-md px-2 py-1 text-xs whitespace-nowrap font-medium"

/**
 * Compose a badge's class list without rendering one, so a pill that is not a {@link Badge} — a
 * pressable chip, say — draws from the same palette.
 *
 * @param color Palette entry, defaults to `"purple"`, the accent.
 * @param type Tinted or outlined, defaults to `"filled"`.
 * @param className Extra utilities; they win over the badge's own in the same group.
 * @returns The merged `class` attribute value.
 */
export function badgeClasses(
  color: BadgeColor = "purple",
  type: BadgeType = "filled",
  className?: string,
): string {
  const palette = type === "outline" ? outlineClasses : filledClasses
  return cn(base, palette[color], className)
}

/**
 * A linked badge's focus ring and hover cue, the ring the other focusable components draw. A
 * badge without `href` takes none of them, so its markup is what it always was.
 */
const linkClasses = "hover:underline underline-offset-4 focus-visible:outline-hidden " +
  "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-focus"

/**
 * Small status pill: a text label, or element content such as a `StatusMark`, in a `span` — or in
 * an `<a>` when `href` is given, so the whole pill is the link.
 */
export function Badge(props: BadgeProps | BadgeElementProps): JSX.Element {
  const { text, color = "purple", type = "filled", class: className, href } = props
  const children = "children" in props ? props.children : undefined
  // Element content usually means a shape beside a word, which needs a gap a single label does not.
  const classes = badgeClasses(
    color,
    type,
    cn(children !== undefined && "gap-1", href !== undefined && linkClasses, className),
  )
  const content = children ?? text
  return href === undefined
    ? <span class={classes}>{content}</span>
    : <a href={href} class={classes}>{content}</a>
}
