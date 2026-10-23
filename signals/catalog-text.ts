import type { MessageValues, Translator } from "@spy4x/platform/universal/i18n"

/**
 * The message `key` from `translator`, or `undefined` when there is no translator or its catalogs
 * lack the key: a translator gives an unknown key back as itself.
 */
export function catalogText(
  translator: Translator<string> | undefined,
  key: string,
  values?: MessageValues,
): string | undefined {
  if (translator === undefined) return undefined
  const text = translator.t(key, values)
  return text === key ? undefined : text
}
