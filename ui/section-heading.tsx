import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/** The words {@link SectionHeading} shows. */
export interface SectionHeadingLabels {
  /** The name of the anchor link. Default: `"Link to this section"`. */
  anchor: string
}

/** The English words {@link SectionHeading} shows when the caller passes none. */
export const SECTION_HEADING_LABELS: SectionHeadingLabels = {
  anchor: "Link to this section",
}

/** Props of {@link SectionHeading}. */
export interface SectionHeadingProps {
  /** The heading's text. */
  children: ComponentChildren
  /** The heading's own `id`, such as `"pricing-title"` for a section's `aria-labelledby`. */
  id: string
  /**
   * The `id` the anchor links to, when not the heading's. Defaults to `id`. Give that element
   * `scroll-mt-16`, as the heading has, so a sticky header does not cover it once the link is
   * followed.
   */
  targetId?: string
  /** Level of the heading, `<h2>` to `<h4>`. Defaults to `2`; each level has `Prose`'s size. */
  headingLevel?: 2 | 3 | 4
  /** The words shown; see {@link SECTION_HEADING_LABELS}. */
  labels?: Partial<SectionHeadingLabels>
  /** Utilities on the heading, merged after the defaults; a later utility in the same group wins. */
  class?: string
}

/** The type of each level, as `Prose` sets its `h2` to `h4`. */
const SIZES = { 2: "text-2xl/8 tracking-tight", 3: "text-xl/7", 4: "text-base/7" } as const

const HEADING = "scroll-mt-16 font-semibold text-balance break-words hyphens-auto text-foreground"

const ANCHOR = "inline-flex items-center justify-center rounded-sm px-1 font-normal text-muted " +
  "opacity-0 group-hover/heading:opacity-100 focus-visible:opacity-100 " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-focus " +
  "[@media(hover:none)]:opacity-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11"

/**
 * A heading with a "Link to this section" link beside it, outside it so the heading's name stays
 * its text: the anchor `Prose`'s `anchors` draws, for a heading written as elements. The link is
 * shown on hover and on focus, always on a screen with no hover, and is a 44 px touch target on a
 * touch screen. Plain markup, so it works with no JavaScript.
 *
 * @param props The heading and options, see {@link SectionHeadingProps}.
 */
export function SectionHeading(
  { children, id, targetId = id, headingLevel = 2, labels, class: className }: SectionHeadingProps,
): JSX.Element {
  const words = useLabels("SectionHeading", SECTION_HEADING_LABELS, labels)
  const Heading = `h${headingLevel}` as "h2"
  return (
    <div class="group/heading flex items-baseline gap-2">
      <Heading id={id} class={cn(HEADING, SIZES[headingLevel], className)}>{children}</Heading>
      <a href={`#${targetId}`} aria-label={words.anchor} class={ANCHOR}>
        <span aria-hidden="true">#</span>
      </a>
    </div>
  )
}
