import { cn } from "@spy4x/preact-cn"
import { IconAlertTriangle } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useId, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { useLabels } from "./i18n.tsx"

/** One problem an {@link ErrorSummary} lists. */
export interface ErrorSummaryItem {
  /** Stable across re-checks, such as the line and the message joined, so a row keeps its focus. */
  key: string
  /** The row's button: where the problem is, such as `"Line 14"`. */
  label: string
  /** What is wrong, after the button. */
  message: ComponentChildren
}

export interface ErrorSummaryProps
  extends Omit<JSX.HTMLAttributes<HTMLElement>, "title" | "class" | "onSelect"> {
  /** The panel's title, which also names its region, such as `"2 problems in this post"`. */
  title: string
  /** One line under the title on what the problems mean, such as what a reader will miss. */
  children?: ComponentChildren
  /** The problems, in the order they appear. With none, only the status line is drawn. */
  items: readonly ErrorSummaryItem[]
  /** Called when a row's button is pressed: move focus to the problem, select it, show it. */
  onSelect: (item: ErrorSummaryItem, index: number) => void
  /**
   * The polite status line's text for a count above zero. English default, `"1 problem"` /
   * `"3 problems"`.
   */
  countMessage?: (count: number) => string
  /** The status line's text once the last problem is gone. Defaults to `"No problems left"`. */
  noneMessage?: string
  class?: string
}

/** The English words of `ErrorSummary`, each one a prop of its own. */
const ERROR_SUMMARY_LABELS: {
  count: (count: number) => string
  noneMessage: string
} = {
  count: (count: number) => count === 1 ? "1 problem" : `${count} problems`,
  noneMessage: "No problems left",
}

/**
 * A titled list of problems in something the reader is editing, each row a button that takes the
 * reader to its problem: a document's broken lines under its editor, or a long form's errors above
 * its fields.
 *
 * The panel is a region named by its title, drawn in the warning tone, and only while there are
 * problems. A visually hidden status line beside it announces a change in the count politely, and
 * "No problems left" once a list that had problems empties; the first render announces nothing,
 * and a re-render with the same count says nothing new. The panel moves no focus itself:
 * `onSelect` does, and a caller that sends the reader here (a dialog's "Go to problems") focuses
 * the first row, `root.querySelector("button")`. Any other attribute, such as `id` or `data-*`,
 * lands on the panel.
 *
 * @param props Title, rows and the select port, see {@link ErrorSummaryProps}.
 * @returns The status line, with the panel after it while `items` is not empty.
 */
export function ErrorSummary(
  {
    title,
    children,
    items,
    onSelect,
    countMessage: countMessageProp,
    noneMessage: noneMessageProp,
    class: className,
    ...rest
  }: ErrorSummaryProps,
): JSX.Element {
  const text = useLabels("ErrorSummary", ERROR_SUMMARY_LABELS, {
    count: countMessageProp,
    noneMessage: noneMessageProp,
  }, { count: ["count"] })
  const titleId = useId()
  // Whether the list has held a problem, so an empty first render does not say "No problems left".
  const hadItems = useRef(false)
  if (items.length > 0) hadItems.current = true
  const status = items.length > 0
    ? text.count(items.length)
    : hadItems.current
    ? text.noneMessage
    : ""

  return (
    <>
      <p role="status" class="sr-only" data-e2e="error-summary-status">{status}</p>
      {items.length > 0 && (
        <section
          {...rest}
          aria-labelledby={titleId}
          class={cn(
            "flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-foreground",
            className,
          )}
        >
          <IconAlertTriangle class="size-5 text-warning" />
          <div class="min-w-0 flex-1">
            <p id={titleId} class="font-medium">{title}</p>
            {children !== undefined && children !== null && children !== "" && (
              <div class="mt-1">{children}</div>
            )}
            <ul class="mt-3 flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={item.key} class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    class="shrink-0 tabular-nums max-sm:min-h-11"
                    data-e2e="error-summary-row"
                    aria-describedby={`${titleId}-${index}`}
                    onClick={() =>
                      onSelect(item, index)}
                  >
                    {item.label}
                  </Button>
                  <span id={`${titleId}-${index}`} class="min-w-0 flex-1">{item.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
