import { cn } from "@spy4x/preact-cn"
import { IconChevronDown } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"

/** One question of a {@link FaqList}. */
export interface FaqItem {
  /** The question, shown in the summary as a heading. */
  question: string
  /** The answer, shown below the question once it is open. */
  answer: ComponentChildren
  /** The `<details>` element's `id`, so a link to `#id` scrolls to the question and highlights it. */
  id?: string
}

/** Props of {@link FaqList}. */
export interface FaqListProps {
  /** The questions, in order. */
  items: readonly FaqItem[]
  /** Level of each question's heading, `<h2>` to `<h4>`. Defaults to `3`; it is the page's outline, not a size. */
  headingLevel?: 2 | 3 | 4
  /**
   * Set as `name` on every `<details>`, so opening one closes the others in a browser that supports
   * exclusive groups. Left out, each question opens on its own.
   */
  name?: string
  class?: string
}

/** One question and answer of a schema.org `FAQPage`, as plain text. */
export interface FaqJsonLdItem {
  question: string
  /** The answer as plain text: search engines read no markup here. */
  answerText: string
}

/** A schema.org `Question` with its accepted answer. */
export interface FaqQuestionJsonLd {
  "@type": "Question"
  name: string
  acceptedAnswer: { "@type": "Answer"; text: string }
}

/** A schema.org `FAQPage` node, without `@context`, ready for `SEOHead`'s `jsonLd` graph. */
export interface FaqPageJsonLd {
  "@type": "FAQPage"
  mainEntity: FaqQuestionJsonLd[]
}

const item = "group/faq scroll-mt-16 target:bg-selected-soft"

const summary =
  "flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-foreground " +
  "[&::-webkit-details-marker]:hidden focus-visible:outline-hidden focus-visible:ring-2 " +
  "focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

const chevron =
  "size-5 text-muted motion-safe:transition-transform motion-safe:duration-200 group-open/faq:rotate-180"

/**
 * Questions and answers as native `<details>` disclosures: they open and close with no
 * JavaScript, so the list works on a server-rendered page with scripts off.
 *
 * Each question is a heading inside its `<summary>`, so it is in the page's outline. The browser's
 * marker is hidden and a chevron, hidden from assistive tech, turns when the question is open. A
 * question whose `id` is the URL's fragment is highlighted (`:target`).
 *
 * @param props The questions and options, see {@link FaqListProps}.
 * @returns The list of disclosures.
 */
export function FaqList(
  { items, headingLevel = 3, name, class: className }: FaqListProps,
): JSX.Element {
  const Heading = `h${headingLevel}` as "h3"
  return (
    <div class={cn("divide-y divide-subtle border-y border-subtle", className)}>
      {items.map((entry) => (
        <details
          key={entry.id ?? entry.question}
          id={entry.id}
          class={item}
          {...(name ? { name } : {})}
        >
          <summary class={summary}>
            <Heading class="text-base font-medium">{entry.question}</Heading>
            <IconChevronDown class={chevron} />
          </summary>
          <div class="pb-4 text-sm text-muted">{entry.answer}</div>
        </details>
      ))}
    </div>
  )
}

/**
 * The schema.org `FAQPage` node for a list of questions, for `SEOHead`'s `jsonLd`.
 *
 * It carries no `@context`: `SEOHead` wraps every entity in one `@graph` that sets it.
 *
 * @param items Each question with its answer as plain text.
 * @returns The `FAQPage` node.
 */
export function faqPageJsonLd(items: readonly FaqJsonLdItem[]): FaqPageJsonLd {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answerText }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answerText },
    })),
  }
}
