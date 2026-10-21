/**
 * Every guide snippet and props row names only props its component takes. This file runs `deno
 * doc`, so `deno task test` runs it in its own step with `--allow-run=deno`.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { denoDoc } from "../infra/scripts/llms-txt.ts"
import { entryPoints, memberConfig } from "../infra/scripts/workspace.ts"
import { isComponent, packageExports } from "./coverage.ts"
import { classDemoNames, demoRegistry, packageIds } from "./registry.ts"
import {
  type CardInput,
  declarationsByName,
  propNames,
  propsReport,
  rowNames,
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

/** Components whose props this reader cannot list in full, each with why. */
const OPEN_COMPONENTS: Record<string, string> = {
  FormatContext:
    "A Preact context: its card renders `FormatContext.Provider`, typed by Preact itself.",
}

/** Every declaration of the catalogued packages, read once with `deno doc`. */
async function declarations() {
  const files: URL[] = []
  for (const id of packageIds) {
    for (const { href } of await entryPoints(await memberConfig(id))) files.push(new URL(href))
  }
  // Preact's own types, so a props type that extends `JSX.ButtonHTMLAttributes` is read in full.
  // Its `exports` names no `.d.ts`, so the files are found beside its resolved `package.json`.
  const preact = new URL(import.meta.resolve("preact/package.json"))
  if (preact.protocol !== "file:") throw new Error(`preact resolved to ${preact.href}, not a file`)
  for (const types of ["src/index.d.ts", "src/jsx.d.ts"]) files.push(new URL(types, preact))
  return declarationsByName((await denoDoc(files)).values())
}

describe("guide snippets and props rows", () => {
  it("name only props their components take", async () => {
    const byName = await declarations()
    // What is a component is the catalogue's one rule, `isComponent`, over the exported values.
    const exports = await packageExports()
    const components = new Set(
      packageIds.flatMap((id) =>
        Object.entries(exports[id]).filter(([name, value]) => isComponent(name, value))
          .map(([name]) => name)
      ),
    )
    const report = propsReport(
      CARDS,
      (component) => components.has(component) ? propNames(component, byName) : undefined,
    )
    expect(report.problems).toEqual([])
    // Every card of a component is either checked or counted as open; none is skipped unseen.
    const seen = new Set([...report.checked, ...report.open])
    expect(CARDS.map(({ name }) => name).filter((name) => components.has(name) && !seen.has(name)))
      .toEqual([])
    // Every component whose props cannot be read in full is named here with why, so a new one
    // fails until someone looks at it.
    expect(report.open).toEqual(Object.keys(OPEN_COMPONENTS))
    for (const name of ["Badge", "Button", "Card", "Input", "Checkbox", "TextField"]) {
      expect(report.checked).toContain(name)
    }
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
        snippet: `<Badge text="paid" colour="green" key="a" data-x="1" />`,
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

describe("rowNames", () => {
  it("reads several names, a field's prop, and no name from a pattern", () => {
    expect(rowNames("busy / busyLabel")).toEqual(["busy", "busyLabel"])
    expect(rowNames("images[].webpSrc")).toEqual(["images"])
    expect(rowNames("data-*, id, …")).toEqual(["id"])
  })
})

describe("propNames", () => {
  /** Declarations as `deno doc` writes them, for a function, a `const` and an overloaded `const`. */
  const byName = declarationsByName([[
    {
      name: "Plain",
      declarations: [{ kind: "function", def: { params: [{ tsType: ref("PlainProps") }] } }],
    },
    { name: "PlainProps", declarations: [iface(["text"])] },
    {
      name: "Arrow",
      declarations: [{
        kind: "variable",
        def: {
          tsType: { kind: "fnOrConstructor", value: { params: [{ tsType: ref("PlainProps") }] } },
        },
      }],
    },
    { name: "Overloaded", declarations: [{ kind: "variable", def: { tsType: ref("Overloads") } }] },
    {
      name: "Overloads",
      declarations: [{
        kind: "interface",
        def: {
          callSignatures: [{ params: [{ tsType: ref("PlainProps") }] }, {
            params: [{ tsType: ref("LinkProps") }],
          }],
        },
      }],
    },
    { name: "LinkProps", declarations: [iface(["href"])] },
    {
      name: "NS",
      declarations: [{
        kind: "namespace",
        def: { elements: [{ name: "Inner", declarations: [iface(["inner"])] }] },
      }],
    },
    {
      name: "Wide",
      declarations: [{ kind: "function", def: { params: [{ tsType: ref("NS.Inner") }] } }],
    },
  ] as never])

  function ref(typeName: string) {
    return { kind: "typeRef", value: { typeName, resolution: { kind: "import", specifier: "x" } } }
  }
  function iface(names: string[]) {
    return { kind: "interface", def: { properties: names.map((name) => ({ name })) } }
  }

  it("reads a function, a const of a function type and every call signature of an overloaded const", () => {
    expect(propNames("Plain", byName)).toEqual(new Set(["text"]))
    expect(propNames("Arrow", byName)).toEqual(new Set(["text"]))
    expect(propNames("Overloaded", byName)).toEqual(new Set(["text", "href"]))
  })

  it("reads a namespace member by its qualified name", () => {
    expect(propNames("Wide", byName)).toEqual(new Set(["inner"]))
  })

  it("calls a name with no declaration open, not empty", () => {
    expect(propNames("Missing", byName)).toBeNull()
  })
})
