import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"

/** Props of {@link TldrBox}. */
export interface TldrBoxProps {
  /** The key points, one sentence each, in order. An empty list renders nothing. */
  items: readonly ComponentChildren[]
  /** The box's heading. Defaults to `"In short"`. */
  title?: ComponentChildren
  /** Level of the heading, `<h2>` to `<h4>`. Defaults to `2`; it is the page's outline, not a size. */
  headingLevel?: 2 | 3 | 4
  /** The heading's `id`, which names the section. Generated when left out. */
  id?: string
  /** Utilities on the box. */
  class?: string
}

/**
 * The few points a reader takes away from an article, before its body: a hairline box with a
 * heading ("In short") and a bulleted list. A named `<section>`, so it is a landmark a screen
 * reader can jump to, and plain markup, so it shows on a server-rendered page with no JavaScript.
 *
 * @param props The points and options, see {@link TldrBoxProps}.
 */
export function TldrBox(
  { items, title = "In short", headingLevel = 2, id, class: className }: TldrBoxProps,
): JSX.Element | null {
  const generated = useId()
  if (items.length === 0) return null
  const headingId = id ?? `tldr-${generated}`
  const Heading = `h${headingLevel}` as const
  return (
    <section
      aria-labelledby={headingId}
      class={join("rounded-primary border border-subtle px-4 py-4 sm:px-6", className)}
      data-e2e="tldr-box"
    >
      <Heading id={headingId} class="text-base font-semibold text-foreground">{title}</Heading>
      <ul class="mt-2 list-disc pl-6 text-base leading-7 text-foreground marker:text-muted">
        {items.map((item, index) => (
          <li key={index} class={index > 0 ? "mt-1" : undefined}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
