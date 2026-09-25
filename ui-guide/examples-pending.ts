/**
 * Exports still waiting for an example card (#215), per package, one name per line.
 *
 * `coverage.ts` excuses each name here with the reason "example pending (#215)". The list only
 * shrinks: when an example covers a name, the coverage test fails until the name is removed from
 * here. Adding a new export here to skip its example is what review refuses.
 *
 * Seeded with every export that had neither a card nor an example when example cards were added.
 */

import type { PackageId } from "./registry.ts"

/** Names awaiting an example, by package; alphabetical, so a removal touches one line. */
export const EXAMPLES_PENDING: Record<PackageId, readonly string[]> = {
  ui: [],
  charts: [],
  system: [],
  crud: [],
  map: [],
  signals: [],
  theme: [],
  cn: [],
}
