import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  buildEntries,
  declarationIndex,
  type DocEntryPoint,
  firstSentence,
  generate,
  kindOf,
  packageDescription,
  readmeSummary,
} from "./llms-txt.ts"

const ROOT = new URL("../../", import.meta.url)
const COMMAND = "deno task llms"

describe("llms.txt and llms-full.txt", () => {
  it("match what the generator writes", async () => {
    const generated = await generate()
    const llms = await Deno.readTextFile(new URL("llms.txt", ROOT)).catch(() => "")
    const full = await Deno.readTextFile(new URL("llms-full.txt", ROOT)).catch(() => "")
    expect(llms === generated.llms, `llms.txt is out of date: run \`${COMMAND}\``).toBe(true)
    expect(full === generated.full, `llms-full.txt is out of date: run \`${COMMAND}\``).toBe(true)
  })

  it("list a package, an export and its import specifier", async () => {
    const { llms, full } = await generate()
    expect(llms).toContain("## @spy4x/preact-ui")
    expect(llms).toContain("Install: `deno add jsr:@spy4x/preact-ui`")
    expect(llms).toMatch(/^- `Badge` \(component\): .+ Import: `@spy4x\/preact-ui`$/m)
    expect(llms).toContain("deno doc jsr:@spy4x/preact-<package>")
    expect(full).toContain("## Components")
  })
})

describe("firstSentence", () => {
  it("turns an inline link into the linked name", () => {
    expect(firstSentence("Options for {@link preactThemeCss}. More.")).toBe(
      "Options for `preactThemeCss`.",
    )
  })

  it("joins the lines of the first sentence and drops the rest", () => {
    expect(firstSentence("Adds two numbers\nacross lines. Second one.")).toBe(
      "Adds two numbers across lines.",
    )
  })
})

describe("readmeSummary", () => {
  const readme = [
    "| Export | What it is |",
    "| --- | --- |",
    "| `Widget` | Draws a widget. Second sentence. |",
    "",
    "| Before | Now |",
    "| --- | --- |",
    "| `oldTicks` | `yTicks`, `yFormat` |",
    "",
    "| Component | Subpath | Ports / key props |",
    "| --- | --- | --- |",
    "| `Calendar` | `calendar` | `value`, `onSelect` |",
  ].join("\n")

  it("reads the cell under a description column", () => {
    expect(readmeSummary(readme, "Widget")).toBe("Draws a widget.")
  })

  it("writes nothing for a migration table", () => {
    expect(readmeSummary(readme, "oldTicks")).toBe("")
  })

  it("writes nothing for a props column", () => {
    expect(readmeSummary(readme, "Calendar")).toBe("")
  })
})

describe("kindOf", () => {
  it("names the five kinds", () => {
    expect(kindOf("Props", "interface")).toBe("type")
    expect(kindOf("Alias", "typeAlias")).toBe("type")
    expect(kindOf("useThing", "function")).toBe("hook")
    expect(kindOf("Button", "function")).toBe("component")
    expect(kindOf("DEFAULT_COLOR", "variable")).toBe("constant")
    expect(kindOf("clamp", "function")).toBe("helper")
    expect(kindOf("VersionError", "class")).toBe("helper")
  })
})

describe("packageDescription", () => {
  it("skips the title and returns the first paragraph on one line", () => {
    expect(packageDescription("# Title\n\nOne thing,\nnot two.\n\nOther.")).toBe(
      "One thing, not two.",
    )
  })
})

describe("buildEntries", () => {
  const TARGET = "file:///other/input.tsx"

  /** This package: re-exports a type another package declares, and declares two names itself. */
  const fixture = (): DocEntryPoint[] => [
    {
      specifier: "@spy4x/pkg",
      symbols: [
        {
          name: "SelectOption",
          declarations: [{ kind: "reference", def: { target: { filename: TARGET } } }],
        },
        {
          name: "niceStep",
          declarations: [{ kind: "function", jsDoc: { doc: "Rounds a step." } }],
        },
        { name: "Thing", declarations: [{ kind: "function" }] },
      ],
    },
  ]

  /** The other package's symbols, where the type is declared. */
  const index = () =>
    declarationIndex([[{
      name: "SelectOption",
      declarations: [{
        kind: "interface",
        declarationKind: "export",
        location: { filename: TARGET },
        jsDoc: { doc: "One option. More text." },
      }],
    }]])

  it("lists a re-exported type with the kind and JSDoc of its declaration", () => {
    const entries = buildEntries(fixture(), ["niceStep", "Thing"], "", "@spy4x/pkg", index())
    expect(entries.find((entry) => entry.name === "SelectOption")).toEqual({
      name: "SelectOption",
      kind: "type",
      summary: "One option.",
      specifier: "@spy4x/pkg",
    })
  })

  it("leaves the summary empty rather than take a wrong README line", () => {
    const readme = "| Before | Now |\n| --- | --- |\n| `Thing` | `a`, `b` |"
    const entries = buildEntries(fixture(), ["Thing"], readme, "@spy4x/pkg", index())
    expect(entries.find((entry) => entry.name === "Thing")?.summary).toBe("")
  })

  it("throws for a value export that has no declaration", () => {
    expect(() => buildEntries(fixture(), ["Missing"], "", "@spy4x/pkg", index())).toThrow(
      /exports `Missing`/,
    )
  })
})
