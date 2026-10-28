/**
 * A switch that shows a card's demo in Arabic, right to left, for the `system` and `crud` cards
 * (#876): the components' own words come from the Arabic catalogs, and the demo sits in
 * `lang="ar" dir="rtl"`, so a reviewer sees the mirrored layout with real Arabic text. Off, the
 * demo renders as it always has, in the language of the page around it.
 */

import { createTranslator, type Translator } from "@spy4x/platform/universal/i18n"
import { useSignal } from "@preact/signals"
import { I18nContext } from "@spy4x/preact-ui"
import uiEn from "@spy4x/preact-ui/i18n/en"
import uiAr from "@spy4x/preact-ui/i18n/ar"
import systemEn from "@spy4x/preact-system/i18n/en"
import systemAr from "@spy4x/preact-system/i18n/ar"
import crudEn from "@spy4x/preact-crud/i18n/en"
import crudAr from "@spy4x/preact-crud/i18n/ar"
import type { ComponentChildren, JSX } from "preact"

let arabic: Translator<string> | undefined

/** The `ui`, `system` and `crud` translator for Arabic, made once. */
function arabicTranslator(): Translator<string> {
  arabic ??= createTranslator({
    language: "ar",
    catalogs: [
      { source: uiEn, translation: uiAr },
      { source: systemEn, translation: systemAr },
      { source: crudEn, translation: crudAr },
    ],
  })
  return arabic
}

/**
 * The demo, with a checkbox above it that switches it to Arabic, right to left. `name` makes the
 * checkbox's and the wrapper's `data-e2e` hooks: `<name>-arabic` and `<name>-direction`.
 */
export function ArabicSwitch(
  { name, children }: { name: string; children: ComponentChildren },
): JSX.Element {
  const on = useSignal(false)
  return (
    <div class="flex flex-col gap-4">
      <label class="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="pc-checkbox"
          checked={on.value}
          onChange={(event) => on.value = event.currentTarget.checked}
          data-e2e={`${name}-arabic`}
        />
        Arabic, right to left
      </label>
      {on.value
        ? (
          <I18nContext.Provider value={arabicTranslator()}>
            <div lang="ar" dir="rtl" data-e2e={`${name}-direction`}>{children}</div>
          </I18nContext.Provider>
        )
        : <div data-e2e={`${name}-direction`}>{children}</div>}
    </div>
  )
}
