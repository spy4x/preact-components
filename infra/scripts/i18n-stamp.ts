/**
 * Writes the lock of every translated catalog: for each package with an `i18n/en.ts`, one
 * `i18n/<language>.lock` per `i18n/<language>.ts`, as `stampLocks` from
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

/** A catalog module's file name, such as `en.ts` or `pt-BR.ts`: a language tag, then `.ts`. */
const CATALOG_FILE = /^([a-z]{2,3}(?:-[A-Za-z0-9]+)*)\.ts$/

/** The catalog a module in the `i18n/` folder at `dir` exports as its default. */
async function importCatalog(dir: URL, name: string): Promise<Catalog> {
  return (await import(new URL(name, dir).href)).default
}

/** The English catalog and every translation of the `i18n/` folder at `dir`. */
export async function readCatalogs(
  dir: URL,
): Promise<{ source: Catalog; languages: Record<string, Catalog> }> {
  const languages: Record<string, Catalog> = {}
  for await (const entry of Deno.readDir(dir)) {
    const language = entry.name.match(CATALOG_FILE)?.[1]
    if (!entry.isFile || !language || language === "en") continue
    languages[language] = await importCatalog(dir, entry.name)
  }
  return { source: await importCatalog(dir, "en.ts"), languages }
}

if (import.meta.main) {
  const root = new URL("../../", import.meta.url)
  for await (const member of Deno.readDir(root)) {
    const dir = new URL(`${member.name}/i18n/`, root)
    try {
      await Deno.stat(new URL("en.ts", dir))
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
