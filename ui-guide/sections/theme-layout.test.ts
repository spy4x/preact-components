import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry, pageOfSection } from "../registry.ts"

describe("the Theme page", () => {
  it("says for every card whether it is wide", () => {
    // A card that leaves `wide` out falls back to the grid's guess, which can leave a hole.
    const names = catalogueSections
      .filter((section) => pageOfSection(section) === "theme")
      .flatMap((section) => section.names)
    expect(names.length).toBeGreaterThan(0)
    const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
    expect(unsaid).toEqual([])
  })
})
