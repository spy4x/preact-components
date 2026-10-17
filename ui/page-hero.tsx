import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/** Props of {@link PageHero}. */
export interface PageHeroProps {
  /** A short line above the title, in mono accent text, such as "Pricing". */
  eyebrow?: ComponentChildren
  /** The page's heading, its `<h1>`. */
  title: ComponentChildren
  /** One or two sentences under the title, in the lead size. */
  lead?: ComponentChildren
  /** The page's buttons, or a line such as a date, under the lead. */
  children?: ComponentChildren
  /** Utilities merged over the band's own, such as a background. */
  class?: string
}

/**
 * The top band of an inner page on a public site: an eyebrow, the page's `<h1>`, a lead and its
 * buttons, in the marketing column (`max-w-6xl`) with a hairline under it.
 *
 * Sizes and spacing are the design language's (`docs/design-language.md`): the title is the
 * marketing page `h1` (`text-3xl`, `text-5xl` from `lg`, weight 600, balanced), the lead is
 * `text-lg` to `text-xl`, muted and at most `max-w-2xl`, and the band is `py-12`, `py-16` from
 * `lg`. It renders on the server and needs no JavaScript.
 *
 * The band is a `<div>`, not a `<header>`: a page that places it outside `<main>` would otherwise
 * gain a second banner landmark beside its site header.
 *
 * @param props See {@link PageHeroProps}.
 * @returns The band.
 */
export function PageHero(
  { eyebrow, title, lead, children, class: className }: PageHeroProps,
): JSX.Element {
  return (
    <div class={cn("border-b border-subtle", className)} data-e2e="page-hero">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {eyebrow && <p class="font-mono text-sm font-medium text-primary">{eyebrow}</p>}
        <h1 class="max-w-3xl text-3xl font-semibold tracking-tight text-balance text-foreground lg:text-5xl">
          {title}
        </h1>
        {lead && <p class="max-w-2xl text-lg text-muted text-pretty lg:text-xl">{lead}</p>}
        {children}
      </div>
    </div>
  )
}
