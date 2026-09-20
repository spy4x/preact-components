import type { Devtools } from "./harness.ts"

/**
 * `signals/`'s browser checks: none yet. The URL filter hook (`useUrlFilters`) is the first one due
 * — its history-driven state is an effect this repository's string-rendering tests cannot execute.
 *
 * This file exists so that check lands here without touching any other package's file.
 *
 * @param _devtools The connected session, on a hydrated page.
 */
export async function signalsChecks(_devtools: Devtools): Promise<void> {
}
