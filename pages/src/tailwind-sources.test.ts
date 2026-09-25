/**
 * `@source` normalisation.
 *
 * This is the one piece of the build with logic that a browser check cannot reach: Tailwind hands
 * back the directive as written, and its scanner silently finds nothing when the pattern walks up
 * more than one directory — which is what every source in this demo does. The first build of this
 * page shipped 0 candidates for exactly that reason, so the rewrite is pinned down here.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { packageIds } from "@spy4x/preact-ui-guide/registry"
import { normalizeSource, normalizeSources } from "./tailwind-sources.ts"

describe("normalizeSource", () => {
  it("turns a directory source into an absolute base", () => {
    expect(normalizeSource({ base: "/repo/pages/", pattern: "../ui", negated: false })).toEqual({
      base: "/repo/ui",
      pattern: "**/*",
      negated: false,
    })
  })

  it("walks up more than one directory", () => {
    // The demo sits at `<repo>/pages/`, so this is the shape a source two levels up arrives in.
    expect(
      normalizeSource({ base: "/repo/apps/demo/", pattern: "../../icons", negated: false }).base,
    )
      .toBe("/repo/icons")
  })

  it("resolves only the directory part of a glob", () => {
    expect(normalizeSource({ base: "/repo/pages/", pattern: "../src/**/*.tsx", negated: false }))
      .toEqual({ base: "/repo/src", pattern: "**/*.tsx", negated: false })
  })

  it("leaves a glob with no directory alone", () => {
    expect(normalizeSource({ base: "/repo/pages/", pattern: "**/*.{ts,tsx}", negated: false }))
      .toEqual({ base: "/repo/pages/", pattern: "**/*.{ts,tsx}", negated: false })
  })

  it("keeps the entry's negated flag", () => {
    expect(normalizeSource({ base: "/repo/", pattern: "./dist", negated: true }).negated).toBe(true)
  })
})

describe("normalizeSources", () => {
  it("rewrites every entry, in order", () => {
    expect(
      normalizeSources([
        { base: "/repo/pages/", pattern: "../ui", negated: false },
        { base: "/repo/pages/", pattern: "./src", negated: false },
      ]).map((entry) => entry.base),
    ).toEqual(["/repo/ui", "/repo/pages/src"])
  })
})

describe("styles.css", () => {
  it("scans every package the catalogue draws components from", async () => {
    // A section whose package is not scanned renders unstyled: the markup is right and the classes
    // are silently absent from the emitted CSS. Read from the stylesheet itself rather than from a
    // list here, so adding a package to the registry fails until it is scanned too.
    const stylesheet = await Deno.readTextFile(new URL("../styles.css", import.meta.url))

    expect(packageIds.length).toBeGreaterThan(0)
    for (const id of packageIds) {
      expect(stylesheet, id).toContain(`@source "../${id}"`)
    }
  })
})
