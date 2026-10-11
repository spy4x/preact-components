import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"

export interface ErrorStateProps {
  /** Message to show. Empty, `null` or `undefined` renders nothing. */
  message?: string | null
  /**
   * Moves focus to the message when it appears, and again when its text changes. For a refusal with
   * no field to sit under, such as one inside a confirmation dialog or under a row: a keyboard or
   * screen reader user lands on it instead of staying on the button that caused it. The panel gets
   * `tabindex="-1"`, so it can hold focus without becoming a Tab stop. Defaults to `false`: a
   * message that is on the page when it loads, or that stands in for a list, takes no focus.
   */
  focusOnAppear?: boolean
  /** Stamps `data-e2e` on the panel. */
  dataE2E?: string
  class?: string
}

/**
 * Message for an expected failure, shown where the result that failed would have been, such as a
 * list whose request failed.
 *
 * It is not a page-wide banner: a problem the reader must act on, with a title and an action, is a
 * `Notice` with `tone="danger"`. Nor does it catch anything: a render that throws is
 * `ErrorBoundary`'s.
 *
 * The source component read the message out of the app's error signal. It is a prop here, and
 * the component still renders nothing for a falsy message so callers can pass a possibly-empty
 * value straight through.
 *
 * With `focusOnAppear` the panel takes focus each time a message appears or changes, which is how a
 * refusal that belongs to no field is shown: inside the dialog that asked, or under the row it is
 * about.
 *
 * The panel reads the theme's danger tokens: `--color-danger` for its text and border,
 * `--color-danger-soft` for its background. An app that repaints them sees the panel follow.
 */
export function ErrorState(
  { message, focusOnAppear = false, dataE2E, class: className }: ErrorStateProps,
): JSX.Element | null {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusOnAppear && message) panel.current?.focus()
  }, [focusOnAppear, message])

  if (!message) return null

  return (
    <div
      ref={panel}
      role="alert"
      tabIndex={focusOnAppear ? -1 : undefined}
      data-e2e={dataE2E}
      class={cn(
        "mx-auto max-w-[650px] rounded-lg border border-danger bg-danger-soft p-4 text-center text-danger",
        focusOnAppear &&
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus",
        className,
      )}
    >
      <p>{message}</p>
    </div>
  )
}
