import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX, Ref, VNode } from "preact"
import { forwardRef } from "./forward-ref.ts"

/** Visual role of a {@link Button}. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "icon" | "danger"

/** Control height and text scale of a {@link Button}. */
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Plain utilities. Narrowed from Preact's `Signalish<string>`: this package never renders a signal in `class`. */
  class?: string
  children?: ComponentChildren
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-purple-900 text-white hover:bg-purple-800 dark:bg-purple-700 dark:hover:bg-purple-600",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
  outline:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700",
  icon:
    "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200",
  danger: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
}

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "size-8",
  md: "size-9",
  lg: "size-10",
}

/**
 * Compose the class list of a button without rendering one.
 *
 * Exported so sibling primitives (`CopyButton`, `GeoButton`, `Dropdown`) share one
 * definition of a button instead of copying utility strings. `cn` runs last, so a
 * caller-supplied class wins over the variant's own utility in the same group.
 *
 * @param variant Visual role, defaults to `"primary"`.
 * @param size Control height, defaults to `"md"`. The `icon` variant maps it to a square box.
 * @param className Extra utilities supplied by the caller.
 * @returns The merged `class` attribute value.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    base,
    variantClasses[variant],
    variant === "icon" ? iconSizeClasses[size] : sizeClasses[size],
    className,
  )
}

/**
 * Native button with the library's variant and size vocabulary.
 *
 * Every other `button` attribute (`onClick`, `disabled`, `title`, `aria-*`, …) passes
 * straight through. `type` defaults to `"button"` so a button inside a form does not
 * submit it by accident; pass `type="submit"` when that is the intent.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` — this package's own, not `preact/compat`'s; see
 * that file for why. Preact strips `ref` off a function component's props and applies it to the
 * component instance instead of a DOM node, so a plain function here would make
 * `<Button ref={box} />` type-check and never reach the native `<button>`. `ref`'s type comes from
 * `ButtonProps` (via `JSX.ButtonHTMLAttributes<HTMLButtonElement>`), so it is already
 * `Ref<HTMLButtonElement>` — no cast needed at the call site.
 */
export const Button: (
  props: ButtonProps & { ref?: Ref<HTMLButtonElement> },
) => VNode | null = forwardRef<HTMLButtonElement, ButtonProps>("Button", function Button(
  { variant = "primary", size = "md", class: className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button {...rest} ref={ref} type={type} class={buttonClasses(variant, size, className)}>
      {children}
    </button>
  )
})
