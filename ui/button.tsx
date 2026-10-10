import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX, Ref, RefObject, VNode } from "preact"
import { useCallback } from "preact/hooks"
import { forwardRef } from "./forward-ref.ts"
import { HotkeyHint } from "./hotkey-hint.tsx"
import { ariaKeyShortcuts, type HotkeyProps, useApplePlatform, useHotkeyClick } from "./hotkeys.ts"
import { followLinkClick } from "./link.tsx"

/** Visual role of a {@link Button}. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "icon" | "danger"

/** Control height and text scale of a {@link Button}. */
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps
  extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class">, HotkeyProps {
  variant?: ButtonVariant
  /**
   * `"none"` sets no padding, gap or text size (and, on the `icon` variant, no box size), so the
   * caller sizes the button with its own `class`.
   */
  size?: ButtonSize | "none"
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

/**
 * A {@link Button} that is a link: given `href`, it renders an `<a>` with the classes the same
 * `variant`, `size` and `class` give a `<button>`. A separate interface rather than a union inside
 * {@link ButtonProps}, so an `interface` that extends `ButtonProps` keeps compiling.
 */
export interface ButtonLinkProps extends
  Omit<
    JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
    "class" | "href" | "target" | "download" | "onClick" | "size"
  >,
  HotkeyProps {
  /** Where the link goes. Rendered as a real `href`, so the link works before any script runs. */
  href: string
  /**
   * Called with `href` on a plain click instead of the browser following the link — the app's
   * router, passed in. A click with a modifier, a middle click, another `target` or a `download`
   * stays the browser's, as on `Link`. Left out, every click is the browser's.
   */
  navigate?: (href: string) => void
  /** Narrowed from Preact's `Signalish<string>`: the click rule reads it as a plain value. */
  target?: string
  /** Narrowed from Preact's `Signalish<…>`: the click rule reads it as a plain value. */
  download?: string | boolean
  /** Runs first, on every click; call `preventDefault()` in it to keep `navigate` out of one. */
  onClick?: (event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void
  /**
   * Renders the link with no `href`, `role="link"` and `aria-disabled="true"`, dimmed like a
   * disabled button. Without `href` it is out of the tab order and a click goes nowhere, as a
   * disabled `<button>` is; screen readers still announce it as an unavailable link.
   */
  disabled?: boolean
  variant?: ButtonVariant
  /**
   * `"none"` sets no padding, gap or text size (and, on the `icon` variant, no box size), so the
   * caller sizes the button with its own `class`.
   */
  size?: ButtonSize | "none"
  /** Plain utilities, appended after the button's own; see {@link ButtonProps.class}. */
  class?: string
  children?: ComponentChildren
}

const baseLayout = "inline-flex items-center justify-center"
const baseLook =
  "rounded-md font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"

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

/** The gap sits with the size, so `"none"` leaves it out; the other sizes keep the same class list. */
const gapClasses: Record<ButtonSize | "none", string> = {
  sm: "gap-2",
  md: "gap-2",
  lg: "gap-2",
  none: "",
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
 * Compose the class list of a button without rendering one.
 *
 * Exported so sibling primitives (`CopyButton`, `Dropdown`) share one
 * definition of a button instead of copying utility strings. The classes are joined, not merged:
 * a caller's class is appended, and replaces one of the button's own utilities only when it is
 * marked important with a trailing `!`.
 *
 * @param variant Visual role, defaults to `"primary"`.
 * @param size Control height, defaults to `"md"`. The `icon` variant maps it to a square box.
 *   `"none"` adds no padding, gap, text size or box size.
 * @param className Extra utilities supplied by the caller.
 * @returns The `class` attribute value.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize | "none" = "md",
  className?: string,
): string {
  return join(
    baseLayout,
    gapClasses[size],
    baseLook,
    variantClasses[variant],
    variant === "icon" ? iconSizeClasses[size] : sizeClasses[size],
    className,
  )
}

/** The spinner a busy {@link Button} shows; the button's own text or `aria-label` names it. */
function BusySpinner(): JSX.Element {
  return (
    <svg
      class="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}

/** Cancels a press on a busy button: its own `onClick` never runs, and a form is not submitted. */
function ignorePress(event: MouseEvent): void {
  event.preventDefault()
}

/** Whether the props are a {@link ButtonLinkProps}: only the link form has an `href`. */
function isLinkProps(props: ButtonProps | ButtonLinkProps): props is ButtonLinkProps {
  return (props as ButtonLinkProps).href !== undefined
}

/** A disabled link's dimming: `:disabled` never matches an `<a>`, so it is written out. */
const disabledLinkClasses = "pointer-events-none opacity-50"

/** What a {@link Button} with a `hotkey` adds to its element: the announcement and the hint. */
interface HotkeyParts {
  /** The `aria-keyshortcuts` value, or `undefined` without a hotkey. */
  shortcuts: string | undefined
  /** The `Kbd` hint, or `null`. */
  hint: VNode | null
}

/** The {@link HotkeyParts} of a button without a hotkey. */
const NO_HOTKEY: HotkeyParts = { shortcuts: undefined, hint: null }

/** The `<a>` a {@link Button} renders when it is given `href`. */
function renderLink(
  {
    hotkey: _hotkey,
    hotkeyHint: _hotkeyHint,
    kbdLabels: _kbdLabels,
    variant = "primary",
    size = "md",
    class: className,
    href,
    navigate,
    target,
    download,
    onClick,
    disabled = false,
    children,
    ...rest
  }: ButtonLinkProps,
  ref: Ref<HTMLAnchorElement> | null,
  { shortcuts, hint }: HotkeyParts,
): VNode {
  if (disabled) {
    return (
      <a
        aria-keyshortcuts={shortcuts}
        {...rest}
        ref={ref}
        role="link"
        aria-disabled="true"
        class={buttonClasses(variant, size, join(disabledLinkClasses, className))}
      >
        {children}
        {hint}
      </a>
    )
  }
  return (
    <a
      aria-keyshortcuts={shortcuts}
      {...rest}
      ref={ref}
      href={href}
      target={target}
      download={download}
      class={buttonClasses(variant, size, className)}
      onClick={(event) => {
        onClick?.(event)
        followLinkClick(event, { href, navigate, target, download })
      }}
    >
      {children}
      {hint}
    </a>
  )
}

/** The native `<button>` a {@link Button} renders without `href`. */
function renderButton(
  {
    hotkey: _hotkey,
    hotkeyHint: _hotkeyHint,
    kbdLabels: _kbdLabels,
    variant = "primary",
    size = "md",
    class: className,
    type = "button",
    busy = false,
    busyLabel,
    children,
    ...rest
  }: ButtonProps,
  ref: Ref<HTMLButtonElement> | null,
  { shortcuts, hint }: HotkeyParts,
): VNode {
  if (!busy) {
    return (
      <button
        aria-keyshortcuts={shortcuts}
        {...rest}
        ref={ref}
        type={type}
        class={buttonClasses(variant, size, className)}
      >
        {children}
        {hint}
      </button>
    )
  }

  return (
    <button
      aria-keyshortcuts={shortcuts}
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
      {hint}
    </button>
  )
}

/**
 * {@link Button}'s two call shapes: given `href`, a link with an anchor's ref, or a native
 * `<button>` with its ref. The link comes first: in the other order TypeScript stops typing a
 * link's callbacks from context, and `navigate={(href) => …}` fails as an implicit `any`.
 */
export interface ButtonOverloads {
  (props: ButtonLinkProps & { ref?: Ref<HTMLAnchorElement> }): VNode | null
  (props: ButtonProps & { ref?: Ref<HTMLButtonElement> }): VNode | null
}

/**
 * Native button with the library's variant and size vocabulary, or a link that looks like one.
 *
 * Every other `button` attribute (`onClick`, `disabled`, `title`, `aria-*`, …) passes
 * straight through. `type` defaults to `"button"` so a button inside a form does not
 * submit it by accident; pass `type="submit"` when that is the intent.
 *
 * Given `href` ({@link ButtonLinkProps}), it renders an `<a>` with the classes the same `variant`,
 * `size` and `class` give the `<button>`, focus ring included. Its optional `navigate` port follows
 * the rule `Link` runs (`followLinkClick`): a plain click on a link to this page's origin routes,
 * every other click is the browser's. A disabled link drops its `href`; see {@link ButtonLinkProps.disabled}. `busy` is a
 * button's alone: a link starts no work of its own to wait on.
 *
 * Wrapped in `forwardRef` from `./forward-ref.ts` — this package's own, not `preact/compat`'s; see
 * that file for why. Preact strips `ref` off a function component's props and applies it to the
 * component instance instead of a DOM node, so a plain function here would make
 * `<Button ref={box} />` type-check and never reach the native `<button>`. `ref`'s type comes from
 * `ButtonProps` (via `JSX.ButtonHTMLAttributes<HTMLButtonElement>`), so it is already
 * `Ref<HTMLButtonElement>` — no cast needed at the call site; a link's is `Ref<HTMLAnchorElement>`.
 *
 * `busy` does not set `disabled`: a disabled button drops focus to `<body>`, so a keyboard user who
 * pressed Enter would lose their place. It sets `aria-disabled` instead and cancels the press, which
 * also stops a submit button from sending its form a second time. An icon button has no room for a
 * label, so the spinner takes the icon's place and `busyLabel` is not shown.
 */
export const Button: ButtonOverloads = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps | ButtonLinkProps
>("Button", function Button(props, ref) {
  if (props.hotkey !== undefined) return <HotkeyButton {...props} forwardedRef={ref} />
  return isLinkProps(props)
    ? renderLink(props, ref as Ref<HTMLAnchorElement> | null, NO_HOTKEY)
    : renderButton(props, ref as Ref<HTMLButtonElement> | null, NO_HOTKEY)
  // One implementation takes either form's ref, which a ref typed for one element cannot be
  // assigned to; the overloads are what tie each form to its own element's ref.
}) as ButtonOverloads

/**
 * One callback ref that fills the button's own ref and the caller's, kept stable across renders
 * so Preact does not detach and reattach the caller's ref each time.
 */
function useMergedRef<Node>(
  own: RefObject<Node>,
  theirs: Ref<Node> | null,
): (node: Node | null) => void {
  return useCallback((node: Node | null) => {
    own.current = node
    if (typeof theirs === "function") theirs(node)
    else if (theirs !== null) theirs.current = node
  }, [own, theirs])
}

/**
 * A {@link Button} with a `hotkey`: its own component, so a button without one runs no hook and
 * renders exactly the element it always has. Turning `hotkey` on or off therefore remounts the
 * element.
 */
function HotkeyButton(
  { forwardedRef, ...props }: (ButtonProps | ButtonLinkProps) & {
    forwardedRef: Ref<HTMLButtonElement | HTMLAnchorElement> | null
  },
): VNode {
  const { hotkey, hotkeyHint, kbdLabels, variant } = props
  const link = isLinkProps(props)
  // A disabled or busy button binds nothing. A `disabled` given as a signal still binds, and
  // `clickByHotkey` refuses the press then, as it does for a disabled `<fieldset>` around it.
  const idle = props.disabled !== true && (link || (props as ButtonProps).busy !== true)
  const own = useHotkeyClick<HTMLButtonElement | HTMLAnchorElement>(hotkey, { enabled: idle })
  const apple = useApplePlatform()
  const ref = useMergedRef(own, forwardedRef)
  const parts: HotkeyParts = {
    shortcuts: hotkey === undefined ? undefined : ariaKeyShortcuts(hotkey, apple),
    hint: hotkey !== undefined && (hotkeyHint ?? variant !== "icon")
      ? <HotkeyHint keys={hotkey} apple={apple} labels={kbdLabels} />
      : null,
  }
  return link
    ? renderLink(props, ref as Ref<HTMLAnchorElement>, parts)
    : renderButton(props as ButtonProps, ref as Ref<HTMLButtonElement>, parts)
}
