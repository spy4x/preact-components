import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import type { ComponentChildren } from "preact"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { I18nContext } from "@spy4x/preact-ui/i18n"
import { Bars } from "./bars.tsx"
import { changeText } from "./change.ts"
import { DonutChart } from "./donut-chart.tsx"
import chartsDe from "./i18n/de.ts"
import chartsEn from "./i18n/en.ts"
import { LineChart } from "./line-chart.tsx"

const GERMAN = createTranslator({
  language: "de",
  catalogs: [{ source: chartsEn, translation: chartsDe }],
})

function inGerman(children: ComponentChildren): string {
  return render(<I18nContext.Provider value={GERMAN}>{children}</I18nContext.Provider>)
}

const emptyBars = () => <Bars data={[]} />
const oneSlice = () => <DonutChart data={[{ label: "A", value: 1 }]} />
const loadingLine = () => (
  <LineChart
    series={[{ name: "Runs", points: [{ x: "Jan", y: 1 }, { x: "Feb", y: 2 }] }]}
    isLoading
  />
)

describe("the charts under a translator", () => {
  it("render the same English with the English catalog as without a provider", () => {
    const english = createTranslator({ language: "en", catalogs: [{ source: chartsEn }] })
    for (const fixture of [emptyBars, oneSlice, loadingLine]) {
      expect(render(<I18nContext.Provider value={english}>{fixture()}</I18nContext.Provider>))
        .toBe(render(fixture()))
    }
  })

  it("word the empty state, the chart's name by count and the loading line", () => {
    expect(inGerman(emptyBars())).toContain(">Keine Daten<")
    expect(inGerman(oneSlice())).toContain(`aria-label="Ringdiagramm mit 1 Segment"`)
    const line = inGerman(loadingLine())
    expect(line).toContain("Liniendiagramm mit 1 Datenreihe")
    expect(line).toContain("Wird geladen …")
    expect(line).toContain(">Punkt<")
  })

  it("word a change in the translator's language, and in English without one", () => {
    expect(changeText({ current: 5, previous: 5 }, "gestern", "de-DE", GERMAN))
      .toBe("Unverändert gegenüber gestern")
    expect(changeText({ current: 1500, previous: 0 }, "Vormonat", "de-DE", GERMAN))
      .toBe("+1.500 gegenüber Vormonat")
    expect(changeText({ current: 5, previous: 5 }, "yesterday")).toBe("No change vs yesterday")
  })
})
