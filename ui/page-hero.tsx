import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useFormat } from "./format.tsx"

/** The person who wrote a page, named in {@link PageHero}'s meta line. */
export interface PageHeroAuthor {
  /** The name shown, such as "Anton Shubin". */
  name: string
  /** Where the name links, such as the author's about page. Without it the name is plain text. */
  href?: string
}

/** The words of {@link PageHero}'s meta line. */
export interface PageHeroLabels {
  /** Before the author's name. Default `"By"`. */
  by: string
  /** Before the date. Default `"Updated"`. */
  updated: string
}

/** The English words {@link PageHero} shows when the caller passes none. */
export const PAGE_HERO_LABELS: PageHeroLabels = { by: "By", updated: "Updated" }

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/** The author link: foreground text, underlined on hover, with the library's focus ring. */
const AUTHOR_LINK = "font-medium text-foreground underline-offset-4 hover:underline " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/** Whether `value` is `YYYY-MM-DD` and that day exists: `2026-02-30` and `2026-13-01` do not. */
function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY.test(value)) return false
  const day = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value)
}

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
  /** Who wrote the page, in the quiet meta line under the buttons. */
  author?: PageHeroAuthor
  /**
   * The calendar day the page last changed, `YYYY-MM-DD`, in the meta line under the buttons as a
   * `<time datetime>`. Shown in the reader's region format (`FormatContext`), counted in UTC so
   * the day never shifts with the server's or the reader's zone. Any other shape, or a day that
   * does not exist (`2026-02-30`), throws.
   */
  updated?: string
  /** The meta line's words; see {@link PAGE_HERO_LABELS}. */
  labels?: Partial<PageHeroLabels>
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
 * `author` and `updated` add one quiet line under the buttons (`text-sm`, muted), which wraps on a
 * phone: the byline and the "Updated" date a reader and a search engine look for on an article.
 *
 * The band is a `<div>`, not a `<header>`: a page that places it outside `<main>` would otherwise
 * gain a second banner landmark beside its site header.
 *
 * @param props See {@link PageHeroProps}.
 * @returns The band.
 */
export function PageHero(
  { eyebrow, title, lead, children, author, updated, labels, class: className }: PageHeroProps,
): JSX.Element {
  const format = useFormat()
  if (updated !== undefined && !isCalendarDay(updated)) {
    throw new Error(`PageHero: updated must be a calendar day, YYYY-MM-DD, got "${updated}"`)
  }
  const words = { ...PAGE_HERO_LABELS, ...labels }
  return (
    <div class={cn("border-b border-subtle", className)} data-e2e="page-hero">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {eyebrow && <p class="font-mono text-sm font-medium text-primary">{eyebrow}</p>}
        <h1 class="max-w-3xl text-3xl font-semibold tracking-tight text-balance text-foreground lg:text-5xl">
          {title}
        </h1>
        {lead && <p class="max-w-2xl text-lg text-muted text-pretty lg:text-xl">{lead}</p>}
        {children}
        {(author || updated) && (
          <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" data-e2e="page-hero-meta">
            {author && (
              <span>
                {words.by} {author.href
                  ? (
                    <a
                      class={AUTHOR_LINK}
                      href={author.href}
                    >
                      {author.name}
                    </a>
                  )
                  : <span class="font-medium text-foreground">{author.name}</span>}
              </span>
            )}
            {updated && (
              <span>
                {words.updated} <time dateTime={updated}>{format.utc().date(updated)}</time>
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
