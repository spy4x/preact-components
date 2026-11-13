import type { Translator } from "@spy4x/platform/universal/i18n"
import { timeAgo } from "@spy4x/platform/universal/time"
import { createFormatters } from "@spy4x/time/format"

/**
 * How long ago `at` was, in the translator's language: `timeAgo`'s English words when that language
 * is English, so a page without a translator reads as it always has, else `Intl`'s ("vor 2 Tagen").
 */
export function agoIn(
  translator: Translator<string>,
  at: null | undefined | number | string | Date,
): string {
  if (at === null || at === undefined || translator.language.toLowerCase().split("-")[0] === "en") {
    return timeAgo(at)
  }
  return createFormatters({ locale: translator.language }).relative(new Date(at))
}
