import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { checkReleaseTag, readVersion } from "./release-tag.ts"

describe("checkReleaseTag", () => {
  it("accepts a tag that is v plus every package's version", () => {
    expect(checkReleaseTag("v0.1.0", { cn: "0.1.0", ui: "0.1.0" })).toEqual([])
  })

  it("refuses a tag pushed without the version bump", () => {
    expect(checkReleaseTag("v0.1.1", { cn: "0.1.0", ui: "0.1.0" })).toHaveLength(2)
  })

  it("names the one package a bump missed", () => {
    expect(checkReleaseTag("v0.1.1", { cn: "0.1.1", ui: "0.1.0" })).toEqual([
      "ui is at 0.1.0, but the tag is v0.1.1.",
    ])
  })

  it("refuses a tag without the v prefix", () => {
    expect(checkReleaseTag("0.1.0", { cn: "0.1.0" })).toHaveLength(1)
  })

  it("refuses a build that has no tag", () => {
    expect(checkReleaseTag(undefined, { cn: "0.1.0" })).toHaveLength(1)
    expect(checkReleaseTag("", { cn: "0.1.0" })).toHaveLength(1)
  })

  it("refuses a package with no version, and an empty package list", () => {
    expect(checkReleaseTag("v0.1.0", { cn: undefined })).toEqual(["cn declares no version."])
    expect(checkReleaseTag("v0.1.0", {})).toEqual(["No published package was found."])
  })
})

describe("readVersion", () => {
  it("reads the version from a config with comments", () => {
    expect(readVersion(`{\n  // note\n  "name": "@x/y",\n  "version": "1.2.3"\n}`)).toBe("1.2.3")
  })

  it("returns undefined when there is no version field", () => {
    expect(readVersion(`{ "name": "@x/y" }`)).toBeUndefined()
  })
})
