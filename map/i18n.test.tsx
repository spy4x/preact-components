import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { I18nContext } from "@spy4x/preact-ui/i18n"
import mapDe from "./i18n/de.ts"
import mapEn from "./i18n/en.ts"
import { Map } from "./map.tsx"

const map = () => (
  <Map
    center={{ lat: 0, lng: 0 }}
    zoom={3}
    markers={[{ id: "1", label: "Depot", lat: 0, lng: 0 }]}
    onMarkerClick={() => {}}
    tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
    attribution="© Example"
  />
)

describe("the map under a translator", () => {
  it("names the map, its list and a marker's status in the translator's language", () => {
    const german = createTranslator({
      language: "de",
      catalogs: [{ source: mapEn, translation: mapDe }],
    })
    const html = render(<I18nContext.Provider value={german}>{map()}</I18nContext.Provider>)
    expect(html).toContain(`aria-label="Karte"`)
    expect(html).toContain(">Orte<")
    expect(html).toContain("Status unbekannt")
  })

  it("renders the same English with the English catalog as without a provider", () => {
    const english = createTranslator({ language: "en", catalogs: [{ source: mapEn }] })
    expect(render(<I18nContext.Provider value={english}>{map()}</I18nContext.Provider>))
      .toBe(render(map()))
  })
})
