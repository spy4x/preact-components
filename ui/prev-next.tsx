import { cn } from "@spy4x/preact-cn"
import { IconArrowLeft, IconArrowRight } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/** One neighbour of a {@link PrevNext}. */
export interface PrevNextLink {
  /** The neighbour's address. */
  href: string
  /** Its title, the card's main line. */
  title: string
}

/** The words a {@link PrevNext} shows. */
export interface PrevNextLabels {
  /** The navigation's accessible name. Default: `"Previous and next"`. */
  label: string
  /** The line above the previous title. Default: `"Previous"`. */
  previous: string
  /** The line above the next title. Default: `"Next"`. */
  next: string
}

/** The English words {@link PrevNext} shows when the caller passes none. */
export const PREV_NEXT_LABELS: PrevNextLabels = {
  label: "Previous and next",
  previous: "Previous",
  next: "Next",
}

/** Props of {@link PrevNext}. */
export interface PrevNextProps {
  /** The page before this one. Left out, its card is not drawn. */
  previous?: PrevNextLink
  /** The page after this one. Left out, its card is not drawn. */
  next?: PrevNextLink
  /** The words shown; see {@link PREV_NEXT_LABELS}. */
  labels?: Partial<PrevNextLabels>
  /** Utilities on the `<nav>`. */
  class?: string
}

const CARD =
  "flex flex-col gap-1 rounded-card border border-subtle bg-surface p-4 hover:border-strong " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/**
 * Two cards at the end of a guide: the previous one and the next one, each a whole-card link
 * with a muted "Previous" or "Next" over the title. Stacked on a phone, side by side from `sm`,
 * the next card always on the end side. Arrows turn with the reading direction.
 *
 * Plain links, so it works on a server-rendered page with no JavaScript. With neither neighbour
 * it renders nothing.
 *
 * @param props The neighbours and options, see {@link PrevNextProps}.
 */
export function PrevNext(
  { previous, next, labels, class: className }: PrevNextProps,
): JSX.Element | null {
  const words = useLabels("PrevNext", PREV_NEXT_LABELS, labels)
  if (!previous && !next) return null
  return (
    <nav
      aria-label={words.label}
      class={cn("grid gap-4 sm:grid-cols-2", className)}
      data-e2e="prev-next"
    >
      {previous && (
        <a href={previous.href} rel="prev" class={CARD}>
          <span class="flex items-center gap-1 text-sm text-muted">
            <IconArrowLeft class="size-4 rtl:-scale-x-100" />
            {words.previous}
          </span>
          <span class="font-medium text-balance text-foreground">{previous.title}</span>
        </a>
      )}
      {next && (
        <a href={next.href} rel="next" class={cn(CARD, "items-end text-end sm:col-start-2")}>
          <span class="flex items-center gap-1 text-sm text-muted">
            {words.next}
            <IconArrowRight class="size-4 rtl:-scale-x-100" />
          </span>
          <span class="font-medium text-balance text-foreground">{next.title}</span>
        </a>
      )}
    </nav>
  )
}
