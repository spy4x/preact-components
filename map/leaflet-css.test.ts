import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { leafletStylesheet } from "./leaflet-css.ts"

describe("leafletStylesheet", () => {
  it("reads the real leaflet.css this package pins, not a copy of it", async () => {
    const css = await leafletStylesheet()

    // Leaflet's own container rule — distinctive enough that a stub or an empty string could not
    // produce it by accident.
    expect(css).toContain(".leaflet-container")
    expect(css).toContain("overflow: hidden")
    expect(css.length).toBeGreaterThan(5_000)
  })
})
