import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { MARKER_DOT_CLASSES, mountLeafletMap, STATUS_WRAPPER_CLASS } from "./leaflet-map.ts"
import type { MapMarkerStatus } from "./types.ts"

/**
 * Most of `leaflet-map.ts` needs `document`, which this repository's test runner does not provide —
 * every suite `deno task test` runs renders to a string, never a DOM (see `AGENTS.md`). What that
 * part builds is proven in `pages/checks/map.ts`, in a real browser. This file covers what does not
 * need a DOM: the status → class lookup, the dot's own utility classes — both `leaflet-map.ts`'s
 * marker icon and `marker-list.tsx`'s list row read from them — and `mountLeafletMap`'s failure path,
 * which is deliberately the one part of this module's imperative half that a fake `load` can drive
 * with no browser at all, since it returns before touching `document`.
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

describe("mountLeafletMap", () => {
  it("reports a failed load through onLoadError instead of throwing", async () => {
    const error = new Error("network blip")
    const errors: unknown[] = []

    const handle = await mountLeafletMap(
      () => Promise.reject(error),
      // Never reached on the failure path — createLeafletMap, the one call that would touch it, is
      // never called when `load` rejects.
      {} as HTMLElement,
      "https://tiles.example.com/{z}/{x}/{y}.png",
      { lat: 0, lng: 0 },
      3,
      { zoomInLabel: "Zoom in", zoomOutLabel: "Zoom out" },
      (reportedError) => errors.push(reportedError),
    )

    expect(handle).toBeUndefined()
    expect(errors).toEqual([error])
  })

  it("calls onLoadError exactly once for one failed load", async () => {
    const errors: unknown[] = []

    await mountLeafletMap(
      () => Promise.reject(new Error("fails once")),
      {} as HTMLElement,
      "https://tiles.example.com/{z}/{x}/{y}.png",
      { lat: 0, lng: 0 },
      3,
      { zoomInLabel: "Zoom in", zoomOutLabel: "Zoom out" },
      (reportedError) => errors.push(reportedError),
    )

    expect(errors.length).toBe(1)
  })
})
