/**
 * Normalising `@source` entries for Tailwind's Rust scanner.
 *
 * `compile()` hands the directive back exactly as written: `@source "../../ui"` in `pages/styles.css`
 * arrives as base `pages/` plus the pattern `../../ui`. The scanner finds nothing when the pattern
 * walks up more than one directory, which for this demo is every source it has — so the non-glob
 * head is resolved against the base first, leaving a clean absolute base and a plain glob behind.
 * Which files are scanned does not change, only how the path is spelled.
 */

import { resolve } from "node:path"

/** One source entry, in the shape `compile()` returns and {@link Scanner} takes. */
export interface SourceEntry {
  /** Directory the pattern is relative to. */
  base: string
  /** Glob pattern, relative to {@link base}. */
  pattern: string
  /** Whether the entry excludes what it matches. */
  negated: boolean
}

/** Characters that make a pattern a glob rather than a path. */
const GLOB = /[*?[\]{}]/

/**
 * Rewrite one entry with an absolute, `..`-free base.
 *
 * @param entry Entry as `compile()` returned it.
 * @returns The same files, addressed in the shape the scanner resolves.
 */
export function normalizeSource({ base, pattern, negated }: SourceEntry): SourceEntry {
  const globAt = pattern.search(GLOB)

  // A directory rather than a pattern: scan everything under it.
  if (globAt < 0) {
    return { base: resolve(base, pattern), pattern: "**/*", negated }
  }

  const separator = pattern.lastIndexOf("/", globAt)
  if (separator < 0) {
    return { base, pattern, negated }
  }

  return {
    base: resolve(base, pattern.slice(0, separator)),
    pattern: pattern.slice(separator + 1),
    negated,
  }
}

/**
 * Rewrite every entry a stylesheet declared.
 *
 * @param sources Entries from `compiler.sources`.
 * @returns Entries the scanner can resolve.
 */
export function normalizeSources(sources: SourceEntry[]): SourceEntry[] {
  return sources.map(normalizeSource)
}
