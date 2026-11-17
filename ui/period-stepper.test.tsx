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

/** The markup of the button back to the current period: the `<button>` holding `name`. */
function returnButton(html: string, name = "This month"): string {
  const button = html.match(new RegExp(`<button[^>]*>${name}.*?</button>`))?.[0]
  if (!button) throw new Error(`no "${name}" button in ${html}`)
  return button
}

/** The cell holding the period's name: its unseen sizers, then the live region. */
function nameCell(html: string): string {
  const cell = html.match(/<span class="grid[^"]*">.*?<span aria-live="polite".*?<\/span><\/span>/)
    ?.[0]
  if (!cell) throw new Error(`no name cell in ${html}`)
  return cell
}

/** The names stacked unseen in the name's cell, in order. */
function sizers(html: string): string[] {
  return [
    ...nameCell(html).matchAll(/<span aria-hidden="true" class="invisible[^"]*">(.*?)<\/span>/g),
  ]
    .map((match) => match[1])
}

/** Whether a button is hidden with `invisible`, keeping its place. */
function isHidden(button: string): boolean {
  return /class="[^"]*\binvisible\b/.test(button)
}

describe("PeriodStepper", () => {
  it("names the group by its unit and puts the period's name in a polite live region", () => {
    const html = stepper()
    expect(html).toMatch(/^<div role="group" aria-label="Month"/)
    expect(html).toMatch(/aria-live="polite" aria-atomic="true"[^>]*>November 2026</)
  })

  it("puts the period's name on its own line below sm, from the line's start, whatever its length", () => {
    const name = nameCell(stepper()).match(/^<span[^>]*>/)?.[0] ?? ""
    expect(name).toMatch(/class="[^"]*\bbasis-full\b/)
    expect(name).toMatch(/class="[^"]*\bsm:basis-auto\b/)
    // `pc-num` aligns right, so on a full-width line the name's start would follow its length.
    expect(name).not.toContain("pc-num")
  })

  it("sizes the name's cell by the 12 months of the year shown, unseen and unread", () => {
    const html = stepper({ period: AUGUST })
    expect(sizers(html)).toEqual([
      "January 2026",
      "February 2026",
      "March 2026",
      "April 2026",
      "May 2026",
      "June 2026",
      "July 2026",
      "August 2026",
      "September 2026",
      "October 2026",
      "November 2026",
      "December 2026",
    ])
    expect(sizers(stepper({ period: periodOf(PeriodUnit.Month, "2027-03-01", {}) }))[0])
      .toBe("January 2027")
  })

  it("puts only the current period's name in the live region", () => {
    const live = stepper({ period: AUGUST }).match(/<span aria-live="polite"[^>]*>(.*?)<\/span>/)
    expect(live?.[1]).toBe("August 2026")
  })

  it("sizes a week's name by every week that starts in its year, laid out from its first weekday", () => {
    const monday = sizers(stepper({ period: periodOf(PeriodUnit.Week, "2026-10-12", {}) }))
    // 2026 has 52 Mondays, the first on 5 January and the last on 28 December.
    expect(monday).toHaveLength(52)
    expect(monday[0]).toBe("5–11 Jan 2026")
    expect(monday.at(-1)).toBe("28 Dec 2026 – 3 Jan 2027")
    const sunday = sizers(
      stepper({
        period: periodOf(PeriodUnit.Week, "2026-10-12", { firstWeekday: 7 }),
        options: { firstWeekday: 7 },
      }),
    )
    expect(sunday[0]).toBe("4–10 Jan 2026")
  })

  it("names the sizers in the locale prop over the translator's language", () => {
    const german = createTranslator({ language: "de", catalogs: [{ source: en, translation: de }] })
    const html = (locale?: string) =>
      render(
        <I18nContext.Provider value={german}>
          <PeriodStepper
            period={AUGUST}
            onChange={() => {}}
            now={NOW}
            timeZone={ZONE}
            locale={locale}
          />
        </I18nContext.Provider>,
      )
    expect(sizers(html())[2]).toBe("März 2026")
    expect(sizers(html("en-GB"))[2]).toBe("March 2026")
  })

  it("hides the return button on the current period, keeping its key hint but binding no key", () => {
    const november = returnButton(stepper())
    expect(november).toContain("This month")
    expect(isHidden(november)).toBe(true)
    expect(november).not.toContain("aria-keyshortcuts")
    expect(november).toMatch(/<kbd[^>]*>T<\/kbd>/)
    const august = returnButton(stepper({ period: AUGUST }))
    expect(isHidden(august)).toBe(false)
    expect(august).toContain(`aria-keyshortcuts="T"`)
  })

  it("puts the return button before the arrows, so it sits on the start side in both directions", () => {
    const html = stepper({ period: AUGUST })
    const back = html.indexOf(">This month<")
    expect(back).toBeGreaterThan(-1)
    expect(back).toBeLessThan(html.indexOf(`aria-label="Previous month"`))
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
    for (const period of [AUGUST, NOVEMBER]) {
      const html = stepper({ period, singleKeys: false })
      expect(html).not.toContain("aria-keyshortcuts")
      expect(html).not.toContain("<kbd")
    }
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
    const sundayFirst = stepper({ period: sundayWeek, options: { firstWeekday: 7 } })
    expect(isHidden(returnButton(sundayFirst, "This week"))).toBe(true)
    expect(isHidden(returnButton(stepper({ period: sundayWeek }), "This week"))).toBe(false)
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
