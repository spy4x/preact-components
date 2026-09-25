import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  leafletFromImport,
  type LeafletModule,
  MARKER_DOT_CLASSES,
  mountLeafletMap,
  STATUS_WRAPPER_CLASS,
} from "./leaflet-map.ts"
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

/** A minimal stand-in for the real `leaflet` module — just enough of its surface for
 * `mountLeafletMap`'s tests below, which only ever need to know whether `L.map` was reached, never
 * to build a real map. Cast rather than genuinely typed as `LeafletModule`, the same way a fake
 * `container` is: this file has no `document`, so nothing past `L.map` itself could work anyway
 * (see this file's own doc). */
function fakeLeafletModule(map: (...args: unknown[]) => unknown): LeafletModule {
  return { map } as unknown as LeafletModule
}

describe("leafletFromImport", () => {
  it("returns the namespace when the import resolved to it", () => {
    const namespace = { map: () => {} } as unknown as LeafletModule
    expect(leafletFromImport(namespace)).toBe(namespace)
  })

  it("unwraps the namespace when the import resolved to { default: L }", () => {
    const namespace = { map: () => {} } as unknown as LeafletModule
    expect(leafletFromImport({ default: namespace })).toBe(namespace)
  })

  it("throws a named error when the import resolved to neither shape", () => {
    const shape = /neither the Leaflet namespace nor \{ default: Leaflet \}/
    expect(() => leafletFromImport({} as unknown as LeafletModule)).toThrow(shape)
    expect(() => leafletFromImport({ default: {} } as unknown as { default: LeafletModule }))
      .toThrow(shape)
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
      () => false,
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
      () => false,
    )

    expect(errors.length).toBe(1)
  })

  it("never calls L.map once the caller has already cancelled, even though load succeeded", async () => {
    // The regression this guards: an earlier version built the map first and only checked
    // cancellation in the caller's own .then(), so a component that unmounted while load() was
    // still in flight still got a complete map built into its detached container, then immediately
    // torn down. Checking before L.map runs is what actually skips that work.
    const mapCalls: unknown[] = []
    const L = fakeLeafletModule((...args) => {
      mapCalls.push(args)
      return { setView() {}, remove() {} }
    })

    const handle = await mountLeafletMap(
      () => Promise.resolve(L),
      {} as HTMLElement,
      "https://tiles.example.com/{z}/{x}/{y}.png",
      { lat: 0, lng: 0 },
      3,
      { zoomInLabel: "Zoom in", zoomOutLabel: "Zoom out" },
      () => {
        throw new Error("onLoadError must not be called for a load that succeeded")
      },
      // Already cancelled by the time load() resolves — the exact shape of a component that
      // unmounted while the dynamic import was still in flight.
      () => true,
    )

    expect(handle).toBeUndefined()
    expect(mapCalls.length).toBe(0)
  })

  it("does not call onLoadError for a load that rejects after the caller has cancelled", async () => {
    const errors: unknown[] = []

    const handle = await mountLeafletMap(
      () => Promise.reject(new Error("rejects after unmount")),
      {} as HTMLElement,
      "https://tiles.example.com/{z}/{x}/{y}.png",
      { lat: 0, lng: 0 },
      3,
      { zoomInLabel: "Zoom in", zoomOutLabel: "Zoom out" },
      (reportedError) => errors.push(reportedError),
      () => true,
    )

    expect(handle).toBeUndefined()
    expect(errors).toEqual([])
  })

  it("reports a throw from building the map through onLoadError, not as a rejected promise", async () => {
    const thrown = new Error("L.map threw")
    const errors: unknown[] = []
    const L = fakeLeafletModule(() => {
      throw thrown
    })

    const handle = await mountLeafletMap(
      () => Promise.resolve(L),
      {} as HTMLElement,
      "https://tiles.example.com/{z}/{x}/{y}.png",
      { lat: 0, lng: 0 },
      3,
      { zoomInLabel: "Zoom in", zoomOutLabel: "Zoom out" },
      (reportedError) => errors.push(reportedError),
      () => false,
    )

    expect(handle).toBeUndefined()
    expect(errors).toEqual([thrown])
  })
})
