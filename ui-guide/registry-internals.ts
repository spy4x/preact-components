/**
 * Catalogue values only this repository's tests read. Not an entry point of the package.
 *
 * @module
 */

import { catalogueSections } from "./registry.ts"

export { CLASS_PACKAGE } from "./registry-ids.ts"

/** Card ids of the class sections, in render order: the demos that document classes, not components. */
export const classDemoNames: string[] = catalogueSections
  .filter((section) => section.kind === "class")
  .flatMap((section) => section.names)
