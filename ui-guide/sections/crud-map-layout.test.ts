import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry, pageOfSection } from "../registry.ts"

/** The names of every card, component or example, on one guide page. */
function cardsOf(page: string): string[] {
  return catalogueSections
    .filter((section) => pageOfSection(section) === page)
    .flatMap((section) => section.names)
}

for (const page of ["crud", "map"]) {
  describe(`the ${page} page`, () => {
    it("says for every card whether it is wide", () => {
      // A card that leaves `wide` out falls back to the grid's guess, which is what left holes.
      const names = cardsOf(page)
      expect(names.length).toBeGreaterThan(0)
      const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
      expect(unsaid).toEqual([])
    })

    it("prints no literal backtick in a card's sentence or its props' sentences", () => {
      // Inline Markdown turns a backtick pair into code; an odd count leaves one on the page.
      const texts = cardsOf(page).flatMap((name) => [
        [name, demoRegistry[name]?.summary ?? ""],
        ...(demoRegistry[name]?.props ?? []).map((
          prop,
        ) => [`${name}.${prop.name}`, prop.description]),
      ])
      const odd = texts
        .filter(([, text]) => (text.match(/`/g)?.length ?? 0) % 2 !== 0)
        .map(([where]) => where)
      expect(odd).toEqual([])
    })
  })
}
