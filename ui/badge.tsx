import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { Link } from "./link.tsx"
import { BADGE_BASE, BADGE_FILLED_ACCENT, BADGE_OUTLINE_GRAY } from "./plain-classes.ts"

/**
 * What a {@link Badge} says, by meaning, in the tone names `Notice`, `Progress` and `Timeline` use.
 * `primary` is the theme's accent: purple by default, following the accent when an app sets it —
 * `--color-primary` in the light palette, `--color-accent` in both. `primaryStrong` is a dark accent
 * pill that looks the same in both variants, for a counter on a dark surface such as a navigation
 * entry.
 */
export type BadgeTone =
  | "primary"
  | "primaryStrong"
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"

/** Whether a {@link Badge} is tinted (`filled`, the default) or only outlined. */
export type BadgeVariant = "filled" | "outline"

/**
 * The palette names a {@link Badge} took before `tone`.
 *
 * @deprecated Use {@link BadgeTone}; {@link BADGE_TONE_OF_COLOR} maps each name. Removed in the
 * next major.
 */
export type BadgeColor = "red" | "orange" | "green" | "gray" | "blue" | "purple" | "purpleNav"

/**
 * The name `variant` had before.
 *
 * @deprecated Use {@link BadgeVariant}, which has the same values. Removed in the next major.
 */
export type BadgeType = BadgeVariant

/**
 * The tone each deprecated colour name draws: `red` is `danger`, `orange` `warning`, `green`
 * `success`, `gray` `neutral`, `blue` `info`, `purple` `primary` and `purpleNav` `primaryStrong`.
 */
export const BADGE_TONE_OF_COLOR: Readonly<Record<BadgeColor, BadgeTone>> = {
  red: "danger",
  orange: "warning",
  green: "success",
  gray: "neutral",
  blue: "info",
  purple: "primary",
  purpleNav: "primaryStrong",
}

export interface BadgeProps {
  /** The label, shown exactly as given: the badge changes no letter's case. */
  text: string
  /** Defaults to `"primary"`, the accent. */
  tone?: BadgeTone
  /** Defaults to `"filled"`. */
  variant?: BadgeVariant
  /**
   * The tone under its old palette name; `tone` wins when both are given.
   *
   * @deprecated Use `tone`; {@link BADGE_TONE_OF_COLOR} maps each name. Removed in the next major.
   */
  color?: BadgeColor
  /**
   * The variant under its old name; `variant` wins when both are given.
   *
   * @deprecated Use `variant`, which takes the same values. Removed in the next major.
   */
  type?: BadgeVariant
  class?: string
  /**
   * Makes the whole badge a link: it renders an `<a>` with a keyboard focus ring, and its content is
   * the link's accessible name. Leave it out for a static `<span>`.
   */
  href?: string
  /**
   * Called with `href` on a plain click instead of the browser following the link, as `Link` and
   * `Button` do: the app's router, passed in. Ignored without `href`.
   */
  navigate?: (href: string) => void
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
const outlineClasses: Record<BadgeTone, string> = {
  danger: "border-red-700 text-red-700 dark:border-red-400 dark:text-red-400",
  warning: "border-orange-700 text-orange-700 dark:border-orange-400 dark:text-orange-400",
  success: "border-green-800 text-green-800 dark:border-green-400 dark:text-green-400",
  neutral: BADGE_OUTLINE_GRAY,
  info: "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400",
  primary: "border-accent-600 text-accent-600 dark:border-accent-400 dark:text-accent-400",
  primaryStrong: "border-accent-700 bg-accent-900 text-accent-100",
}

/**
 * Red, orange and green take the theme's status fills with the label each one is paired with, the
 * pairs the status buttons and the toasts draw, so the label reads at 4.5:1 or better in both
 * palettes: white on the danger fill, a near-black label on the warning fill (no pale label reaches
 * 4.5:1 on an orange lighter than orange-700), and a pale green one on the success fill.
 */
const filledClasses: Record<BadgeTone, string> = {
  danger: "border-transparent bg-danger-fill text-danger-fill-foreground",
  warning: "border-transparent bg-warning text-(--color-warning-foreground)",
  success: "border-transparent bg-success text-(--color-success-foreground)",
  neutral: "border-subtle bg-track text-foreground",
  info: "border-blue-600 bg-blue-600 text-blue-50",
  primary: BADGE_FILLED_ACCENT,
  primaryStrong: "border-accent-700 bg-accent-900 text-accent-100",
}

/**
 * The tone a tone or a deprecated colour name stands for.
 *
 * @param name A {@link BadgeTone}, or a deprecated {@link BadgeColor}.
 * @returns The tone.
 */
function toneOf(name: BadgeTone | BadgeColor): BadgeTone {
  return name in BADGE_TONE_OF_COLOR ? BADGE_TONE_OF_COLOR[name as BadgeColor] : name as BadgeTone
}

/**
 * Compose a badge's class list without rendering one, so a pill that is not a {@link Badge} — a
 * pressable chip, say — draws from the same palette.
 *
 * @param tone Defaults to `"primary"`, the accent. A deprecated {@link BadgeColor} name still works
 *   and draws the tone {@link BADGE_TONE_OF_COLOR} maps it to.
 * @param variant Tinted or outlined, defaults to `"filled"`.
 * @param className Extra utilities; they win over the badge's own in the same group.
 * @returns The merged `class` attribute value.
 */
export function badgeClasses(
  tone: BadgeTone | BadgeColor = "primary",
  variant: BadgeVariant = "filled",
  className?: string,
): string {
  const palette = variant === "outline" ? outlineClasses : filledClasses
  return cn(BADGE_BASE, palette[toneOf(tone)], className)
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
 * an `<a>` when `href` is given, so the whole pill is the link, which hands plain clicks to
 * `navigate` when one is given.
 */
export function Badge(props: BadgeProps | BadgeElementProps): JSX.Element {
  const { text, tone, variant, color, type, class: className, href, navigate } = props
  const children = "children" in props ? props.children : undefined
  // Element content usually means a shape beside a word, which needs a gap a single label does not.
  const classes = badgeClasses(
    tone ?? color,
    variant ?? type,
    cn(children !== undefined && "gap-1", href !== undefined && linkClasses, className),
  )
  const content = children ?? text
  return href === undefined
    ? <span class={classes}>{content}</span>
    : <Link href={href} navigate={navigate} class={classes}>{content}</Link>
}
