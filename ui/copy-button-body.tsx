import type { JSX } from "preact"
import { copyToClipboard } from "@spy4x/platform/browser/clipboard"
import { Button } from "./button.tsx"
import type { HotkeyProps } from "./hotkeys.ts"

/**
 * A clipboard port. It fails by throwing, by rejecting or by returning `false`; anything else,
 * `undefined` included, counts as a copy that worked.
 */
export type CopyPort = (text: string) => void | boolean | Promise<void | boolean>

/** What a {@link CopyButton} shows: nothing yet, a copy that worked, or one that did not. */
export type CopyStatus = "idle" | "copied" | "failed"

/** Props of `CopyButton`. */
export interface CopyButtonProps extends
  Omit<
    JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    "class" | "title" | "children" | "onClick" | "type"
  >,
  HotkeyProps {
  /**
   * What lands on the clipboard: a string, or a function called at click time for a value that is
   * only known then, such as the current contents of an input.
   */
  textToCopy: string | (() => string)
  /**
   * Visible label. Without it the button renders icon-only. While a confirmation is showing, the
   * label is replaced by `copiedLabel` or `failedLabel`.
   */
  title?: string
  /**
   * Injected clipboard port, e.g. the host app's `clipboard.copy`. It reports a failure by
   * throwing, rejecting or returning `false`.
   *
   * Left out, the component uses `navigator.clipboard` and falls back to a hidden textarea plus
   * `execCommand("copy")` — `navigator.clipboard` is unavailable on insecure origins.
   */
  copy?: CopyPort
  /**
   * Tooltip, and the accessible name of an icon-only button. Defaults to `"Copy"`. A caller's own
   * `aria-label` names the button instead.
   */
  copyLabel?: string
  /** Shown and announced after a copy that worked. Defaults to `"Copied"`. */
  copiedLabel?: string
  /** Shown and announced after a copy that failed. Defaults to `"Copy failed"`. */
  failedLabel?: string
  /** Milliseconds a confirmation, of either kind, stays visible. Defaults to 1500. */
  copiedForMs?: number
  /** Runs first on every click, before the copy starts — for analytics, say. */
  onClick?: (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => void
  /**
   * Utilities for the button, appended to `Button`'s own and merged with none of them: mark a
   * replacement important with a trailing `!`.
   */
  class?: string
}

/** {@link CopyButtonProps} plus the status, which `CopyButton` itself owns. */
export interface CopyButtonBodyProps extends Omit<CopyButtonProps, "copy" | "copiedForMs"> {
  /** What the button shows now. */
  status: CopyStatus
  /** Called on a press, after the caller's `onClick`. */
  onPress: () => void
}

/** Default milliseconds a confirmation stays visible. */
export const DEFAULT_COPIED_FOR_MS = 1500

/**
 * Copy `text` through `copy`, or the browser clipboard when there is none, and say whether it
 * worked. Never throws: a text function or a port that throws, or a port that rejects, is a failed
 * copy.
 *
 * @param text What to copy, or a function that returns it now.
 * @param copy The caller's clipboard port, if any.
 * @returns `true` when the copy worked.
 */
export async function copyText(
  text: string | (() => string),
  copy?: CopyPort,
): Promise<boolean> {
  try {
    if (typeof text === "function") text = text()
    const result = await (copy ? copy(text) : copyToClipboard(text))
    return result !== false
  } catch {
    return false
  }
}

/** The glyph for each status: a clipboard, a checkmark, a cross. */
function StatusIcon({ status }: { status: CopyStatus }): JSX.Element {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  } as const
  if (status === "copied") {
    return (
      <svg class="size-4 shrink-0" stroke-width="2" {...shared}>
        <path d="m5 13 4 4L19 7" />
      </svg>
    )
  }
  if (status === "failed") {
    return (
      <svg class="size-4 shrink-0 text-danger" stroke-width="2" {...shared}>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    )
  }
  return (
    <svg class="size-4 shrink-0" stroke-width="1.5" {...shared}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

/**
 * The markup of `CopyButton`, with the status handed in.
 *
 * Kept out of the package's exports on purpose: it exists so a test can call it with each status —
 * `CopyButton` calls hooks, and a component that calls a hook cannot be invoked outside a render.
 *
 * The polite live region is a sibling of the button, not a child, so it never becomes part of the
 * button's accessible name. It is `sr-only`, which positions it absolutely, so it takes no place
 * in a flex or grid parent.
 *
 * @param props Labels, passthrough attributes and the status.
 * @returns The button and its live region.
 */
export function CopyButtonBody(
  {
    textToCopy: _textToCopy,
    title,
    copyLabel = "Copy",
    copiedLabel = "Copied",
    failedLabel = "Copy failed",
    onClick,
    class: className,
    status,
    onPress,
    "aria-label": ariaLabel,
    ...rest
  }: CopyButtonBodyProps,
): JSX.Element {
  const message = status === "copied" ? copiedLabel : status === "failed" ? failedLabel : ""
  return (
    <>
      <Button
        {...rest}
        type="button"
        variant={title ? "outline" : "icon"}
        class={className}
        title={copyLabel}
        aria-label={ariaLabel ?? (title ? undefined : copyLabel)}
        onClick={(event) => {
          onClick?.(event)
          onPress()
        }}
      >
        <StatusIcon status={status} />
        {title === undefined
          ? null
          : status === "failed"
          ? <span class="text-danger">{failedLabel}</span>
          : message || title}
      </Button>
      <span role="status" aria-live="polite" class="sr-only">{message}</span>
    </>
  )
}
