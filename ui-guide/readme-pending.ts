/**
 * Helpers whose package README does not name them yet, per package, one name per line.
 *
 * `coverage.ts` excuses each name here from the README line the coverage rule asks of a helper.
 * The list only shrinks: when a README names one of these in code, the coverage test fails until
 * the name is removed from here. Adding a new export here to skip its README line is what review
 * refuses.
 *
 * Seeded with every helper no README named when the guide stopped showing helpers (#357); #373
 * tracks emptying it.
 */

import type { PackageId } from "./registry.ts"

/** Names awaiting a README line, by package; alphabetical, so a removal touches one line. */
export const README_PENDING: Record<PackageId, readonly string[]> = {
  ui: [],
  charts: [],
  map: [],
  system: [],
  crud: [],
  theme: [],
  signals: [],
  cn: [],
}
