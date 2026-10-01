import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX, Ref, VNode } from "preact"
import { forwardRef } from "./forward-ref.ts"

/** Visual role of a {@link Button}. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "icon" | "danger"

/** Control height and text scale of a {@link Button}. */
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> {
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * Plain utilities, appended after the button's own and not merged into them, so `tailwind-merge`
   * stays out of the bundle (#471). To replace one of the button's own utilities, mark the
   * replacement important with a trailing `!`. Narrowed from Preact's `Signalish<string>`: this package never
   * renders a signal in `class`.
   */
  class?: string
  children?: ComponentChildren
  /**
   * Work the button started is still running. The button shows a spinner, sets `aria-busy` and
   * `aria-disabled`, and ignores presses, but stays focusable, so focus is not lost mid-action.
   */
  busy?: boolean
  /** Shown instead of `children` while `busy`, such as "Saving…". Left out, the children stay. */
  busyLabel?: ComponentChildren
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"

/**
 * The dark primary fill is accent step 600: the one step that stands 3:1 off the gray-900 canvas
 * and still holds the white label at 4.5:1. Its hover darkens to 700, which keeps the label and
 * shows the pointer, and sits below 3:1 on the canvas only while the pointer is on it.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-900 text-accent-foreground hover:bg-accent-800 dark:bg-accent-600 dark:hover:bg-accent-700",
  secondary: "bg-hover text-foreground hover:bg-track",
  outline: "border border-control bg-surface text-foreground hover:bg-hover",
  ghost: "bg-transparent text-foreground hover:bg-hover",
  icon: "bg-transparent text-muted hover:bg-hover hover:text-foreground",
  danger: "bg-danger-fill text-danger-fill-foreground hover:bg-danger-fill-hover",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2 py-2 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2 text-base",
}

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "size-8",
  md: "size-9",
  lg: "size-10",
}

/**
 * Compose the class list of a button without rendering one.
 *
 * Exported so sibling primitives (`CopyButton`, `Dropdown`) share one
 * definition of a button instead of copying utility strings. The classes are joined, not merged:
 * a caller's class is appended, and replaces one of the button's own utilities only when it is
 * marked important with a trailing `!`.
 *
 * @param variant Visual role, defaults to `"primary"`.
 * @param size Control height, defaults to `"md"`. The `icon` variant maps it to a square box.
 * @param className Extra utilities supplied by the caller.
 * @returns The `class` attribute value.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return join(
    base,
    variantClasses[variant],
    variant === "icon" ? iconSizeClasses[size] : sizeClasses[size],
    className,
  )
}

/** The spinner a busy {@link Button} shows; the button's own text or `aria-label` names it. */
function BusySpinner(): JSX.Element {
  return (
    <svg class="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}

/** Cancels a press on a busy button: its own `onClick` never runs, and a form is not submitted. */
function ignorePress(event: MouseEvent): void {
  event.preventDefault()
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
 *
 * `busy` does not set `disabled`: a disabled button drops focus to `<body>`, so a keyboard user who
 * pressed Enter would lose their place. It sets `aria-disabled` instead and cancels the press, which
 * also stops a submit button from sending its form a second time. An icon button has no room for a
 * label, so the spinner takes the icon's place and `busyLabel` is not shown.
 */
export const Button: (
  props: ButtonProps & { ref?: Ref<HTMLButtonElement> },
) => VNode | null = forwardRef<HTMLButtonElement, ButtonProps>("Button", function Button(
  {
    variant = "primary",
    size = "md",
    class: className,
    type = "button",
    busy = false,
    busyLabel,
    children,
    ...rest
  },
  ref,
) {
  if (!busy) {
    return (
      <button {...rest} ref={ref} type={type} class={buttonClasses(variant, size, className)}>
        {children}
      </button>
    )
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      class={buttonClasses(variant, size, className)}
      aria-busy="true"
      aria-disabled="true"
      onClick={ignorePress}
    >
      <BusySpinner />
      {variant === "icon" ? null : busyLabel ?? children}
    </button>
  )
})
