import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

/** Palette entries a {@link Badge} can use. */
export type BadgeColor = "red" | "orange" | "green" | "gray" | "blue" | "purple" | "purpleNav"

/** Whether a {@link Badge} is tinted (`filled`, the default) or only outlined. */
export type BadgeType = "filled" | "outline"

export interface BadgeProps {
  text: string
  /** Defaults to `"purple"`. */
  color?: BadgeColor
  /** Defaults to `"filled"`. */
  type?: BadgeType
  class?: string
}

const outlineClasses: Record<BadgeColor, string> = {
  red: "border-red-600 text-red-600",
  orange: "border-orange-400 text-orange-400",
  green: "border-green-600 text-green-600",
  gray: "border-gray-300 text-gray-600",
  blue: "border-blue-600 text-blue-600",
  purple: "border-purple-600 text-purple-600",
  purpleNav: "border-purple-700 bg-purple-900 text-purple-100",
}

const filledClasses: Record<BadgeColor, string> = {
  red: "border-red-600 bg-red-600 text-red-50",
  orange: "border-orange-400 bg-orange-400 text-orange-50",
  green: "border-green-600 bg-green-600 text-green-50",
  gray: "border-gray-200 bg-gray-200 text-gray-600",
  blue: "border-blue-600 bg-blue-600 text-blue-50",
  purple: "border-purple-900 bg-purple-900 text-purple-50",
  purpleNav: "border-purple-700 bg-purple-900 text-purple-100",
}

const base =
  "inline-flex items-center border rounded-md px-2 py-1 text-xs whitespace-nowrap font-medium capitalize"

/** Small status pill. Static — takes text, renders a `span`. */
export function Badge(
  { text, color = "purple", type = "filled", class: className }: BadgeProps,
): JSX.Element {
  const palette = type === "outline" ? outlineClasses : filledClasses
  return <span class={cn(base, palette[color], className)}>{text}</span>
}
