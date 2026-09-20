import type { Devtools } from "./harness.ts"

/**
 * `charts/`'s browser checks: none yet. The interactive d3 wrappers' hover/focus behaviour — tooltip
 * and keyboard navigation over the SVG marks — is what belongs here, since that lives behind an
 * event listener a string-rendering test cannot execute.
 *
 * This file exists so the first one lands here without touching any other package's file.
 *
 * @param _devtools The connected session, on a hydrated page.
 */
export async function chartsChecks(_devtools: Devtools): Promise<void> {
}
