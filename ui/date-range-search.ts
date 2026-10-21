/**
 * A `DateRangePicker` choice kept in a page's address, so a link opens the same range.
 *
 * One format for every page: a preset is `?range=last-7-days`; a custom range is
 * `?from=2026-10-01&to=2026-10-21`; the page's default preset is left out, so the plain link stays
 * clean. Reading is tolerant: an unknown preset, a malformed or reversed custom range, or a preset
 * the page does not offer reads as the default, because an address can be typed or old.
 */

import { type DateRange, isValidDateRange } from "@spy4x/time/date"
import { type DateRangePreset, dateRangePresets, rangeForPreset } from "./date-range.ts"

/** A picker's choice: the preset, or `"custom"`, and the days it covers. */
export interface DateRangeChoice {
  preset: DateRangePreset
  range: DateRange
}

/** What {@link rangeFromSearch} needs to resolve a preset to days. */
export interface RangeFromSearchOptions {
  /** The instant relative presets are resolved against. */
  now: Date
  /** The IANA zone that decides which day `now` falls on. */
  timeZone: string
  /** The preset an address without one means. */
  defaultPreset: Exclude<DateRangePreset, "custom">
  /** The presets the page offers; any other reads as the default. Defaults to every preset. */
  presets?: readonly DateRangePreset[]
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The range an address asks for, or the default preset's when it asks for none or for one that
 * cannot be read.
 *
 * @param search The address's query, such as `new URLSearchParams(location.search)`.
 * @param options The clock, the zone, the default and the offered presets.
 */
export function rangeFromSearch(
  search: URLSearchParams,
  options: RangeFromSearchOptions,
): DateRangeChoice {
  const { now, timeZone, defaultPreset, presets = dateRangePresets } = options
  const from = search.get("from")
  const to = search.get("to")
  if (from !== null && to !== null && presets.includes("custom")) {
    const custom = { from, to }
    if (ISO_DAY.test(from) && ISO_DAY.test(to) && isValidDateRange(custom)) {
      return { preset: "custom", range: custom }
    }
  }
  const asked = search.get("range")
  const preset = presets.find((candidate) => candidate !== "custom" && candidate === asked) ??
    defaultPreset
  return { preset, range: rangeForPreset(preset, { now, timeZone }) }
}

/**
 * `search` with the choice written into it, every other parameter kept. The default preset removes
 * `range`, `from` and `to`; another preset writes `range`; a custom range writes `from` and `to`.
 *
 * @param search The address's current query; it is not changed.
 * @param choice The picker's choice.
 * @param defaultPreset The preset left out of the address.
 */
export function rangeToSearch(
  search: URLSearchParams,
  choice: DateRangeChoice,
  defaultPreset: Exclude<DateRangePreset, "custom">,
): URLSearchParams {
  const next = new URLSearchParams(search)
  next.delete("range")
  next.delete("from")
  next.delete("to")
  if (choice.preset === "custom") {
    next.set("from", choice.range.from)
    next.set("to", choice.range.to)
  } else if (choice.preset !== defaultPreset) {
    next.set("range", choice.preset)
  }
  return next
}
