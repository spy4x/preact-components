import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { MARKER_DOT_CLASSES, STATUS_WRAPPER_CLASS } from "./leaflet-map.ts"
import type { MapMarkerStatus } from "./types.ts"

/**
 * `leaflet-map.ts`'s own functions all need `document`, which this repository's test runner does not
 * provide — every suite `deno task test` runs renders to a string, never a DOM (see `AGENTS.md`). What
 * they build is proven in `pages/checks/map.ts`, in a real browser. This file covers the one part of
 * that module that is plain data: the status → class lookup and the dot's own utility classes, which
 * both `leaflet-map.ts`'s marker icon and `marker-list.tsx`'s list row read from.
 */
describe("STATUS_WRAPPER_CLASS", () => {
  it("names a wrapper class for every MapMarkerStatus", () => {
    const statuses: MapMarkerStatus[] = ["on", "off", "unknown"]
    for (const status of statuses) {
      expect(STATUS_WRAPPER_CLASS[status]).toBe(`status-${status}`)
    }
  })

  it("matches the status classes theme/preset.css defines", async () => {
    const preset = await Deno.readTextFile(new URL("../theme/preset.css", import.meta.url))
    for (const className of Object.values(STATUS_WRAPPER_CLASS)) {
      expect(preset, `.${className} is not defined in theme/preset.css`).toContain(`.${className} `)
    }
  })
})

describe("MARKER_DOT_CLASSES", () => {
  it("carries the theme's map-marker class", () => {
    expect(MARKER_DOT_CLASSES.split(" ")).toContain("map-marker")
  })

  it("gives the dot a shape theme/preset.css does not: map-marker alone sets no size or radius", () => {
    expect(MARKER_DOT_CLASSES).toContain("rounded-full")
    expect(MARKER_DOT_CLASSES).toContain("size-4")
  })
})
