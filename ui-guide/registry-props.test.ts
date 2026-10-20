/**
 * Every guide snippet and props row names only props its component takes. This file runs `deno
 * doc`, so `deno task test` runs it in its own step with `--allow-run=deno`.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { denoDoc } from "../infra/scripts/llms-txt.ts"
import { entryPoints, memberConfig } from "../infra/scripts/workspace.ts"
import { classDemoNames, demoRegistry, packageIds } from "./registry.ts"
import {
  type CardInput,
  declarationsByName,
  propNames,
  propsReport,
  snippetTags,
} from "./registry-props.ts"

/** Every card of a component, with its snippet and the names of its props rows. */
const CARDS: CardInput[] = Object.entries(demoRegistry)
  .filter(([name]) => !(classDemoNames as readonly string[]).includes(name))
  .map(([name, demo]) => ({
    name,
    snippet: demo.snippet,
    propRows: (demo.props ?? []).map((prop) => prop.name),
  }))

/** Every declaration of the catalogued packages, read once with `deno doc`. */
async function declarations() {
  const files: URL[] = []
  for (const id of packageIds) {
    for (const { href } of await entryPoints(await memberConfig(id))) files.push(new URL(href))
  }
  return declarationsByName((await denoDoc(files)).values())
}

describe("guide snippets and props rows", () => {
  it("name only props their components take", async () => {
    const byName = await declarations()
    const report = propsReport(
      CARDS,
      (component) =>
        byName.get(component)?.some((declaration) => declaration.kind === "function")
          ? propNames(component, byName)
          : undefined,
    )
    expect(report.problems).toEqual([])
    // A reader that lists nothing would pass the line above for every card. Most components have
    // props this reader lists in full; fewer checked means the reader stopped reading them.
    expect(report.checked.length, `open: ${report.open.join(", ")}`).toBeGreaterThan(
      report.open.length,
    )
    expect(report.checked).toContain("Badge")
    expect(report.checked).toContain("TextField")
  })
})

describe("propsReport", () => {
  const props = (component: string) =>
    ({ Badge: new Set(["text", "color"]), Field: null } as Record<string, Set<string> | null>)[
      component
    ]

  it("names an attribute the component does not take, in the snippet and in a props row", () => {
    const report = propsReport([
      {
        name: "Badge",
        snippet: `<Badge text="paid" colour="green" key="a" />`,
        propRows: ["tint"],
      },
    ], props)
    expect(report.problems).toEqual([
      "Badge's snippet writes <Badge colour>, and Badge has no prop colour",
      "Badge's props table lists tint, and Badge has no prop tint",
    ])
  })

  it("skips an open component and a name that is no component, and counts both kinds", () => {
    const report = propsReport([
      {
        name: "Field",
        snippet: `<Field anything="x"><Helper what="y" /></Field>`,
        propRows: ["z"],
      },
    ], props)
    expect(report).toEqual({ problems: [], checked: [], open: ["Field"] })
  })
})

describe("snippetTags", () => {
  it("reads attributes past string, brace and nested JSX values, and nested tags on their own", () => {
    const snippet =
      `<Card title="a > b" onClose={() => close({ x: "}" })} footer={<Button size="sm" />}
  {...rest} wide>
  <Badge text="paid" />
</Card>`
    expect(snippetTags(snippet)).toEqual([
      { name: "Card", attributes: ["title", "onClose", "footer", "wide"] },
      { name: "Button", attributes: ["size"] },
      { name: "Badge", attributes: ["text"] },
    ])
  })
})
