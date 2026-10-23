/**
 * Writes the lock of every translated catalog: for each package with an `i18n/en.json`, one
 * `i18n/<language>.lock` per `i18n/<language>.json`, as `stampLocks` from
 * `@spy4x/platform/universal/i18n` makes it. Run once the translations match the English; the
 * package's catalog test (`checkCatalogs`) then passes. `TRANSLATING.md` has the whole loop.
 *
 * ```bash
 * deno task i18n:stamp
 * ```
 *
 * @module
 */
import { type Catalog, stampLocks } from "@spy4x/platform/universal/i18n"

/** The English catalog and every translation of the `i18n/` folder at `dir`. */
export async function readCatalogs(
  dir: URL,
): Promise<{ source: Catalog; languages: Record<string, Catalog> }> {
  const languages: Record<string, Catalog> = {}
  for await (const entry of Deno.readDir(dir)) {
    const language = entry.name.match(/^(.+)\.json$/)?.[1]
    if (!entry.isFile || !language || language === "en") continue
    languages[language] = JSON.parse(await Deno.readTextFile(new URL(entry.name, dir)))
  }
  const source = JSON.parse(await Deno.readTextFile(new URL("en.json", dir)))
  return { source, languages }
}

if (import.meta.main) {
  const root = new URL("../../", import.meta.url)
  for await (const member of Deno.readDir(root)) {
    const dir = new URL(`${member.name}/i18n/`, root)
    try {
      await Deno.stat(new URL("en.json", dir))
    } catch {
      continue
    }
    const { source, languages } = await readCatalogs(dir)
    const locks = await stampLocks(source, languages)
    for (const [language, lock] of Object.entries(locks)) {
      await Deno.writeTextFile(new URL(`${language}.lock`, dir), lock)
      console.log(`${member.name}/i18n/${language}.lock`)
    }
  }
}
