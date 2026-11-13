import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/** One step of a {@link Steps} list. */
export interface StepItem {
  /** The step's name, shown as a heading. */
  title: string
  /** What happens in this step. */
  text?: ComponentChildren
}

/** Props of {@link Steps}. */
export interface StepsProps {
  /** The steps, in order. */
  items: readonly StepItem[]
  /** Level of each step's heading, `<h3>` or `<h4>`. Defaults to `3`. */
  headingLevel?: 3 | 4
  /** `"horizontal"` lays the steps out in a row from `lg` up; below `lg` they always stack. */
  orientation?: "vertical" | "horizontal"
  class?: string
}

/*
 * The number is a CSS counter drawn in a circle hidden from assistive tech: the ordered list
 * already tells a screen reader each step's position, so the number is not read twice.
 * `role="list"` keeps the list semantics Safari drops from a list with `list-style: none`.
 */
const circle =
  "absolute start-0 top-0 flex size-8 items-center justify-center rounded-full bg-selected " +
  "text-sm font-semibold text-selected-foreground before:content-[counter(step)]"

const connectorVertical = "absolute start-4 top-8 bottom-0 border-s border-subtle"
const connectorHorizontal = "lg:start-8 lg:end-0 lg:top-4 lg:bottom-auto lg:border-s-0 lg:border-t"

/**
 * A numbered "how it works" list: each step a heading and a line of text, joined by a thin line.
 *
 * Server-rendered and static: no hooks and no JavaScript. Vertical by default; `orientation`
 * `"horizontal"` puts the steps side by side from `lg` up.
 *
 * @param props The steps and options, see {@link StepsProps}.
 * @returns The ordered list.
 */
export function Steps(
  { items, headingLevel = 3, orientation = "vertical", class: className }: StepsProps,
): JSX.Element {
  const Heading = `h${headingLevel}` as "h3"
  const horizontal = orientation === "horizontal"
  return (
    <ol
      role="list"
      class={cn(
        "flex list-none flex-col [counter-reset:step]",
        horizontal && "lg:flex-row",
        className,
      )}
    >
      {items.map((step, index) => (
        <li
          key={step.title}
          class={cn(
            "relative pb-8 ps-12 last:pb-0 [counter-increment:step]",
            horizontal && "lg:flex-1 lg:pb-0 lg:ps-0 lg:pe-6 lg:pt-12 lg:last:pe-0",
          )}
        >
          <span aria-hidden="true" class={circle} />
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              class={cn(connectorVertical, horizontal && connectorHorizontal)}
            />
          )}
          <Heading class="pt-1 text-base font-medium text-balance text-foreground">
            {step.title}
          </Heading>
          {step.text !== undefined && <div class="mt-1 text-sm text-muted">{step.text}</div>}
        </li>
      ))}
    </ol>
  )
}
