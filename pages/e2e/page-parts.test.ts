import { assertEquals, assertThrows } from "@std/assert"
import { demoRegistry, guidePages } from "@spy4x/preact-ui-guide/registry"
import {
  type DrawnSection,
  type KnownCount,
  type PagePart,
  partGaps,
  partSelectors,
  restExcludes,
  restKnown,
} from "./page-parts.ts"
import { CONTRAST_PARTS } from "./ui-guide-parts.ts"

const drawn: readonly DrawnSection[] = [
  { id: "a", cards: ["A1", "A2", "A3"] },
  { id: "b", cards: ["B1"] },
]

Deno.test("every page's contrast parts name what the page draws, each section and card in one part", () => {
  for (const page of guidePages) {
    const parts = CONTRAST_PARTS[page.id]
    if (!parts) continue
    // The page draws a card only for a name the registry has a demo for (`shell.tsx`).
    const sections = page.sections.map((section) => ({
      id: section.id,
      cards: section.names.filter((name) => name in demoRegistry),
    }))
    assertEquals(partGaps(sections, parts), [], page.id)
  }
})

Deno.test("a section or card in two parts is reported", () => {
  assertEquals(
    partGaps(drawn, [
      { what: "one", sections: ["a"] },
      { what: "two", cards: { section: "a", from: "A3" } },
      { what: "three", sections: ["b"] },
      { what: "four", sections: ["b"] },
    ]),
    [
      `card A3 is in "one" and in "two"`,
      `section b is in "three" and in "four"`,
      `card B1 is in "three" and in "four"`,
    ],
  )
  assertEquals(
    partGaps(drawn, [
      { what: "head", cards: { section: "a", before: "A3" } },
      { what: "tail", cards: { section: "a", from: "A2" } },
    ]),
    [`card A2 is in "head" and in "tail"`],
  )
})

Deno.test("a part naming a section, or card, the page does not draw is reported", () => {
  assertEquals(
    partGaps(drawn, [
      { what: "gone", sections: ["c"] },
      { what: "renamed", cards: { section: "a", from: "A9" } },
      { what: "empty", cards: { section: "a", from: "A2", before: "A2" } },
    ]),
    [
      `"gone" names the section c, which the page does not draw`,
      `"renamed" names the card A9, which a does not draw`,
      `"empty" runs from A2 to before A2: no card`,
    ],
  )
})

Deno.test("runs of one section's cards that meet are not reported as overlapping", () => {
  assertEquals(
    partGaps(drawn, [
      { what: "head", cards: { section: "a", before: "A2" } },
      { what: "tail", cards: { section: "a", from: "A2" } },
    ]),
    [],
  )
})

Deno.test("the rest of the page leaves out exactly what the parts scan", () => {
  const parts: PagePart[] = [
    { what: "head", cards: { section: "a", before: "A2" } },
    { what: "tail", cards: { section: "a", from: "A2" } },
    { what: "b", sections: ["b"] },
  ]
  assertEquals(partSelectors(parts[0]), [`#a > div > article:has(~ #demo-A2)`])
  assertEquals(partSelectors(parts[1]), [`#demo-A2`, `#demo-A2 ~ article`])
  assertEquals(restExcludes(parts), parts.flatMap(partSelectors))
})

Deno.test("the rest of the page keeps the known counts the parts do not take, so the totals hold", () => {
  const page: Record<string, KnownCount> = {
    "color-contrast": [3, 1],
    "color-contrast: nonBmp": [9, 9],
  }
  const parts: PagePart[] = [
    { what: "one", known: { "color-contrast": [1, 0] } },
    { what: "two", known: { "color-contrast": [2, 1], "color-contrast: nonBmp": [3, 3] } },
  ]
  assertEquals(restKnown(page, parts), {
    "color-contrast": [0, 0],
    "color-contrast: nonBmp": [6, 6],
  })
  assertEquals(page["color-contrast"], [3, 1])
  assertThrows(
    () => restKnown(page, [...parts, { what: "three", known: { "color-contrast": [1, 0] } }]),
    Error,
    `the parts take more "color-contrast"`,
  )
})
