import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import * as ui from "@preact-components/ui"
import {
  catalogueSections,
  componentNames,
  demoRegistry,
  HELPER_EXPORTS,
  helperExportNames,
  missingDemos,
  registryDrift,
  sectionInfo,
} from "./registry.ts"

/**
 * A copy of the registry with one entry removed.
 *
 * The shipped registry is total, so nothing in a healthy tree can produce a partial one — which is
 * exactly why the missing-demo path needs an input like this to be exercised rather than assumed.
 */
function without(name: keyof typeof demoRegistry): Partial<typeof demoRegistry> {
  const partial: Partial<typeof demoRegistry> = { ...demoRegistry }
  delete partial[name]
  return partial
}

describe("demo registry", () => {
  it("accounts for every value the ui package exports", () => {
    // Derived on both sides from the module namespace, never from a hand-kept list, so an export
    // that is neither a demo nor a declared helper fails here — and in the type guard above.
    const accounted = [...componentNames, ...helperExportNames].sort()
    expect(accounted).toEqual(Object.keys(ui).sort())
  })

  it("declares no helper export that the ui package does not export", () => {
    expect(helperExportNames).toEqual(HELPER_EXPORTS.filter((name) => name in ui))
    expect(helperExportNames.length).toBe(HELPER_EXPORTS.length)
  })

  it("keeps the compile-time drift guard green", () => {
    // `registryDrift` is typed `DriftReport`, which collapses to `true` only while the sections
    // cover `keyof typeof ui` exactly. A rename, a removal or a missing demo fails `deno check`
    // before this runs; this is the assertion that the type resolved the way it reads.
    expect(registryDrift).toBe(true)
  })

  it("registers exactly one demo per exported component", () => {
    expect(Object.keys(demoRegistry).sort()).toEqual([...componentNames].sort())
    expect(Object.keys(demoRegistry).length).toBe(componentNames.length)
  })

  it("registers no demo for a name the ui package does not export", () => {
    for (const name of Object.keys(demoRegistry)) {
      expect(name in ui, name).toBe(true)
    }
  })

  it("gives every demo a summary, a snippet and a render function", () => {
    for (const [name, demo] of Object.entries(demoRegistry)) {
      expect(demo.summary.length, name).toBeGreaterThan(10)
      expect(demo.snippet, name).toContain("<")
      expect(typeof demo.render, name).toBe("function")
    }
  })

  it("groups every component into exactly one section", () => {
    const grouped = catalogueSections.flatMap((section) => section.names)

    expect(new Set(grouped).size, "a component appears in two sections").toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...componentNames].sort())
  })

  it("gives every section a heading, a blurb and at least one demo", () => {
    expect(catalogueSections.length).toBeGreaterThan(0)
    for (const section of catalogueSections) {
      expect(Object.keys(sectionInfo), section.id).toContain(section.id)
      expect(section.title.length, section.id).toBeGreaterThan(0)
      expect(section.blurb.length, section.id).toBeGreaterThan(10)
      expect(section.names.length, section.id).toBeGreaterThan(0)
    }
  })

  it("reports nothing for the complete registry", () => {
    expect(missingDemos(demoRegistry)).toEqual([])
  })

  it("reports a component whose demo is missing", () => {
    expect(missingDemos(without("ToggleSwitch"))).toEqual(["ToggleSwitch"])
  })

  it("reports every missing component, in module order", () => {
    const partial = without("Badge")
    delete partial.Toastr

    // `componentNames` is module order, so the report is stable rather than registration order.
    const expected = componentNames.filter((name) => name === "Badge" || name === "Toastr")
    expect(missingDemos(partial)).toEqual(expected)
    expect(expected.length).toBe(2)
  })
})
