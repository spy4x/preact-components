import type { ComponentChildren, JSX } from "preact"
import { translate, useT } from "./i18n.tsx"

/** One anchor of {@link OnThisPage}. Every other anchor attribute, such as `data-*`, passes through. */
export interface OnThisPageLink
  extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "class" | "children"> {
  /** The section's name, as its heading reads. */
  label: ComponentChildren
  /** The section's fragment, such as `"#limits"`. */
  href: string
  /** A `data-*` attribute for the anchor, such as an analytics event name. */
  [data: `data-${string}`]: string | undefined
}

/** Props of {@link OnThisPage}. */
export interface OnThisPageProps {
  /** The page's sections, in order. An empty list renders nothing. */
  links: readonly OnThisPageLink[]
  /** The list's name, shown and read as the landmark's name. Defaults to `"On this page"`. */
  label?: string
  /**
   * The width from which the list stands open in a side column; below it the list folds into a
   * `<details>`. `"lg"` (1024 px, the default) or `"xl"` (1280 px).
   */
  openFrom?: "lg" | "xl"
}

/** The fold and the open list, per breakpoint, written out so Tailwind finds every class. */
const BREAKPOINTS = {
  lg: { folded: "lg:hidden", open: "hidden lg:sticky lg:top-24 lg:block" },
  xl: { folded: "xl:hidden", open: "hidden xl:sticky xl:top-24 xl:block" },
} as const

const LINK =
  "rounded-sm text-muted max-sm:flex max-sm:min-h-11 max-sm:items-center underline-offset-4 hover:text-foreground hover:underline " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"

/**
 * The anchors of a long page. From `openFrom` it is an open list in a side column, sticky under
 * the site's header; below that it folds into a `<details>`, so it works without JavaScript either
 * way. A named `<nav>` landmark; on a phone every row is 44 px tall, so a thumb hits one.
 *
 * @param props The links and options, see {@link OnThisPageProps}.
 */
export function OnThisPage(
  { links, label: labelProp, openFrom = "lg" }: OnThisPageProps,
): JSX.Element | null {
  const translator = useT()
  const label = labelProp ?? translate(translator, "OnThisPage.label", "On this page")
  if (links.length === 0) return null
  const breakpoint = BREAKPOINTS[openFrom]
  const list = (
    <ul class="flex flex-col gap-0 text-sm sm:gap-2">
      {links.map(({ label: name, href, ...rest }, index) => (
        <li key={index}>
          <a {...rest} href={href} class={LINK}>{name}</a>
        </li>
      ))}
    </ul>
  )
  return (
    <nav aria-label={label} data-e2e="on-this-page">
      <details class={`rounded-card border border-subtle bg-surface px-4 ${breakpoint.folded}`}>
        <summary class="cursor-pointer py-3 font-medium">{label}</summary>
        <div class="pb-3">{list}</div>
      </details>
      <div class={breakpoint.open}>
        <p class="mb-3 text-sm font-semibold">{label}</p>
        {list}
      </div>
    </nav>
  )
}
