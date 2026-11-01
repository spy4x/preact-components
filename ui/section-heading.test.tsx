import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import en from "./i18n/en.ts"
import ar from "./i18n/ar.ts"
import de from "./i18n/de.ts"
import es from "./i18n/es.ts"
import ptBR from "./i18n/pt-BR.ts"
import ru from "./i18n/ru.ts"
import { I18nContext } from "./i18n.tsx"
import { SectionHeading } from "./section-heading.tsx"

/** The class attribute of the anchor link in `html`. */
function anchorClasses(html: string): string[] {
  return /<a [^>]*class="([^"]*)"/.exec(html)?.[1].split(" ") ?? []
}

describe("SectionHeading", () => {
  it("draws the heading and, beside it and outside it, a link to its own id", () => {
    const html = render(<SectionHeading id="why">Why</SectionHeading>)
    expect(html).toMatch(
      /^<div class="group\/heading flex items-baseline gap-2"><h2 id="why" class="[^"]*">Why<\/h2><a href="#why" aria-label="Link to this section" class="[^"]*"><span aria-hidden="true">#<\/span><\/a><\/div>$/,
    )
  })

  it("links to the target id while the heading keeps its own id", () => {
    const html = render(
      <SectionHeading id="pricing-title" targetId="pricing">Pricing</SectionHeading>,
    )
    expect(html).toContain('<h2 id="pricing-title"')
    expect(html).toContain('<a href="#pricing"')
  })

  it("draws each heading level at Prose's size for that level", () => {
    const h2 = render(<SectionHeading id="a">A</SectionHeading>)
    const h3 = render(<SectionHeading id="b" headingLevel={3}>B</SectionHeading>)
    const h4 = render(<SectionHeading id="c" headingLevel={4}>C</SectionHeading>)
    expect(h2).toMatch(/<h2 id="a" class="[^"]*\btext-2xl\/8 tracking-tight\b/)
    expect(h3).toMatch(/<h3 id="b" class="[^"]*\btext-xl\/7\b[^"]*">B<\/h3>/)
    expect(h4).toMatch(/<h4 id="c" class="[^"]*\btext-base\/7\b[^"]*">C<\/h4>/)
  })

  it("merges the caller's class into the heading, a later utility winning", () => {
    const html = render(<SectionHeading id="a" class="text-lg text-accent">A</SectionHeading>)
    const heading = /<h2 id="a" class="([^"]*)"/.exec(html)?.[1].split(" ") ?? []
    expect(heading).toContain("text-lg")
    expect(heading).toContain("text-accent")
    expect(heading).not.toContain("text-2xl/8")
    expect(heading).not.toContain("text-foreground")
  })

  it("names the anchor in every language of the ui catalogs, and takes the caller's name", () => {
    const catalogs = { ar, de, es, "pt-BR": ptBR, ru }
    for (const [language, translation] of Object.entries(catalogs)) {
      const translator = createTranslator({ language, catalogs: [{ source: en, translation }] })
      const html = render(
        <I18nContext.Provider value={translator}>
          <SectionHeading id="a">A</SectionHeading>
        </I18nContext.Provider>,
      )
      expect(html).toContain(`aria-label="${translation["SectionHeading.anchor"]}"`)
      expect(translation["SectionHeading.anchor"]).not.toBe(en["SectionHeading.anchor"])
    }
    const named = render(
      <SectionHeading id="a" labels={{ anchor: "Copy the link" }}>A</SectionHeading>,
    )
    expect(named).toContain('aria-label="Copy the link"')
  })

  it("shows the anchor on hover and on focus only, and always where there is no hover", () => {
    const classes = anchorClasses(render(<SectionHeading id="a">A</SectionHeading>))
    expect(classes).toContain("opacity-0")
    expect(classes).toContain("group-hover/heading:opacity-100")
    expect(classes).toContain("focus-visible:opacity-100")
    expect(classes).toContain("focus-visible:ring-2")
    expect(classes).toContain("[@media(hover:none)]:opacity-100")
  })

  it("makes the anchor a 44 px touch target on a touch screen", () => {
    const classes = anchorClasses(render(<SectionHeading id="a">A</SectionHeading>))
    expect(classes).toContain("pointer-coarse:min-h-11")
    expect(classes).toContain("pointer-coarse:min-w-11")
  })
})
