import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import en from "./i18n/en.ts"
import de from "./i18n/de.ts"
import { I18nContext } from "./i18n.tsx"
import { UsageMeter, usageMeterLabels, usageReading } from "./usage-meter.tsx"

const euros = (amount: number) => `€${amount}`

function attribute(html: string, name: string): string | undefined {
  return html.match(new RegExp(`${name}="([^"]*)"`))?.[1]
}

describe("usageReading", () => {
  it("is under the limit below warnAt, with what is left", () => {
    expect(usageReading(212, 500)).toEqual({
      state: "under",
      percent: 42,
      left: 288,
      over: 0,
      fill: 42.4,
      tick: null,
    })
  })

  it("is close to the limit from warnAt up to one unit short of it", () => {
    expect(usageReading(400, 500).state).toBe("near")
    expect(usageReading(399, 500).state).toBe("under")
    expect(usageReading(499, 500).state).toBe("near")
    expect(usageReading(250, 500, 50).state).toBe("near")
  })

  it("rounds the percentage down, so one unit short never reads 100%", () => {
    expect(usageReading(499, 500).percent).toBe(99)
    expect(usageReading(1, 3).percent).toBe(33)
  })

  it("is reached at exactly the limit", () => {
    expect(usageReading(500, 500)).toMatchObject({
      state: "reached",
      percent: 100,
      left: 0,
      fill: 100,
    })
  })

  it("is over past the limit, with the tick at limit / used", () => {
    expect(usageReading(1000, 500)).toMatchObject({ state: "over", over: 500, fill: 100, tick: 50 })
  })

  it("never puts the limit's tick left of 10%", () => {
    expect(usageReading(50_000, 500).tick).toBe(10)
  })

  it("has no percentage and no fill for a limit of 0 or less, and any spending is over", () => {
    expect(usageReading(40, 0)).toEqual({
      state: "over",
      percent: null,
      left: 0,
      over: 40,
      fill: 0,
      tick: null,
    })
    expect(usageReading(40, -10)).toMatchObject({ state: "over", over: 40, percent: null })
    expect(usageReading(0, 0).state).toBe("reached")
  })

  it("draws an empty bar for a negative reading", () => {
    expect(usageReading(-20, 500)).toMatchObject({ state: "under", percent: 0, fill: 0, left: 520 })
  })
})

describe("UsageMeter", () => {
  it("reads 412 of 500 as €412 of €500, 82%", () => {
    const html = render(<UsageMeter used={412} limit={500} format={euros} label="Groceries" />)
    expect(html).toContain(">€412 of €500, 82%<")
    expect(attribute(html, "aria-valuenow")).toBe("412")
  })

  it("says what is left, in muted ink, well under the limit", () => {
    const html = render(<UsageMeter used={212} limit={500} format={euros} label="Groceries" />)
    expect(html).toContain(">€288 left<")
    expect(attribute(html, "aria-valuetext")).toBe("€212 of €500, 42%, €288 left")
    expect(html).toContain("bg-muted-foreground")
    expect(html).not.toContain("<svg")
  })

  it("clamps aria-valuenow to the limit over it, and says how far over", () => {
    const html = render(<UsageMeter used={512} limit={500} format={euros} label="Clothes" />)
    expect(attribute(html, "aria-valuenow")).toBe("500")
    expect(attribute(html, "aria-valuemax")).toBe("500")
    expect(attribute(html, "aria-valuetext")).toBe("€512 of €500, €12 over")
    expect(html).toContain(">€512 of €500<")
    expect(html).toContain(">€12 over<")
    expect(html).toContain("bg-danger")
    expect(html).toContain("data-limit-tick")
  })

  it("warns close to the limit and at it", () => {
    const near = render(<UsageMeter used={482} limit={500} format={euros} label="Restaurants" />)
    expect(near).toContain(">Close to the limit, €18 left<")
    expect(attribute(near, "aria-valuetext")).toBe(
      "€482 of €500, 96%, close to the limit, €18 left",
    )
    expect(near).toContain("bg-warning")
    const reached = render(<UsageMeter used={500} limit={500} format={euros} label="Fuel" />)
    expect(reached).toContain(">Limit reached<")
    expect(attribute(reached, "aria-valuetext")).toBe("€500 of €500, limit reached")
  })

  it("is named by its label and hides the rows the valuetext already says", () => {
    const html = render(<UsageMeter used={412} limit={500} format={euros} label="Groceries" />)
    const id = attribute(html, "aria-labelledby")
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
    expect(html).toMatch(/role="meter"/)
    expect(html.match(/<(div|span|p) aria-hidden="true"/g)?.length).toBe(3)
  })

  it("animates the fill only for people who allow motion", () => {
    const html = render(<UsageMeter used={412} limit={500} format={euros} label="Groceries" />)
    expect(html).toContain("motion-safe:transition-[width]")
    expect(html).not.toMatch(/[" ]transition-\[width\]/)
  })

  it("formats the percentage in the given locale", () => {
    const html = render(
      <UsageMeter used={412} limit={500} format={euros} label="Lebensmittel" locale="de" />,
    )
    expect(html).toContain("82 %")
  })

  it("speaks the catalog's language when one is provided", () => {
    const german = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })
    const html = render(
      <I18nContext.Provider value={german}>
        <UsageMeter used={512} limit={500} format={euros} label="Kleidung" />
      </I18nContext.Provider>,
    )
    expect(attribute(html, "aria-valuetext")).toBe(
      german.t("UsageMeter.valueTextOver", { used: "€512", limit: "€500", over: "€12" }),
    )
    expect(attribute(html, "aria-valuetext")).not.toBe("€512 of €500, €12 over")
  })

  it("keeps its English defaults equal to the catalog", () => {
    const english = createTranslator({ language: "en", catalogs: [{ source: en }] })
    expect(usageMeterLabels.value("a", "b", "c")).toBe(
      english.t("UsageMeter.value", { used: "a", limit: "b", percent: "c" }),
    )
    expect(usageMeterLabels.valueTextNear("a", "b", "c", "d")).toBe(
      english.t("UsageMeter.valueTextNear", { used: "a", limit: "b", percent: "c", left: "d" }),
    )
    expect(usageMeterLabels.reached).toBe(english.t("UsageMeter.reached"))
  })
})
