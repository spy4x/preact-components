import { fromFileUrl, join } from "@std/path"
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  assertFilesFound,
  matchLines,
  parseDryRunFiles,
  parseNames,
  PUBLISHED_PACKAGES,
  readAndMatch,
  readNames,
  wordBoundaryPattern,
} from "./private-names.ts"

/**
 * A path that is guaranteed not to exist, for testing a "file not found" failure without needing
 * write access to create (and clean up) a fixture — this suite runs under `--allow-read --allow-env`
 * only, the same as every other package's.
 */
const MISSING_PATH = "/private-names-test-fixture-does-not-exist/nope.txt"

/** This test file's own path, real and stable, for testing a successful read with no fixture. */
const THIS_FILE = fromFileUrl(import.meta.url)

describe("matchLines", () => {
  it("finds a name that is the whole line", () => {
    expect(matchLines("acmecorp", ["acmecorp"])).toEqual([1])
  })

  it("finds a name inside a longer line", () => {
    expect(matchLines("Ported from acmecorp's helpers.", ["acmecorp"])).toEqual([1])
  })

  it("reports every matching line, by 1-based number", () => {
    const text = ["one", "from acmecorp", "two", "acmecorp again"].join("\n")
    expect(matchLines(text, ["acmecorp"])).toEqual([2, 4])
  })

  it("does not match a name that is only a substring of a longer word", () => {
    expect(matchLines("prefixqxsuffix", ["qx"])).toEqual([])
    expect(matchLines("qxtra and extraqx too", ["qx"])).toEqual([])
  })

  it("is case-insensitive, so a capitalised mention is still caught", () => {
    // The leak this check exists to stop: an application named mid-sentence, capitalised because
    // it starts a sentence or is written as a title, would slip past a case-sensitive search.
    expect(matchLines("Acmecorp shipped this component.", ["acmecorp"])).toEqual([1])
    expect(matchLines("built on ACMECORP's platform", ["acmecorp"])).toEqual([1])
  })

  it("does not match a short name inside an unrelated hyphenated token", () => {
    // The real false positive this avoids: a short two-letter name must not match inside a
    // similarly-shaped locale tag such as "en-QX" — a hyphen counts as part of a word here, not as
    // a separator, so there is no boundary between "-" and "QX".
    expect(matchLines("toLocaleDateString('en-QX')", ["qx"])).toEqual([])
  })

  it("matches a hyphenated name as one whole word", () => {
    expect(matchLines("extracted from widget-tracker", ["widget-tracker"])).toEqual([1])
  })

  it("does not match a name glued to more hyphenated text on either side", () => {
    // Because a hyphen counts as a word character, "widget-tracker" does not match inside
    // "widget-tracker-labs" — the same rule that excludes "en-QX" above also excludes this.
    expect(matchLines("extracted from widget-tracker-labs", ["widget-tracker"])).toEqual([])
    expect(matchLines("extracted from acme-widget-tracker", ["widget-tracker"])).toEqual([])
  })

  it("matches any name out of several", () => {
    const text = ["from acmecorp", "from widgetco", "from neither"].join("\n")
    expect(matchLines(text, ["acmecorp", "widgetco"])).toEqual([1, 2])
  })

  it("finds nothing when the file contains none of the names", () => {
    expect(matchLines("nothing private here", ["acmecorp", "widgetco"])).toEqual([])
  })

  it("finds nothing for an empty name list, without throwing", () => {
    expect(matchLines("acmecorp", [])).toEqual([])
  })

  it("treats regex metacharacters in a name literally", () => {
    // A name containing regex-special characters must not be interpreted as a pattern.
    expect(matchLines("see widget.io for details", ["widget.io"])).toEqual([1])
    expect(matchLines("see widgetXio for details", ["widget.io"])).toEqual([])
  })
})

describe("wordBoundaryPattern", () => {
  it("requires a word boundary on both sides", () => {
    const pattern = wordBoundaryPattern(["qx"])
    expect(pattern.test("prefixqxsuffix")).toBe(false)
    expect(pattern.test("qx")).toBe(true)
    expect(pattern.test("the qx helpers")).toBe(true)
  })

  it("is case-insensitive", () => {
    const pattern = wordBoundaryPattern(["acme"])
    expect(pattern.test("Acme corp")).toBe(true)
    expect(pattern.test("acme corp")).toBe(true)
    expect(pattern.test("ACME corp")).toBe(true)
  })

  it("treats a hyphen as part of a word, not as a separator", () => {
    const pattern = wordBoundaryPattern(["qx"])
    // "-" sits right against "QX" on the left, so the boundary check must not treat it as a break.
    expect(pattern.test("en-QX")).toBe(false)

    const hyphenated = wordBoundaryPattern(["widget-tracker"])
    expect(hyphenated.test("used widget-tracker here")).toBe(true)
    expect(hyphenated.test("used widget-tracker-labs here")).toBe(false)
  })
})

describe("parseNames", () => {
  it("returns the names, one per non-blank non-comment line", () => {
    expect(parseNames("acmecorp\n\n# a comment\nwidgetco\n")).toEqual(["acmecorp", "widgetco"])
  })

  it("trims each name", () => {
    expect(parseNames("  acmecorp  \n")).toEqual(["acmecorp"])
  })

  it("fails loudly on empty text, rather than silently finding nothing to check", () => {
    expect(() => parseNames("")).toThrow(/no names/)
  })

  it("fails loudly on text that holds only comments and blank lines", () => {
    expect(() => parseNames("# nothing here\n\n# still nothing\n")).toThrow(/no names/)
  })
})

describe("readNames", () => {
  it("reads and parses a real file", async () => {
    // This test file is real and always present, so the happy path is proven with no fixture to
    // create — every non-comment, non-blank line of it is a "name", which is at least this file's
    // own imports.
    const names = await readNames(THIS_FILE)
    expect(names.length).toBeGreaterThan(0)
  })

  it("fails loudly, not with a raw stack trace, when the file does not exist", async () => {
    await expect(readNames(MISSING_PATH)).rejects.toThrow(/not found/)
  })
})

describe("parseDryRunFiles", () => {
  it("extracts every file:// path from dry-run output", () => {
    const output = [
      "Simulating publish of @scope/pkg@0.1.0 with files:",
      "   file:///repo/LICENSE (1.04KB)",
      "   file:///repo/pkg/README.md (1.28KB)",
      "Success Dry run complete",
    ].join("\n")
    expect(parseDryRunFiles(output)).toEqual(["/repo/LICENSE", "/repo/pkg/README.md"])
  })

  it("returns an empty list when the output names no files", () => {
    expect(parseDryRunFiles("Success Dry run complete")).toEqual([])
  })
})

describe("assertFilesFound", () => {
  it("does not throw when at least one file was found", () => {
    expect(() => assertFilesFound(["/repo/pkg/deno.json"], "pkg", "/repo/")).not.toThrow()
  })

  it("fails loudly, naming the package, when the dry run listed zero files", () => {
    expect(() => assertFilesFound([], "pkg", "/repo/")).toThrow(/pkg/)
    expect(() => assertFilesFound([], "pkg", "/repo/")).toThrow(/zero files/)
  })
})

describe("readAndMatch", () => {
  it("reads a real file and reports its matching lines", async () => {
    // Every import in this file names its module on its own line, so searching this very file for
    // its own literal import specifier is a real read, on a real file, with a known outcome —
    // with no fixture to create.
    expect(await readAndMatch(THIS_FILE, ["private-names.ts"])).not.toEqual([])
  })

  it("fails loudly, naming the path, on a read error that is not a missing text file", async () => {
    // A directory is readable as an entry but not as text — the same shape of failure as a
    // permission error or a file removed after the dry run listed it. None of these are "not a
    // text file, skip it": they are reasons to distrust the whole run. Its own directory (this
    // file's parent) always exists, so this needs no fixture either.
    const thisDir = fromFileUrl(new URL(".", import.meta.url))
    await expect(readAndMatch(thisDir, ["acmecorp"])).rejects.toThrow(
      new RegExp(thisDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )
  })

  it("fails loudly on a missing file too, the same as readNames does", async () => {
    await expect(readAndMatch(MISSING_PATH, ["acmecorp"])).rejects.toThrow(/could not read/)
  })
})

describe("PUBLISHED_PACKAGES", () => {
  it("lists every top-level directory whose deno.json names a package", () => {
    const root = fromFileUrl(new URL("../../", import.meta.url))
    const named: string[] = []
    for (const entry of Deno.readDirSync(root)) {
      if (!entry.isDirectory) continue
      let text: string
      try {
        text = Deno.readTextFileSync(join(root, entry.name, "deno.json"))
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) continue
        throw error
      }
      // Some package configs carry comments, so this reads the one field instead of parsing JSON.
      if (/^\s*"name"\s*:/m.test(text)) named.push(entry.name)
    }
    expect(named.length).toBeGreaterThan(0)
    expect([...PUBLISHED_PACKAGES].sort()).toEqual(named.sort())
  })
})
