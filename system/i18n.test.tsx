import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import type { ComponentChildren } from "preact"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { I18nContext } from "@spy4x/preact-ui/i18n"
import uiDe from "@spy4x/preact-ui/i18n/de"
import uiEn from "@spy4x/preact-ui/i18n/en"
import { Calendar } from "./calendar.tsx"
import { ConflictChooser, type ConflictItem } from "./conflict-chooser.tsx"
import systemDe from "./i18n/de.ts"
import systemEn from "./i18n/en.ts"
import systemEs from "./i18n/es.ts"
import systemPtBr from "./i18n/pt-BR.ts"
import systemRu from "./i18n/ru.ts"
import { SyncStatus } from "./sync-status.tsx"

const GERMAN = createTranslator({
  language: "de",
  catalogs: [{ source: uiEn, translation: uiDe }, { source: systemEn, translation: systemDe }],
})

const RUSSIAN = createTranslator({
  language: "ru",
  catalogs: [{ source: systemEn, translation: systemRu }],
})

function inGerman(children: ComponentChildren): string {
  return render(<I18nContext.Provider value={GERMAN}>{children}</I18nContext.Provider>)
}

/** The accessible names of the calendar's days, by date. */
function dayNames(html: string): Record<string, string> {
  const names: Record<string, string> = {}
  for (const match of html.matchAll(/<[^>]*data-calendar-date="([\d-]+)"[^>]*>/g)) {
    const label = match[0].match(/aria-label="([^"]*)"/)
    if (label) names[match[1]] = label[1]
  }
  return names
}

describe("the system components under a translator", () => {
  it("name each calendar day by its reason in the translator's words", () => {
    const html = inGerman(
      <Calendar
        monthAnchor="2026-08-01"
        minDate="2026-08-03"
        maxDate="2026-08-20"
        today="2026-08-03"
        availableByDate={{ "2026-08-04": 3, "2026-08-05": 0 }}
      />,
    )
    const names = dayNames(html)
    // The words after the day's own label, which the calendar formats from the date.
    const dayOf = (date: string) => names[date]?.split(" – ")[1]
    expect({
      past: dayOf("2026-08-01"),
      count: dayOf("2026-08-04"),
      noneLeft: dayOf("2026-08-05"),
      after: dayOf("2026-08-21"),
    }).toEqual({
      past: "vorbei",
      count: "3 frei",
      noneLeft: "ausgebucht",
      after: "zu weit in der Zukunft",
    })
    expect(html).toContain(`aria-label="${systemDe["Calendar.nextMonth"]}: `)
  })

  it("pick the plural form of a counted day and of the unread counter", () => {
    const spanish = createTranslator({
      language: "es",
      catalogs: [{ source: systemEn, translation: systemEs }],
    })
    const html = render(
      <I18nContext.Provider value={spanish}>
        <Calendar
          monthAnchor="2026-08-01"
          minDate="2026-08-03"
          maxDate="2026-08-20"
          today="2026-08-03"
          availableByDate={{ "2026-08-04": 1, "2026-08-05": 2 }}
        />
      </I18nContext.Provider>,
    )
    const names = dayNames(html)
    expect([names["2026-08-04"]?.split(": ")[1], names["2026-08-05"]?.split(": ")[1]])
      .toEqual(["1 disponible", "2 disponibles"])
    const portuguese = createTranslator({
      language: "pt-BR",
      catalogs: [{ source: systemEn, translation: systemPtBr }],
    })
    expect([1, 3].map((count) => portuguese.t("AppShell.counter", { count })))
      .toEqual(["1 não lida", "3 não lidas"])
  })

  it("say offline alone, or offline with the waiting count, as two messages", () => {
    const inRussian = (pending: number) =>
      render(
        <I18nContext.Provider value={RUSSIAN}>
          <SyncStatus online={false} pending={pending} />
        </I18nContext.Provider>,
      )
    expect(inRussian(0)).toContain("Нет сети<")
    expect(inRussian(5)).toContain("Нет сети, 5 изменений ждут отправки")
  })

  it("explain each conflict reason in the translator's words", () => {
    const conflicts: ConflictItem[] = [
      { id: "1", label: "A", reason: "version", canKeepMine: true },
      { id: "2", label: "B", reason: "gone", canKeepMine: true },
      { id: "3", label: "C", reason: "rejected", canKeepMine: true },
    ]
    const html = inGerman(
      <ConflictChooser conflicts={conflicts} onKeepMine={() => {}} onUseTheirs={() => {}} />,
    )
    for (const reason of ["version", "gone", "rejected"] as const) {
      expect(html).toContain(systemDe[`ConflictChooser.explanation.${reason}`])
      expect(html).toContain(systemDe[`ConflictChooser.keepMine.${reason}`])
      expect(html).toContain(systemDe[`ConflictChooser.useTheirs.${reason}`])
    }
  })
})
