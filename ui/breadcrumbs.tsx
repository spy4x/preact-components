import { join } from "@spy4x/preact-cn/join"
import { IconChevronRight } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { translate, useT } from "./i18n.tsx"

/** One step of a {@link Breadcrumbs} trail. */
export interface BreadcrumbItem {
  /** The step's name, such as `"Features"`. */
  label: ComponentChildren
  /** Where the step goes. Left out on the last step, it is the current page and is no link. */
  href?: string
}

/** Props of {@link Breadcrumbs}. */
export interface BreadcrumbsProps {
  /** The trail, from the site's root to the page. An empty trail renders nothing. */
  items: readonly BreadcrumbItem[]
  /** The landmark's name. Defaults to `"Breadcrumb"`. */
  label?: string
  /** Utilities on the `<nav>`. */
  class?: string
}

const LINK =
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-hidden " +
  "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/**
 * Where a page sits on a site, as a trail of links above its `h1`: `Seed › Features › Sign-in`.
 * A named `<nav>` landmark around an ordered list. The last step without an `href` is the current
 * page, marked `aria-current="page"`. The chevrons between steps are hidden from screen readers
 * and turn around in a right-to-left page. Plain markup, so it works with no JavaScript.
 *
 * @param props The trail and options, see {@link BreadcrumbsProps}.
 */
export function Breadcrumbs(
  { items, label: labelProp, class: className }: BreadcrumbsProps,
): JSX.Element | null {
  const translator = useT()
  const label = labelProp ?? translate(translator, "Breadcrumbs.label", "Breadcrumb")
  if (items.length === 0) return null
  const last = items.length - 1
  return (
    <nav aria-label={label} class={join("text-sm", className)} data-e2e="breadcrumbs">
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        {items.map((item, index) => (
          <li key={index} class="flex min-w-0 items-center gap-2 break-words">
            {index > 0 && <IconChevronRight class="size-4" />}
            {item.href === undefined
              ? (
                <span aria-current={index === last ? "page" : undefined} class="text-foreground">
                  {item.label}
                </span>
              )
              : <a href={item.href} class={LINK}>{item.label}</a>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
