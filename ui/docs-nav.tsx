import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/** One guide of a {@link DocsNav}. */
export interface DocsNavItem {
  /** The guide's address, compared with `current`. */
  href: string
  /** The guide's title. */
  title: string
}

/** One group of guides of a {@link DocsNav}, such as "Use" or "Build". */
export interface DocsNavGroup {
  /** The group's name, shown above its guides. */
  title: string
  /** The guides, in reading order. */
  items: readonly DocsNavItem[]
}

/** The words a {@link DocsNav} shows. */
export interface DocsNavLabels {
  /** The navigation's accessible name. Default: `"Docs"`. */
  label: string
  /** The folded list's summary on a narrow screen. Default: `"Guides: Deploy and operate"`. */
  summary: (title: string) => string
  /** The summary when no guide is current. Default: `"Guides"`. */
  summaryNone: string
}

/** The English words {@link DocsNav} shows when the caller passes none. */
export const DOCS_NAV_LABELS: DocsNavLabels = {
  label: "Docs",
  summary: (title) => `Guides: ${title}`,
  summaryNone: "Guides",
}

/** Props of {@link DocsNav}. */
export interface DocsNavProps {
  /** The groups, in order. An empty list renders nothing. */
  groups: readonly DocsNavGroup[]
  /** The `href` of the guide on screen, marked `aria-current="page"`. */
  current?: string
  /** The words shown; see {@link DOCS_NAV_LABELS}. */
  labels?: Partial<DocsNavLabels>
  /** Utilities on the `<nav>`. */
  class?: string
}

const LINK =
  "flex min-h-11 items-center rounded-e-sm border-s-2 ps-3 pe-2 text-sm text-pretty lg:min-h-0 lg:py-1 " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"

/**
 * The side list of a set of guides, grouped under their names, with the guide on screen marked
 * by `aria-current="page"` and a bar on the list's inner edge.
 *
 * From `lg` it is an open list for a side column; below `lg` it folds into a `<details>` whose
 * summary names the guide on screen, with 44 px rows. Both are plain markup, so it works on a
 * server-rendered page with no JavaScript. It is not sticky: the caller places it.
 *
 * @param props The groups and options, see {@link DocsNavProps}.
 */
export function DocsNav(
  { groups, current, labels, class: className }: DocsNavProps,
): JSX.Element | null {
  const words = useLabels("DocsNav", DOCS_NAV_LABELS, labels, { summary: ["title"] })
  if (groups.length === 0) return null
  const currentTitle = groups.flatMap((group) => group.items)
    .find((item) => item.href === current)?.title
  const list = (
    <div class="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.title} class="flex flex-col gap-2">
          <p class="text-xs font-semibold tracking-wide text-muted uppercase">{group.title}</p>
          <ul class="flex flex-col">
            {group.items.map((item) => {
              const active = item.href === current
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    class={cn(
                      LINK,
                      active
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted hover:border-strong hover:text-foreground",
                    )}
                  >
                    {item.title}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
  return (
    <nav aria-label={words.label} class={className} data-e2e="docs-nav">
      <details class="rounded-card border border-subtle bg-surface lg:hidden">
        <summary class="flex min-h-11 cursor-pointer items-center px-4 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
          {currentTitle === undefined ? words.summaryNone : words.summary(currentTitle)}
        </summary>
        <div class="px-4 pb-4">{list}</div>
      </details>
      <div class="hidden lg:block">{list}</div>
    </nav>
  )
}
