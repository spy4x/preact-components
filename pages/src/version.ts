/**
 * The version the guide's header shows: the one every package's `deno.json` declares.
 *
 * `build.ts` reads it out of `ui-guide/deno.json` and hands it to the prerender and to the document,
 * which carries it on `#root` for the island, so the header never shows a version typed by hand.
 */

import { type DenoConfig, memberConfig, readConfig } from "../../infra/scripts/workspace.ts"

/**
 * The `"version"` of a package config, as `readConfig` parsed it.
 *
 * @param config A parsed `deno.json`.
 * @returns The version, e.g. `"0.1.2"`.
 * @throws When the config declares no version.
 */
export function packageVersion(config: DenoConfig): string {
  if (typeof config.version !== "string") throw new Error(`no "version" in the package config`)
  return config.version
}

/** The version `ui-guide/deno.json` declares, read through the one config reader. */
export async function guideVersion(): Promise<string> {
  return packageVersion(await readConfig(await memberConfig("ui-guide")))
}
