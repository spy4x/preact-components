import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

/**
 * Palette entries a {@link Badge} can use. `purple` and `purpleNav` are the theme's accent: they
 * draw purple by default and follow the accent when an app sets it — `--color-primary` in the light
 * palette, `--color-accent` in both.
 */
export type BadgeColor = "red" | "orange" | "green" | "gray" | "blue" | "purple" | "purpleNav"

/** Whether a {@link Badge} is tinted (`filled`, the default) or only outlined. */
export type BadgeType = "filled" | "outline"

export interface BadgeProps {
  text: string
  /** Defaults to `"purple"`, the accent. */
  color?: BadgeColor
  /** Defaults to `"filled"`. */
  type?: BadgeType
  class?: string
}

const outlineClasses: Record<BadgeColor, string> = {
  red: "border-red-600 text-red-600",
  orange: "border-orange-400 text-orange-400",
  green: "border-green-600 text-green-600",
  gray: "border-control text-muted",
  blue: "border-blue-600 text-blue-600",
  purple: "border-accent-600 text-accent-600",
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
  "inline-flex items-center border rounded-md px-2 py-1 text-xs whitespace-nowrap font-medium capitalize"

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

/** Small status pill. Static — takes text, renders a `span`. */
export function Badge(
  { text, color = "purple", type = "filled", class: className }: BadgeProps,
): JSX.Element {
  return <span class={badgeClasses(color, type, className)}>{text}</span>
}
