// Package-internal: the rows `CommandPalette` pins above the rest, Recent and Best match, and the
// storage of the recent picks. Only `clearCommandPaletteRecent` is public, re-exported by
// `command-palette.tsx`.

import { fold } from "./combobox.tsx"

/** How many picked ids a palette keeps per storage key. */
export const RECENT_KEPT = 10

/** How many of them the empty query lists. */
export const RECENT_SHOWN = 5

/**
 * The longest stored value read, in UTF-16 code units. Ten ids of a few hundred characters each
 * fit; anything longer was not written by the palette and is ignored rather than parsed.
 */
export const RECENT_MAX_LENGTH = 8192

/**
 * The ids a stored value holds, newest first: at most {@link RECENT_KEPT} strings. Anything else
 * (nothing stored, a value over {@link RECENT_MAX_LENGTH}, broken JSON, JSON that is not an array)
 * gives none, and the entries of an array that are not strings are skipped.
 *
 * @param raw The stored value, or `null` when there is none.
 */
export function parseRecent(raw: string | null): string[] {
  if (raw === null || raw.length > RECENT_MAX_LENGTH) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (_error) {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_KEPT)
}

/**
 * The recent ids after `id` was picked: `id` first, an earlier pick of it dropped, at most
 * {@link RECENT_KEPT} in all.
 *
 * @param ids The recent ids, newest first.
 * @param id The id just picked.
 */
export function addRecent(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((kept) => kept !== id)].slice(0, RECENT_KEPT)
}

/**
 * The options the recent ids name, newest first, at most {@link RECENT_SHOWN}: an id no option has
 * any more is skipped.
 *
 * @param ids The recent ids, newest first.
 * @param options The options listed now.
 */
export function recentOptions<T extends { id: string }>(
  ids: readonly string[],
  options: readonly T[],
): T[] {
  const byId = new Map(options.map((option) => [option.id, option]))
  const found: T[] = []
  for (const id of ids) {
    const option = byId.get(id)
    if (option !== undefined && !found.includes(option)) found.push(option)
    if (found.length === RECENT_SHOWN) break
  }
  return found
}

/**
 * The first command (an option with `run`) whose label or one of whose `aliases` starts with
 * `query`, folding case and accents, or `undefined` for none or an empty query.
 *
 * @param options The options listed, best first.
 * @param query What the reader typed.
 */
export function bestMatch<
  T extends { label: string; aliases?: readonly string[]; run?: unknown },
>(options: readonly T[], query: string): T | undefined {
  const needle = fold(query.trim())
  if (needle === "") return undefined
  return options.find((option) =>
    option.run !== undefined &&
    [option.label, ...option.aliases ?? []].some((name) => fold(name).startsWith(needle))
  )
}

/** `localStorage`, or `null` where the runtime has none or the browser blocks it. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (_error) {
    return null
  }
}

/**
 * The recent ids kept under `key`, newest first; none where storage is missing, blocked or holds
 * something else. Never throws.
 *
 * @param key The palette's `storageKey`.
 */
export function readRecent(key: string): string[] {
  try {
    return parseRecent(storage()?.getItem(key) ?? null)
  } catch (_error) {
    return []
  }
}

/**
 * Keeps `ids` under `key`. A write the browser refuses (storage blocked, the quota full) is
 * dropped: the palette works the same, it only forgets. Never throws.
 *
 * @param key The palette's `storageKey`.
 * @param ids The recent ids, newest first.
 */
export function writeRecent(key: string, ids: readonly string[]): void {
  try {
    storage()?.setItem(key, JSON.stringify(ids))
  } catch (_error) {
    // Recent picks are a convenience: losing them must not break a pick.
  }
}

/**
 * Forgets the recent picks a `CommandPalette` keeps under `storageKey`, such as on sign-out, so the
 * next person on the device does not see them. Never throws, also where storage is blocked.
 *
 * @param storageKey The palette's `storageKey`.
 */
export function clearCommandPaletteRecent(storageKey: string): void {
  try {
    storage()?.removeItem(storageKey)
  } catch (_error) {
    // Nothing the browser lets us reach is stored, so there is nothing to forget.
  }
}
