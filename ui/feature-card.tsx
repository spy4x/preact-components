import { cn } from "@spy4x/preact-cn"
import { IconArrowRight, type IconProps } from "@spy4x/preact-icons"
import type { ComponentChildren, ComponentType, JSX } from "preact"
import { Card } from "./card.tsx"

/** Props of {@link FeatureCard}. */
export interface FeatureCardProps {
  /** The heading's id. The card is labelled by it, and its link is described by it. */
  id: string
  /** The feature's name, the card's heading. */
  title: string
  /** One or two sentences on the feature, under the heading. */
  children: ComponentChildren
  /** A glyph in an accent tile above the heading, any icon of `@spy4x/preact-icons`. */
  Icon?: ComponentType<IconProps>
  /** Where the card's link goes, such as `/features#sign-in`. Left out, the card has no link. */
  href?: string
  /**
   * The link's text. The heading describes it, so a screen reader hears which feature it is for.
   */
  linkLabel?: string
  /** A picture under the text, such as a screenshot, drawn to the card's edges. */
  media?: ComponentChildren
  /** Spans two columns of the caller's grid from `lg`, for a card that carries a picture. */
  wide?: boolean
  /** The heading's level, to fit the page's outline. */
  headingLevel?: 2 | 3
  /** Utilities merged over the card's own. */
  class?: string
}

/**
 * One feature of a product on its public site: an optional icon, a heading, a line or two of text,
 * an optional link and an optional picture under them, on a library {@link Card}.
 *
 * Only the link is a link, so the text stays selectable. The link's text is generic ("Learn more")
 * and `aria-describedby` points it at the heading, so each card's link is told apart. The card
 * does not lift on hover, because only its link is clickable. The link sits at the bottom of the
 * card, so in a grid of cards of different heights, align the row's items to the start to keep it
 * near the text. It renders on the server and needs no JavaScript.
 *
 * @param props See {@link FeatureCardProps}.
 * @returns The card, an `article` labelled by its heading.
 */
export function FeatureCard(
  {
    id,
    title,
    children,
    Icon,
    href,
    linkLabel = "Learn more",
    media,
    wide = false,
    headingLevel = 3,
    class: className,
  }: FeatureCardProps,
): JSX.Element {
  const Heading = `h${headingLevel}` as "h3"
  return (
    <Card
      role="article"
      aria-labelledby={id}
      data-e2e="feature-card"
      class={cn(
        "flex flex-col overflow-hidden",
        wide && "lg:col-span-2",
        className,
      )}
    >
      <div class="flex flex-1 flex-col gap-4 p-6">
        {Icon && (
          <span
            class="flex size-10 items-center justify-center rounded-control bg-selected-soft text-primary"
            aria-hidden="true"
          >
            <Icon class="size-5" />
          </span>
        )}
        <Heading id={id} class="text-lg font-semibold text-balance text-foreground">
          {title}
        </Heading>
        <p class="text-muted text-pretty">{children}</p>
        {href && (
          <a
            href={href}
            aria-describedby={id}
            class="mt-auto inline-flex items-center gap-1 self-start text-sm font-medium text-foreground hover:underline"
          >
            {linkLabel} <IconArrowRight class="size-4" />
          </a>
        )}
      </div>
      {media && <div class="border-t border-subtle">{media}</div>}
    </Card>
  )
}
