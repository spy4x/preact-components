import { cn } from "@preact-components/signals/cn"
import type { ComponentChildren } from "preact"

export interface PageTitleProps {
  children: ComponentChildren
  /**
   * Replaces the default heading utilities entirely.
   *
   * Layout (`mb-6`, the flex row) used to be hardcoded in the source component, so every
   * page that wanted different spacing had to fight it. It is the caller's call now.
   */
  class?: string
}

const defaultClasses =
  "mb-6 flex items-center gap-3 leading-none text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100"

/**
 * Page heading with the library's `h1` typography inlined.
 *
 * The source component used the app's `h1` component class; the utilities are inlined here
 * so this package does not depend on the design-token layer for its chrome.
 */
export function PageTitle({ children, class: className }: PageTitleProps) {
  return <h1 class={cn(defaultClasses, className)}>{children}</h1>
}
