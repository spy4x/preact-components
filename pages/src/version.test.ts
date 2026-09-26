import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { packageVersion } from "./version.ts"

describe("packageVersion", () => {
  it("reads the version out of a deno.json that carries comments", () => {
    const config =
      `{\n  // the package\n  "name": "@spy4x/preact-ui-guide",\n  "version": "0.1.2",\n}`
    expect(packageVersion(config)).toBe("0.1.2")
  })

  it("throws when the config declares no version", () => {
    expect(() => packageVersion(`{ "name": "@spy4x/preact-ui-guide" }`)).toThrow(`no "version"`)
  })
})
