import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry, pageOfSection } from "../registry.ts"

/** Every card name on one guide page, in section order. */
function cardsOn(page: string): string[] {
  return catalogueSections
    .filter((section) => pageOfSection(section) === page)
    .flatMap((section) => section.names)
}

for (const page of ["signals", "cn"]) {
  describe(`the ${page} page`, () => {
    it("says for every card whether it is wide", () => {
      // A card that leaves `wide` out falls back to the grid's guess.
      const names = cardsOn(page)
      expect(names.length).toBeGreaterThan(0)
      const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
      expect(unsaid).toEqual([])
    })

    it("prints no literal backtick in a card's sentence", () => {
      // A code name in a sentence is a backtick pair, which the card turns into code. An odd count
      // leaves one on the page.
      const odd = cardsOn(page).filter((name) =>
        ((demoRegistry[name]?.summary ?? "").match(/`/g)?.length ?? 0) % 2 === 1
      )
      expect(odd).toEqual([])
    })
  })
}
