/**
 * The language state the `LanguagePicker`, `LanguageDialog` and `AccountMenu` cards share: the
 * library's own catalogs in every language it ships, a loading step that takes a moment, and the
 * offline and failure states a card can turn on.
 *
 * "Automatic" is the language of the page around the demo, so the guide's own checks, which render
 * every card under a pseudo-language and German, see the demo in their language until a person
 * picks another.
 */

import { createTranslator, type Translator } from "@spy4x/platform/universal/i18n"
import { useSignal } from "@preact/signals"
import { I18nContext, ToggleChips, useT } from "@spy4x/preact-ui"
import uiEn from "@spy4x/preact-ui/i18n/en"
import uiDe from "@spy4x/preact-ui/i18n/de"
import uiEs from "@spy4x/preact-ui/i18n/es"
import uiPtBr from "@spy4x/preact-ui/i18n/pt-BR"
import uiRu from "@spy4x/preact-ui/i18n/ru"
import uiAr from "@spy4x/preact-ui/i18n/ar"
import uiFr from "@spy4x/preact-ui/i18n/fr"
import uiJa from "@spy4x/preact-ui/i18n/ja"
import uiZhCn from "@spy4x/preact-ui/i18n/zh-CN"
import systemEn from "@spy4x/preact-system/i18n/en"
import systemDe from "@spy4x/preact-system/i18n/de"
import systemEs from "@spy4x/preact-system/i18n/es"
import systemPtBr from "@spy4x/preact-system/i18n/pt-BR"
import systemRu from "@spy4x/preact-system/i18n/ru"
import systemAr from "@spy4x/preact-system/i18n/ar"
import systemFr from "@spy4x/preact-system/i18n/fr"
import systemJa from "@spy4x/preact-system/i18n/ja"
import systemZhCn from "@spy4x/preact-system/i18n/zh-CN"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** The languages the library ships, in the order a picker lists them. */
export const DEMO_LANGUAGES = ["en", "de", "es", "fr", "pt-BR", "ru", "ar", "ja", "zh-CN"] as const

const catalogs: Record<string, [Record<string, unknown>, Record<string, unknown>]> = {
  en: [uiEn, systemEn],
  de: [uiDe, systemDe],
  es: [uiEs, systemEs],
  "pt-BR": [uiPtBr, systemPtBr],
  ru: [uiRu, systemRu],
  ar: [uiAr, systemAr],
  fr: [uiFr, systemFr],
  ja: [uiJa, systemJa],
  "zh-CN": [uiZhCn, systemZhCn],
}

const translators = new Map<string, Translator<string>>()

/** The `ui` and `system` translator for one shipped language, made once. */
function translatorFor(language: string): Translator<string> {
  const known = translators.get(language)
  if (known) return known
  const [ui, system] = catalogs[language]
  const made = createTranslator({
    language,
    catalogs: [
      { source: uiEn, translation: ui as typeof uiEn },
      { source: systemEn, translation: system as typeof systemEn },
    ],
  })
  translators.set(language, made)
  return made
}

/** How long the demo takes to "load" a language, so the spinner shows. */
const LOAD_MS = 700

/** A language choice with its loading, offline and failure states, for one card. */
export interface DemoLanguage {
  current: string | null
  pending: string | null | undefined
  failed: string | undefined
  automatic: string
  unavailable: string[]
  offline: boolean
  failing: boolean
  translator: Translator<string>
  select: (tag: string | null) => void
  setOffline: (on: boolean) => void
  setFailing: (on: boolean) => void
}

/**
 * The demo's language state. Choosing loads for {@link LOAD_MS}, then switches, or, with
 * `failing` on, reports the language as failed and keeps the old one. Offline, Spanish and
 * Brazilian Portuguese are "not cached".
 */
export function useDemoLanguage(): DemoLanguage {
  const outer = useT()
  const current = useSignal<string | null>(null)
  const pending = useSignal<string | null | undefined>(undefined)
  const failed = useSignal<string | undefined>(undefined)
  const offline = useSignal(false)
  const failing = useSignal(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const select = (tag: string | null) => {
    clearTimeout(timer.current)
    failed.value = undefined
    pending.value = tag
    timer.current = setTimeout(() => {
      pending.value = undefined
      if (failing.value && tag !== null) failed.value = tag
      else current.value = tag
    }, LOAD_MS)
  }

  return {
    current: current.value,
    pending: pending.value,
    failed: failed.value,
    automatic: outer.language,
    unavailable: offline.value ? ["es", "pt-BR"] : [],
    offline: offline.value,
    failing: failing.value,
    translator: current.value === null ? outer : translatorFor(current.value),
    select,
    setOffline: (on) => offline.value = on,
    setFailing: (on) => failing.value = on,
  }
}

/** Everything inside speaks the demo's language, in its direction. */
export function InDemoLanguage(
  { language, children }: { language: DemoLanguage; children: ComponentChildren },
): JSX.Element {
  const { translator } = language
  return (
    <I18nContext.Provider value={translator}>
      <div lang={translator.language} dir={translator.dir}>{children}</div>
    </I18nContext.Provider>
  )
}

/** Chips that turn the demo offline, or make the next language fail to load. */
export function SimulateLanguageStates({ language }: { language: DemoLanguage }): JSX.Element {
  const value = [language.offline && "offline", language.failing && "failing"].filter(
    (item): item is string => typeof item === "string",
  )
  return (
    <ToggleChips
      label="Simulate"
      options={[
        { value: "offline", label: "Offline" },
        { value: "failing", label: "Loading fails" },
      ]}
      value={value}
      onChange={(next) => {
        language.setOffline(next.includes("offline"))
        language.setFailing(next.includes("failing"))
      }}
    />
  )
}
