import type { Devtools } from "./harness.ts"

/**
 * `system/`'s browser checks: none yet. Shell/Nav focus management and SWUpdater's registration are
 * the checks due here — behaviour behind an effect or a listener that a string-rendering test cannot
 * execute.
 *
 * This file exists so the first one lands here without touching any other package's file.
 *
 * @param _devtools The connected session, on a hydrated page.
 */
export async function systemChecks(_devtools: Devtools): Promise<void> {
}
