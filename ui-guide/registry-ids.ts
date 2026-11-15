/**
 * The catalogue's package lists on their own, with no import, so a script that only needs the
 * lists (`infra/scripts/export-lists.ts`) does not load every section. `registry.ts` re-exports
 * them.
 *
 * @module
 */

/**
 * Every package whose components the catalogue renders, in reading order.
 *
 * Their markup is on the page, so the host's stylesheet has to scan them (`pages/styles.css`).
 */
export const packageIds = ["ui", "charts", "map", "system", "crud"] as const

/**
 * Packages that export helpers, so the guide shows none of their exports and no stylesheet needs to
 * scan them. `theme` still has a page, for the classes its preset ships; `server`'s one component,
 * `Head`, renders nothing of its own and is excused in `COMPONENTS_WITHOUT_CARD`.
 */
export const helperPackageIds = ["theme", "signals", "cn", "server"] as const

/**
 * Every package the coverage rule accounts for: {@link packageIds}, then {@link helperPackageIds}.
 *
 * Adding one here is what makes its every value export somebody's to account for — a component
 * needs a card, a helper a line in the package's README; `coverage.ts` reads this list and fails
 * when a package directory is neither covered nor excluded with a reason.
 */
export const coveredPackageIds = [...packageIds, ...helperPackageIds] as const

/** Identifier of a catalogued package: its directory, and the last segment of its specifier. */
export type PackageId = (typeof coveredPackageIds)[number]
