import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { ComponentChild } from "preact"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import en from "./i18n/en.ts"
import de from "./i18n/de.ts"
import { ENGLISH, I18nContext, labelsFrom, Rich, translate, useLabels, useT } from "./i18n.tsx"
import { Pagination } from "./pagination.tsx"

const FULL_ENGLISH = createTranslator({ language: "en", catalogs: [{ source: en }] })
const GERMAN = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })

/** A translator for an app that left the library's catalog out of `catalogs`. */
const APP_ONLY = createTranslator({
  language: "de",
  catalogs: [{ source: { "notes.empty": "No notes" }, translation: { "notes.empty": "Keine" } }],
})

const DEFAULTS = {
  previousLabel: "Previous",
  nextLabel: "Next",
  pageLabel: (page: number) => `Page ${page}`,
}

function inLanguage(translator: typeof GERMAN, node: ComponentChild): string {
  return render(<I18nContext.Provider value={translator}>{node}</I18nContext.Provider>)
}

describe("labelsFrom", () => {
  it("takes each word from the catalog key <name>.<field>", () => {
    const words = labelsFrom(GERMAN, "Pagination", DEFAULTS, undefined, { pageLabel: ["page"] })
    expect(words.previousLabel).toBe(de["Pagination.previousLabel"])
    expect(words.pageLabel(3)).toBe(GERMAN.t("Pagination.pageLabel", { page: 3 }))
    expect(words.pageLabel(3)).not.toBe("Page 3")
  })

  it("lets the caller's word win over the catalog, and skips one set to undefined", () => {
    const words = labelsFrom(GERMAN, "Pagination", DEFAULTS, {
      previousLabel: "Zurück!",
      nextLabel: undefined,
    })
    expect(words.previousLabel).toBe("Zurück!")
    expect(words.nextLabel).toBe(de["Pagination.nextLabel"])
  })

  it("keeps the English default for a key the translator does not know", () => {
    const words = labelsFrom(APP_ONLY, "Pagination", DEFAULTS, undefined, { pageLabel: ["page"] })
    expect(words.previousLabel).toBe("Previous")
    expect(words.pageLabel(2)).toBe("Page 2")
  })

  it('passes one argument on as the message\'s values with params "values"', () => {
    const words = labelsFrom(
      FULL_ENGLISH,
      "SortableList",
      { moved: (_at: { item: string; position: number; total: number }) => "" },
      undefined,
      { moved: "values" },
    )
    expect(words.moved({ item: "Milk", position: 2, total: 5 })).toBe(
      "Moved Milk to position 2 of 5.",
    )
  })

  it("leaves a function without params at its default", () => {
    const shout = (text: string) => text.toUpperCase()
    expect(labelsFrom(GERMAN, "Pagination", { pageLabel: shout }).pageLabel).toBe(shout)
  })
})

describe("translate", () => {
  it("falls back to the component's English when the translator lacks the key", () => {
    expect(translate(APP_ONLY, "DataTable.empty", "No rows")).toBe("No rows")
    expect(translate(ENGLISH, "DataTable.empty", "No rows")).toBe("No rows")
    expect(translate(GERMAN, "DataTable.empty", "No rows")).toBe(de["DataTable.empty"])
  })
})

describe("I18nContext", () => {
  it("is English without a provider", () => {
    function Probe() {
      return <p>{translate(useT(), "DataTable.empty", "No rows")}</p>
    }
    expect(render(<Probe />)).toBe("<p>No rows</p>")
    expect(inLanguage(GERMAN, <Probe />)).toBe(`<p>${de["DataTable.empty"]}</p>`)
  })

  it("is English when a component is called as a plain function, outside a render", () => {
    expect(useT()).toBe(ENGLISH)
  })

  it("changes a component's words through the provider alone", () => {
    const english = render(<Pagination page={1} pageCount={3} onChange={() => {}} />)
    const german = inLanguage(GERMAN, <Pagination page={1} pageCount={3} onChange={() => {}} />)
    expect(english).toContain(">Previous<")
    expect(german).toContain(`>${de["Pagination.previousLabel"]}<`)
    expect(german).not.toContain("Previous")
  })

  it("lets useLabels read the nearest provider", () => {
    function Probe() {
      return <p>{useLabels("Pagination", DEFAULTS).nextLabel}</p>
    }
    expect(inLanguage(GERMAN, <Probe />)).toBe(`<p>${de["Pagination.nextLabel"]}</p>`)
  })
})

describe("Rich", () => {
  const terms = createTranslator({
    language: "en",
    catalogs: [{ source: { "signup.terms": "I agree to the <terms>Terms</terms>, {name}." } }],
  })

  it("renders a tag through its renderer and the rest as text", () => {
    const html = render(
      <Rich
        parts={terms.parts("signup.terms", { name: "Ada" })}
        tags={{ terms: (text) => <a href="/terms">{text}</a> }}
      />,
    )
    expect(html).toBe(`I agree to the <a href="/terms">Terms</a>, Ada.`)
  })

  it("shows a tag with no renderer as its plain text", () => {
    expect(render(<Rich parts={terms.parts("signup.terms", { name: "Ada" })} />)).toBe(
      "I agree to the Terms, Ada.",
    )
  })

  it("never turns a message or a value into markup or a link", () => {
    const html = render(
      <Rich
        parts={[
          `<img src=x onerror=alert(1)>`,
          { tag: "terms", text: `<a href="javascript:alert(1)">x</a>` },
          { tag: "constructor", text: "proto" },
        ]}
        tags={{ terms: (text) => <a href="/terms">{text}</a> }}
      />,
    )
    expect(html).not.toContain("<img")
    expect(html).not.toContain(`href="javascript`)
    expect(html).toContain("&lt;img src=x onerror=alert(1)>")
    expect(html).toContain(
      `<a href="/terms">&lt;a href=&quot;javascript:alert(1)&quot;>x&lt;/a></a>`,
    )
    expect(html).toContain("proto")
  })
})
