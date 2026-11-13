/**
 * The words of the `system` components, read from the same `I18nContext` the `ui` components read.
 * An app adds this package's catalog beside the `ui` one:
 *
 * ```ts
 * import systemDe from "@spy4x/preact-system/i18n/de"
 * import systemEn from "@spy4x/preact-system/i18n/en"
 *
 * createTranslator({
 *   language: "de",
 *   catalogs: [{ source: uiEn, translation: uiDe }, { source: systemEn, translation: systemDe }],
 * })
 * ```
 *
 * @module
 */

import type { MessageValues, Translator } from "@spy4x/platform/universal/i18n"
import { translate as translateUi, type UiKey } from "@spy4x/preact-ui/i18n"
import type en from "./i18n/en.ts"

/** A key of the `system` package's own catalog, `"AuthForm.signIn"`. */
export type SystemKey = keyof typeof en

/**
 * The `system` message `key` from `translator`, or `english` when the translator lacks it: what a
 * component calls for a word that is not a field of its labels. `english` is the component's own
 * English for the same message, already filled in.
 */
export function translate(
  translator: Translator<string>,
  key: SystemKey,
  english: string,
  values?: MessageValues,
): string {
  // The `ui` helper's key type names the `ui` catalog; the lookup itself works for any key.
  return translateUi(translator, key as string as UiKey, english, values)
}
