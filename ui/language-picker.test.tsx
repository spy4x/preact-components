import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import type { VNode } from "preact"
import en from "./i18n/en.ts"
import de from "./i18n/de.ts"
import { I18nContext } from "./i18n.tsx"
import { LanguageButton, languageName, LanguagePicker } from "./language-picker.tsx"

const LANGUAGES = ["en", "de", "es", "pt-BR", "ru", "ar"]

/** Each radio row's opening tag, in order. */
function rows(html: string): string[] {
  return html.match(/<button[^>]*role="radio"[^>]*>/g) ?? []
}

/** The `disabled` attribute, not the `disabled:` variant in a class. */
const DISABLED = /\sdisabled[\s>=]/

/** Each link's opening tag, in order. */
function links(html: string): string[] {
  return html.match(/<a [^>]*>/g) ?? []
}

function inGerman(node: VNode): string {
  const german = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })
  return render(<I18nContext.Provider value={german}>{node}</I18nContext.Provider>)
}

describe("languageName", () => {
  it("names a language in itself, its first letter capitalised", () => {
    expect(languageName("ru")).toBe("Русский")
    expect(languageName("es")).toBe("Español")
    expect(languageName("pt-BR")).toBe("Português (Brasil)")
    expect(languageName("ar")).toBe("العربية")
  })

  it("returns a tag Intl cannot read unchanged", () => {
    expect(languageName("not a tag")).toBe("not a tag")
  })
})

describe("LanguagePicker links mode", () => {
  const html = render(
    <LanguagePicker mode="links" languages={LANGUAGES} current="de" href={(tag) => `/${tag}/`} />,
  )

  it("renders a link per language with href, hreflang, lang and dir, and no button", () => {
    const tags = links(html)
    expect(tags.length).toBe(6)
    expect(tags[3]).toContain(`href="/pt-BR/"`)
    expect(tags[3]).toContain(`hreflang="pt-BR"`)
    expect(tags[3]).toMatch(/\slang="pt-BR"/)
    expect(tags[5]).toContain(`dir="rtl"`)
    expect(html).not.toContain("<button")
    expect(html).toMatch(/^<nav aria-label="Language"/)
  })

  it("marks only the current language with aria-current page", () => {
    const current = links(html).filter((tag) => tag.includes(`aria-current="page"`))
    expect(current).toEqual([links(html)[1]])
    expect(html).toContain(">Deutsch<svg")
  })

  it("refuses links mode without href", () => {
    expect(() => render(<LanguagePicker mode="links" languages={LANGUAGES} current="en" />))
      .toThrow(`"links" mode needs href`)
  })
})

describe("LanguagePicker list mode", () => {
  it("is a radio group with one tab stop, on the checked row", () => {
    const html = render(<LanguagePicker languages={LANGUAGES} current="ru" onSelect={() => {}} />)
    expect(html).toContain(`role="radiogroup" aria-label="Language"`)
    const radios = rows(html)
    expect(radios.length).toBe(6)
    expect(radios.map((row) => row.includes(`aria-checked="true"`))).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ])
    expect(radios.map((row) => row.includes(`tabindex="0"`))).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ])
  })

  it("starts with the Automatic row, checked when current is null, naming the device language in itself", () => {
    const html = render(
      <LanguagePicker languages={LANGUAGES} current={null} automatic="de" onSelect={() => {}} />,
    )
    const radios = rows(html)
    expect(radios.length).toBe(7)
    expect(radios[0]).toContain(`aria-checked="true"`)
    expect(radios[0]).toContain(`data-value="automatic"`)
    expect(html).toContain(
      `Automatic: same as this device — <span lang="de" dir="ltr" class="notranslate">Deutsch</span>`,
    )
  })

  it("moves the check and a spinner to the pending row", () => {
    const html = render(
      <LanguagePicker languages={LANGUAGES} current="en" pending="ar" onSelect={() => {}} />,
    )
    const radios = rows(html)
    expect(radios[0]).toContain(`aria-checked="false"`)
    expect(radios[5]).toContain(`aria-checked="true"`)
    expect(radios[5]).toContain(`aria-busy="true"`)
    expect(html).toContain(`aria-live="polite" class="sr-only">Loading العربية…</p>`)
  })

  it("disables an unavailable language with the offline note, never the current one", () => {
    const html = render(
      <LanguagePicker
        languages={LANGUAGES}
        current="de"
        unavailable={["de", "ru"]}
        onSelect={() => {}}
      />,
    )
    const radios = rows(html)
    expect(radios[1]).not.toMatch(DISABLED)
    expect(radios[4]).toMatch(DISABLED)
    expect(html.match(/Needs a connection/g)?.length).toBe(1)
  })

  it("names a failed language in an alert that describes the group", () => {
    const html = render(
      <LanguagePicker languages={LANGUAGES} current="en" failed="ru" onSelect={() => {}} />,
    )
    const described = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(described).toBeDefined()
    expect(html).toContain(
      `<p id="${described}" role="alert" class="text-sm text-danger">Could not load Русский. Check your connection and try again.</p>`,
    )
  })

  it("draws rows at least 44 px tall that wrap instead of cutting the name", () => {
    const html = render(<LanguagePicker languages={LANGUAGES} current="en" onSelect={() => {}} />)
    for (const row of rows(html)) {
      expect(row).toContain("min-h-11")
      expect(row).not.toMatch(/truncate|whitespace-nowrap/)
    }
  })

  it("speaks the translator's language, and keeps each language's own name", () => {
    const html = inGerman(
      <LanguagePicker
        languages={LANGUAGES}
        current="en"
        automatic="en"
        unavailable={["es"]}
        onSelect={() => {}}
      />,
    )
    expect(html).toContain(`aria-label="Sprache"`)
    expect(html).toContain(`Automatisch: wie auf diesem Gerät — <span lang="en"`)
    expect(html).toContain("Nur mit Verbindung")
    expect(html).toContain(`<span lang="es" dir="ltr" class="notranslate">Español</span>`)
  })

  it("keeps page translators off every language name, in the list and the links", () => {
    const list = render(<LanguagePicker languages={LANGUAGES} current="en" onSelect={() => {}} />)
    expect(list.match(/<span lang="[^"]+" dir="[a-z]+" class="notranslate">/g)?.length).toBe(6)
    const html = render(
      <LanguagePicker mode="links" languages={LANGUAGES} current="en" href={(tag) => `/${tag}/`} />,
    )
    for (const tag of links(html)) expect(tag).toMatch(/class="notranslate /)
  })
})

describe("LanguageButton", () => {
  /** The button's own markup: the closed dialog after it is left out. */
  const button = (html: string) => html.slice(0, html.indexOf("</button>") + 9)

  it("shows a globe and the language in use, named in itself with lang, dir and notranslate", () => {
    const html = button(render(<LanguageButton languages={LANGUAGES} current="ar" />))
    expect(html).toMatch(/^<button [^>]*aria-haspopup="dialog"[^>]*data-e2e="language-button"/)
    expect(html).toContain(`<svg`)
    expect(html).toContain(
      `<span class="sr-only">Language</span> <span lang="ar" dir="rtl" class="notranslate">العربية</span>`,
    )
  })

  it("is a 44 px touch target on a phone, 36 px with a pointer", () => {
    const html = button(render(<LanguageButton languages={LANGUAGES} current="en" />))
    expect(html).toMatch(/^<button [^>]*class="[^"]*\bmin-h-11 sm:min-h-9\b/)
  })

  it("shows the device's language while current follows it", () => {
    const html = button(
      render(<LanguageButton languages={LANGUAGES} current={null} automatic="ru" />),
    )
    expect(html).toContain(`<span lang="ru" dir="ltr" class="notranslate">Русский</span>`)
  })

  it("shows the dialog's title, visibly, when no language is known", () => {
    const html = button(render(<LanguageButton languages={LANGUAGES} current={null} />))
    expect(html).not.toContain("sr-only")
    expect(html).toMatch(/<\/svg>Language<\/button>$/)
  })

  it("reads the dialog's title from the catalog, and takes the caller's over it", () => {
    expect(button(inGerman(<LanguageButton languages={LANGUAGES} current="en" />))).toContain(
      `<span class="sr-only">Sprache</span>`,
    )
    const html = render(
      <LanguageButton languages={LANGUAGES} current="en" labels={{ title: "Interface" }} />,
    )
    expect(button(html)).toContain(`<span class="sr-only">Interface</span>`)
  })

  it("renders no dialog until opened, and takes buttonDataE2E on the button", () => {
    const html = render(
      <LanguageButton languages={LANGUAGES} current="en" buttonDataE2E="public-language" />,
    )
    expect(button(html)).toContain(`data-e2e="public-language"`)
    expect(html).toBe(button(html))
  })
})
