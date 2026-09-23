import { cn } from "@preact-components/cn"
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
    | { title?: string; action?: ComponentChildren; children?: never; class?: string }
    | { children: ComponentChildren; title?: never; action?: never; class?: string }
  )

/**
 * Card surface.
 *
 * Emits the shipped `card` utility and nothing else, so it carries no opinion about padding,
 * colour or width beyond the preset. Header, body and footer are all optional children.
 */
export function Card({ children, class: className, ...rest }: CardProps): JSX.Element {
  return <div {...rest} class={cn("card", className)}>{children}</div>
}

/**
 * Card header: a title plus a right-aligned action, or raw children.
 *
 * `children` win over `title`/`action` whenever they are present, because a caller carrying its own
 * header markup is the more specific intent. Both modes lay out through the shipped `card-header`
 * utility, whose own `flex items-center justify-between` is what puts `action` on the right.
 */
export function CardHeader(
  { class: className, children, title, action, ...attrs }: CardHeaderProps,
): JSX.Element {
  if (children !== undefined && children !== null && children !== false) {
    return <div {...attrs} class={cn("card-header", className)}>{children}</div>
  }

  return (
    <div {...attrs} class={cn("card-header", className)}>
      <span class="text-lg font-semibold">{title}</span>
      {action && <div class="flex items-center gap-2">{action}</div>}
    </div>
  )
}

/** Card body: the content region of a {@link Card}. */
export function CardBody({ children, class: className, ...rest }: CardBodyProps): JSX.Element {
  return <div {...rest} class={cn("card-body", className)}>{children}</div>
}

/** Card footer: a divider-separated action row at the bottom of a {@link Card}. */
export function CardFooter(
  { children, class: className, ...rest }: CardFooterProps,
): JSX.Element {
  return <div {...rest} class={cn("card-footer", className)}>{children}</div>
}
