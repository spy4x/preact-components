import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { readConfig } from "../../infra/scripts/workspace.ts"
import { guideVersion, packageVersion } from "./version.ts"

describe("packageVersion", () => {
  it("reads the version out of a parsed config", () => {
    expect(packageVersion({ name: "@spy4x/preact-ui-guide", version: "0.1.2" })).toBe("0.1.2")
  })

  it("throws when the config declares no version", () => {
    expect(() => packageVersion({ name: "@spy4x/preact-ui-guide" })).toThrow(`no "version"`)
  })
})

describe("guideVersion", () => {
  it("is the version ui-guide/deno.json declares", async () => {
    const config = await readConfig(new URL("../../ui-guide/deno.json", import.meta.url))
    expect(await guideVersion()).toBe(config.version)
  })
})
