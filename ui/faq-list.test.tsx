import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { FaqList, faqPageJsonLd } from "./faq-list.tsx"

const ITEMS = [
  { question: "Can I export my data?", answer: <p>Yes, as CSV.</p>, id: "export" },
  { question: "Is there a free plan?", answer: "Yes, for one person." },
] as const

describe("FaqList", () => {
  it("renders one details element per question, each with a summary holding an h3", () => {
    const html = render(<FaqList items={ITEMS} />)
    expect(html.match(/<details/g)?.length).toBe(2)
    expect(html).toMatch(
      /<summary[^>]*><h3[^>]*>Can I export my data\?<\/h3><svg[^>]*aria-hidden="true"/,
    )
    expect(html).toContain("<p>Yes, as CSV.</p>")
    expect(html).toContain("Yes, for one person.")
  })

  it("renders every question at the heading level it is given", () => {
    const html = render(<FaqList items={ITEMS} headingLevel={2} />)
    expect(html.match(/<h2 /g)?.length).toBe(2)
    expect(html).not.toContain("<h3")
  })

  it("puts an item's id on its details element and leaves it off the others", () => {
    const html = render(<FaqList items={ITEMS} />)
    expect(html).toMatch(/<details id="export"/)
    expect(html.match(/ id="/g)?.length).toBe(1)
  })

  it("sets the group name on every details element only when one is given", () => {
    expect(render(<FaqList items={ITEMS} name="faq" />).match(/<details[^>]* name="faq"/g)?.length)
      .toBe(2)
    expect(render(<FaqList items={ITEMS} />)).not.toContain(" name=")
  })

  it("hides the native marker and turns the chevron only under reduced-motion no-preference", () => {
    const html = render(<FaqList items={ITEMS} />)
    expect(html).toContain("[&amp;::-webkit-details-marker]:hidden")
    expect(html).toContain("list-none")
    expect(html).toContain("group-open/faq:rotate-180")
    expect(html).toContain("motion-safe:transition-transform")
    expect(html).not.toMatch(/(?<!motion-safe:)transition-transform/)
  })

  it("merges the caller's class into the wrapper", () => {
    const html = render(<FaqList items={ITEMS} class="max-w-2xl" />)
    expect(html).toMatch(/^<div class="[^"]*max-w-2xl"/)
  })
})

describe("faqPageJsonLd", () => {
  it("returns a FAQPage node with one Question and accepted Answer per item and no @context", () => {
    const node = faqPageJsonLd([
      { question: "Can I export my data?", answerText: "Yes, as CSV." },
      { question: "Is there a free plan?", answerText: "Yes, for one person." },
    ])
    expect(node).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I export my data?",
          acceptedAnswer: { "@type": "Answer", text: "Yes, as CSV." },
        },
        {
          "@type": "Question",
          name: "Is there a free plan?",
          acceptedAnswer: { "@type": "Answer", text: "Yes, for one person." },
        },
      ],
    })
    expect("@context" in node).toBe(false)
  })
})
