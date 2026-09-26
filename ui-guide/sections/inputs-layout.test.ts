import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueSections, demoRegistry } from "../registry.ts"

/** The UI page's second half: the input sections. */
const SECTIONS = ["inputs", "fields", "enhanced-forms"]

const names = catalogueSections
  .filter((section) => SECTIONS.includes(section.id))
  .flatMap((section) => section.names)

describe("the UI page's input sections", () => {
  it("are all found", () => {
    const found = catalogueSections.filter((section) => SECTIONS.includes(section.id))
    expect(found.map((section) => section.id)).toEqual(SECTIONS)
    expect(names.length).toBeGreaterThan(0)
  })

  it("say for every card whether it is wide", () => {
    const unsaid = names.filter((name) => typeof demoRegistry[name]?.wide !== "boolean")
    expect(unsaid).toEqual([])
  })

  it("give every card a summary of one sentence, with no issue number", () => {
    // One sentence: it ends with a full stop and has no other full stop or semicolon, so a card's
    // text cannot grow back into a paragraph of implementation notes; an issue number is a review
    // note, not something a reader of the guide needs.
    const long = names.filter((name) => {
      const summary = demoRegistry[name]?.summary ?? ""
      return !summary.endsWith(".") || /[.!?;]\s/.test(summary.slice(0, -1)) ||
        /#\d/.test(summary)
    })
    expect(long).toEqual([])
  })
})
