import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

/**
 * Attributes of a card div.
 *
 * `class` is dropped so each component re-declares it as a plain string rather than Preact's
 * `Signalish<string>`: this package never renders a signal in `class`. `title` is dropped on the
 * header, where it carries the heading text instead of the native tooltip.
 */
type CardDivAttributes = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">

export interface CardProps extends CardDivAttributes {
  /** Card contents: any of {@link CardHeader}, {@link CardBody}, {@link CardFooter}, or none. */
  children?: ComponentChildren
  /** Plain utilities. A later utility in the same group wins, so a caller overrides the surface. */
  class?: string
}

export interface CardBodyProps extends CardDivAttributes {
  children?: ComponentChildren
  class?: string
}

export interface CardFooterProps extends CardDivAttributes {
  /** Footer contents, normally a row of {@link Button}s. */
  children?: ComponentChildren
  class?: string
}

/**
 * Props of a {@link CardHeader}, in one of two mutually exclusive modes.
 *
 * `title`/`action` is the everyday case; raw `children` replace both. The modes are a union rather
 * than optional fields on one shape, so mixing them (`children` with `title`) is a type error
 * instead of markup that silently renders only one of the two.
 *
 * `title` is a string and `action` is a slot: a title that needs markup goes in `children`.
 */
export type CardHeaderProps =
  & CardDivAttributes
  & (
    | {
      title?: string
      action?: ComponentChildren
      /**
       * Draws `title` as an `<h2>`…`<h6>` of this level instead of a `<span>`, so the card has a
       * heading a screen reader can jump to. Pick the level that fits the page's outline; the range
       * is `KanbanBoard`'s. Size and weight stay the span's; the element also takes whatever the
       * preset's heading styles set on heading elements, such as a heading font.
       *
       * Omitted, `title` stays a `<span>`, as it was before this prop existed. Making the heading
       * the default would change the markup every existing caller renders, and a page whose own
       * CSS styles `h2`/`h3` would see its cards change, so it is opt-in within 1.x.
       */
      headingLevel?: 2 | 3 | 4 | 5 | 6
      children?: never
      class?: string
    }
    | {
      children: ComponentChildren
      title?: never
      action?: never
      headingLevel?: never
      class?: string
    }
  )

/**
 * Card surface.
 *
 * Emits the shipped `card` utility and nothing else, so it carries no opinion about padding,
 * colour or width beyond the preset. Header, body and footer are all optional children.
 */
export function Card({ children, class: className, ...rest }: CardProps): JSX.Element {
  return <div {...rest} class={cn("pc-card", className)}>{children}</div>
}

/**
 * Card header: a title plus a right-aligned action, or raw children.
 *
 * `children` win over `title`/`action` whenever they are present, because a caller carrying its own
 * header markup is the more specific intent. Both modes lay out through the shipped `card-header`
 * utility, whose own `flex items-center justify-between` is what puts `action` on the right.
 */
export function CardHeader(
  { class: className, children, title, action, headingLevel, ...attrs }: CardHeaderProps,
): JSX.Element {
  if (children !== undefined && children !== null && children !== false) {
    return <div {...attrs} class={cn("pc-card-header", className)}>{children}</div>
  }

  // A heading only when asked for: `headingLevel` is opt-in, so an existing caller's markup is
  // unchanged. Tailwind's preflight resets a heading's size and weight, so the classes below give
  // it the span's size and weight; anything the preset sets on heading elements applies on top.
  const Title = headingLevel === undefined ? "span" : `h${headingLevel}` as "h2"

  return (
    <div {...attrs} class={cn("pc-card-header", className)}>
      <Title class="text-lg font-semibold">{title}</Title>
      {action && <div class="flex items-center gap-2">{action}</div>}
    </div>
  )
}

/** Card body: the content region of a {@link Card}. */
export function CardBody({ children, class: className, ...rest }: CardBodyProps): JSX.Element {
  return <div {...rest} class={cn("pc-card-body", className)}>{children}</div>
}

/** Card footer: a divider-separated action row at the bottom of a {@link Card}. */
export function CardFooter(
  { children, class: className, ...rest }: CardFooterProps,
): JSX.Element {
  return <div {...rest} class={cn("pc-card-footer", className)}>{children}</div>
}
