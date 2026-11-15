import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { CATEGORY_ICONS } from "@spy4x/preact-icons/registry"
import { render } from "preact-render-to-string"
import en from "./i18n/en.ts"
import ru from "./i18n/ru.ts"
import { I18nContext } from "./i18n.tsx"
import { IconPicker } from "./icon-picker.tsx"

/** Each radio's opening tag, in the order of the tiles. */
function radios(html: string): string[] {
  return html.match(/<input[^>]*type="radio"[^>]*>/g) ?? []
}

/** The visually hidden names of the tiles, in order. */
function tileNames(html: string): string[] {
  return [...html.matchAll(/<span class="sr-only">([^<]*)<\/span>/g)].map((match) => match[1])
}

const noop = () => {}
const russian = createTranslator({ language: "ru", catalogs: [{ source: en, translation: ru }] })

describe("IconPicker", () => {
  it("draws a radio per category icon, sharing the name, and checks the chosen one", () => {
    const html = render(<IconPicker value="car" onChange={noop} name="icon" />)

    const inputs = radios(html)
    expect(inputs.map((input) => input.match(/value="([^"]+)"/)?.[1])).toEqual([...CATEGORY_ICONS])
    for (const input of inputs) expect(input).toContain(`name="icon"`)
    const checked = inputs.filter((input) => / checked(\s|\/|>)/.test(input))
    expect(checked).toHaveLength(1)
    expect(checked[0]).toContain(`value="car"`)
  })

  it("follows the legend with the chosen icon's name, hidden from the accessible name", () => {
    const html = render(<IconPicker value="car" onChange={noop} />)

    expect(html).toMatch(
      /<legend class="pc-label mb-2">Icon<span class="ms-1 font-normal text-muted" aria-hidden="true">· Car<\/span><\/legend>/,
    )
    expect(render(<IconPicker value={null} onChange={noop} />)).toContain(
      `<legend class="pc-label mb-2">Icon</legend>`,
    )
  })

  it("puts a No icon tile first with allowNone, checked when the value is null", () => {
    const html = render(<IconPicker value={null} onChange={noop} allowNone />)

    const inputs = radios(html)
    expect(inputs).toHaveLength(CATEGORY_ICONS.length + 1)
    expect(inputs[0]).toMatch(/ checked(\s|\/|>)/)
    expect(tileNames(html)[0]).toBe("No icon")
  })

  it("names every tile, the legend and the search box in the reader's language", () => {
    const html = render(
      <I18nContext.Provider value={russian}>
        <IconPicker value="car" onChange={noop} />
      </I18nContext.Provider>,
    )

    const names = tileNames(html)
    expect(names[CATEGORY_ICONS.indexOf("car")]).toBe("Машина")
    expect(names[CATEGORY_ICONS.indexOf("house")]).toBe("Дом")
    expect(html).toContain(`>Значок<span`)
    expect(html).toContain(`>· Машина</span>`)
    expect(html).toContain(`aria-label="Найти значок"`)
  })

  it("keeps the live region empty until the search is used", () => {
    const html = render(<IconPicker value={null} onChange={noop} />)

    expect(html).toContain(`role="status" aria-live="polite" aria-atomic="true"></p>`)
  })
})
