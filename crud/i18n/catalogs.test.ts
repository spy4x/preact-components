import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { checkCatalogs } from "@spy4x/platform/universal/i18n"
import { readCatalogs } from "../../infra/scripts/i18n-stamp.ts"

const DIR = new URL("./", import.meta.url)

/** The languages the `crud` package ships, besides English. */
const SHIPPED = ["ar", "de", "es", "pt-BR", "ru"]

describe("the crud catalogs", () => {
  it("translate every English key, in step with its lock", async () => {
    const { source, languages } = await readCatalogs(DIR)
    const locks: Record<string, string> = {}
    for (const language of Object.keys(languages)) {
      locks[language] = await Deno.readTextFile(new URL(`${language}.lock`, DIR)).catch(() => "")
    }
    const problems = await checkCatalogs({ source, languages, locks })
    expect(problems.map((problem) => problem.message)).toEqual([])
  })

  it("ship every supported language", async () => {
    const { languages } = await readCatalogs(DIR)
    expect(Object.keys(languages).sort()).toEqual(SHIPPED)
  })
})
