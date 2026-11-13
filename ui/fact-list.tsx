import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"

/** One label and value of a {@link FactList}. */
export interface Fact {
  /** What the value is, such as `"Attempts"`. */
  label: string
  /** The value, such as `"4 of 20"` or a link. */
  value: ComponentChildren
  /** A muted line under the value that explains it. */
  hint?: ComponentChildren
  /** Stable key, and the row's `data-e2e`. Defaults to the label. */
  id?: string
}

/** Props of {@link FactList}. */
export interface FactListProps {
  /** The facts, in reading order. An empty list renders nothing. */
  facts: readonly Fact[]
  /** Utilities on the list. */
  class?: string
}

/**
 * Labels and their values, such as the details of a record: a description list (`<dl>`) of rows
 * divided by hairlines. On a phone each value sits under its muted label; from `sm` the labels
 * take the first third and the values the rest, so a column of values reads down the page. A long
 * value wraps anywhere instead of overflowing. A hint is a second `<dd>` under the value.
 *
 * Plain markup, so it shows on a server-rendered page with no JavaScript.
 *
 * @param props The facts, see {@link FactListProps}.
 */
export function FactList({ facts, class: className }: FactListProps): JSX.Element | null {
  if (facts.length === 0) return null
  return (
    <dl class={join("divide-y divide-subtle text-sm", className)} data-e2e="fact-list">
      {facts.map((fact) => (
        <div
          key={fact.id ?? fact.label}
          class="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-3"
          data-e2e={fact.id}
        >
          <dt class="text-muted">{fact.label}</dt>
          <dd class="min-w-0 font-medium text-foreground wrap-anywhere sm:col-span-2">
            {fact.value}
          </dd>
          {fact.hint !== undefined && fact.hint !== null && (
            <dd class="text-xs text-muted sm:col-span-2 sm:col-start-2">{fact.hint}</dd>
          )}
        </div>
      ))}
    </dl>
  )
}
