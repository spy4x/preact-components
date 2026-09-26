import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry, pageOfSection } from "../registry.ts"
import { cardSpans } from "../shell.tsx"

/** The System page's sections, in page order. */
const sections = catalogueSections.filter((section) => pageOfSection(section) === "system")

describe("the System page", () => {
  it("says for every card whether it is wide", () => {
    // A card that leaves `wide` out falls back to the grid's guess, which can leave a hole.
    const names = sections.flatMap((section) => section.names)
    expect(names.length).toBeGreaterThan(0)
    const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
    expect(unsaid).toEqual([])
  })

  it("pairs every normal card with a neighbour, so none is stretched across a whole row", () => {
    // The grid widens the last card of an odd run of normal cards. That fills the hole, but the
    // card then stands alone on a row it was not laid out for, so this page orders its cards so it
    // never happens.
    const stretched = sections.flatMap((section) => {
      const demos = section.names.map((name) => demoRegistry[name])
      const spans = cardSpans(demos)
      return section.names.filter((_name, index) =>
        demos[index].wide === false && spans[index] === "full"
      )
    })
    expect(stretched).toEqual([])
  })
})
