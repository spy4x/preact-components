import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { render } from "preact-render-to-string"
import { Breadcrumbs } from "./breadcrumbs.tsx"
import { I18nContext } from "./i18n.tsx"
import en from "./i18n/en.ts"
import ru from "./i18n/ru.ts"

const TRAIL = [
  { label: "Seed", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Sign-in" },
]

describe("Breadcrumbs", () => {
  it("draws the trail in order as an ordered list in a landmark named Breadcrumb", () => {
    const html = render(<Breadcrumbs items={TRAIL} />)
    expect(html).toMatch(/^<nav aria-label="Breadcrumb"[^>]*><ol/)
    expect(html.match(/<li/g)?.length).toBe(3)
    expect(html.indexOf(">Seed<")).toBeLessThan(html.indexOf(">Features<"))
    expect(html.indexOf(">Features<")).toBeLessThan(html.indexOf(">Sign-in<"))
  })

  it("links every step that has an address and marks the last step without one as the current page", () => {
    const html = render(<Breadcrumbs items={TRAIL} />)
    expect(html).toMatch(/<a href="\/"[^>]*>Seed<\/a>/)
    expect(html).toMatch(/<a href="\/features"[^>]*>Features<\/a>/)
    expect(html).toMatch(/<span aria-current="page"[^>]*>Sign-in<\/span>/)
    expect(html.match(/aria-current/g)?.length).toBe(1)
  })

  it("puts one chevron hidden from screen readers between steps, none before the first", () => {
    const html = render(<Breadcrumbs items={TRAIL} />)
    expect(html.match(/<svg/g)?.length).toBe(2)
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)?.length).toBe(2)
    expect(html.indexOf("<svg")).toBeGreaterThan(html.indexOf(">Seed<"))
  })

  it("does not mark a step without an address as current when it is not the last", () => {
    const html = render(<Breadcrumbs items={[{ label: "Docs" }, { label: "Guide", href: "/g" }]} />)
    expect(html).not.toContain("aria-current")
  })

  it("names the landmark in the translator's language, or as the caller asks", () => {
    const russian = createTranslator({
      language: "ru",
      catalogs: [{ source: en, translation: ru }],
    })
    const html = render(
      <I18nContext.Provider value={russian}>
        <Breadcrumbs items={TRAIL} />
      </I18nContext.Provider>,
    )
    expect(html).toContain('aria-label="Навигационная цепочка"')
    expect(render(<Breadcrumbs items={TRAIL} label="Path" />)).toContain('aria-label="Path"')
  })

  it("renders nothing for an empty trail", () => {
    expect(render(<Breadcrumbs items={[]} />)).toBe("")
  })
})
