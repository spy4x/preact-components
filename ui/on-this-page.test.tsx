import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { render } from "preact-render-to-string"
import { I18nContext } from "./i18n.tsx"
import en from "./i18n/en.ts"
import ru from "./i18n/ru.ts"
import { OnThisPage } from "./on-this-page.tsx"

const LINKS = [
  { label: "What you get", href: "#what-you-get" },
  { label: "Limits", href: "#limits" },
]

describe("OnThisPage", () => {
  it("lists every section in order, both in the fold and in the open list, in a named landmark", () => {
    const html = render(<OnThisPage links={LINKS} />)
    expect(html).toMatch(/^<nav aria-label="On this page"/)
    expect(html.match(/<a href="#what-you-get"/g)?.length).toBe(2)
    expect(html.match(/<a href="#limits"/g)?.length).toBe(2)
    expect(html.indexOf("#what-you-get")).toBeLessThan(html.indexOf("#limits"))
    expect(html).toContain("<summary")
  })

  it("folds below 1024 px by default and below 1280 px when asked to open from xl", () => {
    const lg = render(<OnThisPage links={LINKS} />)
    expect(lg).toMatch(/<details class="[^"]*\blg:hidden\b/)
    expect(lg).toMatch(/<div class="hidden lg:sticky lg:top-24 lg:block">/)
    const xl = render(<OnThisPage links={LINKS} openFrom="xl" />)
    expect(xl).toMatch(/<details class="[^"]*\bxl:hidden\b/)
    expect(xl).toMatch(/<div class="hidden xl:sticky xl:top-24 xl:block">/)
    expect(xl).not.toContain("lg:")
  })

  it("passes a link's other attributes through to its anchor", () => {
    const html = render(
      <OnThisPage links={[{ label: "Limits", href: "#limits", "data-event": "toc" }]} />,
    )
    expect(html.match(/<a data-event="toc" href="#limits"/g)?.length).toBe(2)
  })

  it("names itself in the translator's language, or as the caller asks", () => {
    const russian = createTranslator({
      language: "ru",
      catalogs: [{ source: en, translation: ru }],
    })
    const html = render(
      <I18nContext.Provider value={russian}>
        <OnThisPage links={LINKS} />
      </I18nContext.Provider>,
    )
    expect(html).toContain('aria-label="На этой странице"')
    expect(render(<OnThisPage links={LINKS} label="Contents" />)).toContain(">Contents</summary>")
  })

  it("renders nothing for a page without sections", () => {
    expect(render(<OnThisPage links={[]} />)).toBe("")
  })
})
