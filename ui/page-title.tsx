import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

export interface PageTitleProps {
  children: ComponentChildren
  /**
   * Level of the heading, `<h1>` to `<h6>`. Defaults to `1`. Pick another when the page already
   * has its `<h1>`; the look stays the same.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
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
export function PageTitle(
  { children, headingLevel = 1, class: className }: PageTitleProps,
): JSX.Element {
  const Heading = `h${headingLevel}` as "h1"
  return <Heading class={cn(defaultClasses, className)}>{children}</Heading>
}
