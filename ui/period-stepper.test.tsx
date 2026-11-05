import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { periodOf, PeriodUnit } from "@spy4x/time/period"
import en from "./i18n/en.ts"
import de from "./i18n/de.ts"
import { I18nContext } from "./i18n.tsx"
import { PeriodStepper, periodStepperLabels } from "./period-stepper.tsx"

/** Sunday 1 November 2026, midday in Berlin. */
const NOW = new Date("2026-11-01T11:00:00Z")
const ZONE = "Europe/Berlin"
const NOVEMBER = periodOf(PeriodUnit.Month, "2026-11-01", {})
const AUGUST = periodOf(PeriodUnit.Month, "2026-08-01", {})

function stepper(props: Partial<Parameters<typeof PeriodStepper>[0]> = {}): string {
  return render(
    <PeriodStepper
      period={NOVEMBER}
      onChange={() => {}}
      now={NOW}
      timeZone={ZONE}
      locale="en-GB"
      {...props}
    />,
  )
}

describe("PeriodStepper", () => {
  it("names the group by its unit and puts the period's name in a polite live region", () => {
    const html = stepper()
    expect(html).toMatch(/^<div role="group" aria-label="Month"/)
    expect(html).toMatch(/aria-live="polite" aria-atomic="true"[^>]*>November 2026</)
  })

  it("shows the return button only while another period is on screen", () => {
    expect(stepper()).not.toContain(">This month<")
    const august = stepper({ period: AUGUST })
    expect(august).toContain("August 2026")
    expect(august).toContain("This month")
  })

  it("binds [, ] and t, and says so in aria-keyshortcuts", () => {
    const html = stepper({ period: AUGUST })
    expect(html).toContain(`aria-keyshortcuts="[" aria-label="Previous month"`)
    expect(html).toContain(`aria-keyshortcuts="]" aria-label="Next month"`)
    expect(html).toMatch(/aria-keyshortcuts="T"[^>]*>This month/)
  })

  it("takes another key for the return button", () => {
    expect(stepper({ period: AUGUST, currentHotkey: "c" })).toContain(`aria-keyshortcuts="C"`)
  })

  it("keeps the arrows' key hints in their tooltips, not on the buttons", () => {
    const html = stepper({ period: AUGUST })
    const previousButton = html.match(/<button aria-keyshortcuts="\[".*?<\/button>/)?.[0] ?? ""
    expect(previousButton).toContain("<svg")
    expect(previousButton).not.toContain("<kbd")
    expect(html).toMatch(/role="tooltip"[^>]*>.*?Previous month.*?<kbd[^>]*>\[<\/kbd>/)
  })

  it("opens the previous arrow's tooltip from its start edge, so it stays on a phone's screen", () => {
    const surfaces = [...stepper().matchAll(/<span[^>]*class="([^"]*bottom-full[^"]*)"/g)]
      .map((match) => match[1].split(" "))
    expect(surfaces).toHaveLength(2)
    expect(surfaces[0]).toContain("start-0")
    expect(surfaces[0]).not.toContain("start-1/2")
    expect(surfaces[0]).not.toContain("-translate-x-1/2")
    expect(surfaces[1]).toContain("start-1/2")
  })

  it("binds no key and shows no key hint with singleKeys off", () => {
    const html = stepper({ period: AUGUST, singleKeys: false })
    expect(html).not.toContain("aria-keyshortcuts")
    expect(html).not.toContain("<kbd")
  })

  it("names its buttons by the week when it steps through weeks", () => {
    const html = stepper({ period: periodOf(PeriodUnit.Week, "2026-10-12", {}) })
    expect(html).toMatch(/^<div role="group" aria-label="Week"/)
    expect(html).toContain(`aria-label="Previous week"`)
    expect(html).toContain(`aria-label="Next week"`)
    expect(html).toContain("This week")
    expect(html).toContain("12–18 Oct 2026")
  })

  it("finds today's week by the first weekday it is given", () => {
    const sundayWeek = periodOf(PeriodUnit.Week, "2026-11-01", { firstWeekday: 7 })
    expect(stepper({ period: sundayWeek, options: { firstWeekday: 7 } })).not.toContain(
      "This week",
    )
    expect(stepper({ period: sundayWeek })).toContain("This week")
  })

  it("speaks the catalog's language when one is provided", () => {
    const german = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })
    const html = render(
      <I18nContext.Provider value={german}>
        <PeriodStepper period={AUGUST} onChange={() => {}} now={NOW} timeZone={ZONE} />
      </I18nContext.Provider>,
    )
    expect(html).toContain(`aria-label="${de["PeriodStepper.previousMonth"]}"`)
    expect(html).toContain("August 2026")
    expect(html).not.toContain("Previous month")
  })

  it("keeps its English defaults equal to the catalog", () => {
    for (const [field, text] of Object.entries(periodStepperLabels)) {
      expect(en[`PeriodStepper.${field}` as keyof typeof en]).toBe(text)
    }
  })
})
