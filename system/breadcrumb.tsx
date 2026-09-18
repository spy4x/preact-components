/**
 * `Breadcrumb` — the visible trail behind `SEOHead`'s `BreadcrumbList`.
 *
 * Renders nothing for a trail of one entry or less: a single "Home" link is chrome the visitor
 * already has. The last entry is never a link and carries `aria-current="page"`, so a screen
 * reader announces where the page sits even though its own name is not a link.
 */

import { cn } from "@preact-components/signals/cn"
import type { Crumb } from "./head.ts"

export interface BreadcrumbProps {
  /**
   * Trail from the root to the current page. Build it with
   * {@link breadcrumbsFromCanonical} or hand it over from the route.
   */
  items: readonly Crumb[]
  /** Accessible name of the `<nav>`. Defaults to `"Breadcrumb"`. */
  label?: string
  /** Rendered between entries, `aria-hidden`. Defaults to `"/"`. */
  separator?: string
  /** Utilities for the wrapping `<nav>`. */
  class?: string
}

const listClass = "flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400"
const linkClass = "transition-colors hover:text-purple-700 dark:hover:text-purple-300"
const currentClass = "font-medium text-gray-700 dark:text-gray-200"
const mutedClass = "text-gray-400 dark:text-gray-500"
const separatorClass = "text-gray-300 dark:text-gray-600"

export function Breadcrumb(
  { items, label = "Breadcrumb", separator = "/", class: className }: BreadcrumbProps,
) {
  if (items.length <= 1) return null

  return (
    <nav aria-label={label} class={cn("mb-6", className)}>
      <ol class={listClass}>
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${crumb.href ?? ""}${crumb.name}`} class="flex items-center gap-1">
              {!isLast && crumb.href
                ? <a href={crumb.href} class={linkClass}>{crumb.name}</a>
                : (
                  <span
                    class={isLast ? currentClass : mutedClass}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.name}
                  </span>
                )}
              {!isLast && <span aria-hidden="true" class={separatorClass}>{separator}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
