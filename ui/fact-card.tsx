import type { ComponentChildren, JSX } from "preact"
import { Card, CardBody, CardHeader } from "./card.tsx"

/** One row of a {@link FactCard}. */
export interface Fact {
  /** The `<dt>` text. */
  key: string
  /** The `<dd>` content — text or markup, e.g. a {@link StatusMark}. */
  value: ComponentChildren
}

export interface FactCardProps {
  /** Card heading. Omitted, the header is left out entirely. */
  title?: string
  /** Right-aligned header slot, e.g. a link or a button. Ignored when `title` is omitted. */
  action?: ComponentChildren
  facts: Fact[]
  class?: string
}

/**
 * A card of short key/value facts, rendered as a real `<dl>` — composes {@link Card}, {@link
 * CardHeader} and {@link CardBody} rather than adding a fourth card primitive (#257).
 */
export function FactCard({ title, action, facts, class: className }: FactCardProps): JSX.Element {
  return (
    <Card class={className}>
      {title && <CardHeader title={title} action={action} />}
      <CardBody>
        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key}>
              <dt class="kpi-label">{fact.key}</dt>
              <dd class="text-sm">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}
