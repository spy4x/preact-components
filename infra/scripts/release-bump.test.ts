import { expect } from "@std/expect"
import { parse } from "@std/jsonc"
import { describe, it } from "@std/testing/bdd"
import { PUBLISHED_PACKAGES } from "./private-names.ts"
import { plannedBumps, setVersion } from "./release-bump.ts"
import { checkReleaseTag } from "./release-tag.ts"
import { memberConfig } from "./workspace.ts"

const CONFIG = `{
  "name": "@spy4x/preact-cn",
  "version": "16.6.1",
  "exports": "./mod.ts"
}
`

describe("setVersion", () => {
  it("sets the new version and keeps every other byte", () => {
    expect(setVersion(CONFIG, "16.7.0")).toBe(CONFIG.replace(`"16.6.1"`, `"16.7.0"`))
  })

  it("refuses a version that is not a plain X.Y.Z", () => {
    for (const version of ["16.6", "v16.7.0", "16.7.0-beta.1", "16.07.0", "", "16.7.0 "]) {
      expect(() => setVersion(CONFIG, version)).toThrow("not a plain X.Y.Z")
    }
  })

  it("refuses a version not greater than the current one", () => {
    expect(() => setVersion(CONFIG, "16.6.1")).toThrow("not greater")
    expect(() => setVersion(CONFIG, "16.5.9")).toThrow("not greater")
  })

  it("refuses a config with no version line", () => {
    expect(() => setVersion(`{ "name": "@spy4x/preact-cn" }\n`, "16.7.0")).toThrow("found 0")
  })

  it("refuses a config with two version lines", () => {
    const twice = CONFIG.replace(`"exports"`, `"version": "16.6.1",\n  "exports"`)
    expect(() => setVersion(twice, "16.7.0")).toThrow("found 2")
  })
})

describe("plannedBumps", () => {
  it("rewrites the config of every published package, and only those", async () => {
    const planned = await plannedBumps("999.0.0")
    const expected = await Promise.all(PUBLISHED_PACKAGES.map((pkg) => memberConfig(pkg)))
    expect([...planned.keys()].map((url) => url.href)).toEqual(expected.map((url) => url.href))
    const versions = Object.fromEntries(
      PUBLISHED_PACKAGES.map((pkg, i) => [
        pkg,
        (parse([...planned.values()][i]) as { version?: string }).version,
      ]),
    )
    expect(checkReleaseTag("v999.0.0", versions)).toEqual([])
  })

  it("refuses a malformed version before naming any package", async () => {
    await expect(plannedBumps("16.6")).rejects.toThrow(/^"16\.6" is not a plain X\.Y\.Z/)
  })

  it("names the package whose config refuses the version", async () => {
    await expect(plannedBumps("0.0.1")).rejects.toThrow(`${PUBLISHED_PACKAGES[0]}/: `)
  })
})
