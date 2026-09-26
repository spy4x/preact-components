/**
 * The version the guide's header shows: the one every package's `deno.json` declares.
 *
 * `build.ts` reads it out of `ui-guide/deno.json` and hands it to the prerender and to the document,
 * which carries it on `#root` for the island, so the header never shows a version typed by hand.
 */

/**
 * The `"version"` of a `deno.json`'s text. The file may carry comments, so it is read with a
 * pattern rather than `JSON.parse`.
 *
 * @param config The text of a `deno.json`.
 * @returns The version, e.g. `"0.1.2"`.
 */
export function packageVersion(config: string): string {
  const version = /^\s*"version"\s*:\s*"([^"]+)"/m.exec(config)?.[1]
  if (version === undefined) throw new Error(`no "version" in the package config`)
  return version
}
