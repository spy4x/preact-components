import { join } from "@spy4x/preact-cn/join"

/**
 * Visual role of a `Button`. `"danger-ghost"` is the quiet destructive action: transparent
 * like `"ghost"`, in the danger text colour, for a dialog footer or a menu where a confirmation
 * guards it; `"danger"` is the filled one that confirms.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "icon"
  | "danger"
  | "danger-ghost"

/** Control height and text scale of a `Button`. */
export type ButtonSize = "sm" | "md" | "lg"

const baseLayout = "inline-flex items-center justify-center"
const baseLook =
  "rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"

/**
 * The dark primary fill is accent step 600: the one step that stands 3:1 off the gray-900 canvas
 * and still holds the white label at 4.5:1. Its hover darkens to 700, which keeps the label and
 * shows the pointer, and sits below 3:1 on the canvas only while the pointer is on it.
 *
 * The secondary fill is the hover step, which in light is the canvas itself, so its edge is a
 * `--color-border-button` border that stands 3:1 off the page and a card in every palette.
 *
 * The quiet danger text is `--color-danger`, and its hover the `--color-danger-soft` tint: in
 * light red-700 reads 5.8:1 or better on the canvas, a card and the tint; in dark red-400 reads
 * 4.7:1 or better on the gray-800 card, the ink card and the tint over either.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-900 text-accent-foreground hover:bg-accent-800 dark:bg-accent-600 dark:hover:bg-accent-700",
  secondary: "border border-button bg-hover text-foreground hover:bg-track",
  outline: "border border-control bg-surface text-foreground hover:bg-hover",
  ghost: "bg-transparent text-foreground hover:bg-hover",
  icon: "bg-transparent text-muted hover:bg-hover hover:text-foreground",
  danger: "bg-danger-fill text-danger-fill-foreground hover:bg-danger-fill-hover",
  "danger-ghost": "bg-transparent text-danger hover:bg-danger-soft",
}

const sizeClasses: Record<ButtonSize | "none", string> = {
  none: "",
  sm: "px-2 py-2 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2 text-base",
}

const iconSizeClasses: Record<ButtonSize | "none", string> = {
  none: "",
  sm: "size-8",
  md: "size-9",
  lg: "size-10",
}

/**
 * Compose the class list of a button with `join`, without `tailwind-merge`, so an island that
 * styles a link or a button this way does not carry the ~28 KB it adds.
 *
 * A caller's class is appended, not merged: it does not replace a conflicting utility of the
 * button's own, so `px-8` lands beside the size's `px-3` and the stylesheet's order decides. Use
 * `buttonClasses` from `./button.tsx` when the caller's class must win.
 *
 * @param variant Visual role, defaults to `"primary"`.
 * @param size Control height, defaults to `"md"`. The `icon` variant maps it to a square box.
 *   `"none"` adds no padding, gap, text size or box size.
 * @param className Extra utilities supplied by the caller, appended last.
 * @returns The `class` attribute value.
 */
export function buttonClassesJoined(
  variant: ButtonVariant = "primary",
  size: ButtonSize | "none" = "md",
  className?: string,
): string {
  return join(
    baseLayout,
    // Every size has the same gap; `"none"` adds none.
    size !== "none" && "gap-2",
    baseLook,
    variantClasses[variant],
    variant === "icon" ? iconSizeClasses[size] : sizeClasses[size],
    className,
  )
}
