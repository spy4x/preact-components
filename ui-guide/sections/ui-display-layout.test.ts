import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry } from "../registry.ts"

/** The UI page's sections this file holds to the card design; the other half has its own test. */
const SECTIONS = ["badges", "buttons", "layout", "display", "feedback"]

describe("the UI page's display sections", () => {
  it("says for every card whether it is wide", () => {
    // A card that leaves `wide` out falls back to the grid's guess, which is how holes came back.
    const names = catalogueSections
      .filter((section) => SECTIONS.includes(section.id))
      .flatMap((section) => section.names)
    expect(names.length).toBeGreaterThan(0)
    const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
    expect(unsaid).toEqual([])
  })

  it("keeps every summary to one sentence with no issue number", () => {
    const names = catalogueSections
      .filter((section) => SECTIONS.includes(section.id))
      .flatMap((section) => section.names)
    const long = names.filter((name) => {
      const summary = demoRegistry[name]?.summary ?? ""
      return /#\d/.test(summary) || /[.!?]\s+\S/.test(summary.trim())
    })
    expect(long).toEqual([])
  })
})
