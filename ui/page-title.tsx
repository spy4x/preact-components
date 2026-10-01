import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

export interface PageTitleProps {
  children: ComponentChildren
  /**
   * Utilities merged after the defaults; a later utility in the same group wins.
   *
   * The heading carries no outer margin: the space under it is the parent's gap (`Stack`,
   * `Section`, `Page` in `./layout`), as for every component in this library.
   */
  class?: string
}

const defaultClasses =
  "flex items-center gap-3 leading-none text-2xl font-bold text-foreground sm:text-3xl"

/**
 * Page heading with the library's `pc-h1` typography inlined.
 *
 * The source component used the app's `h1` component class (the preset's `pc-h1` today); the
 * utilities are inlined here so this package does not depend on the design-token layer for its
 * chrome.
 */
export function PageTitle({ children, class: className }: PageTitleProps): JSX.Element {
  return <h1 class={cn(defaultClasses, className)}>{children}</h1>
}
