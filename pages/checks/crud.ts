import type { Devtools } from "./harness.ts"

/**
 * `crud/`'s browser checks: none yet. `CrudList`/`CrudEditor`/`AssociationEditor` keyboard and focus
 * behaviour is what belongs here — anything behind a ref, an effect or a key press that a
 * string-rendering test cannot execute.
 *
 * This file exists so the first one lands here without touching any other package's file.
 *
 * @param _devtools The connected session, on a hydrated page.
 */
export async function crudChecks(_devtools: Devtools): Promise<void> {
}
