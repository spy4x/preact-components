import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  buildEntries,
  declarationIndex,
  deprecatedSummary,
  describesParameters,
  type DocEntryPoint,
  type Entry,
  exportLine,
  exportLines,
  FINGERPRINT_PREFIX,
  firstSentence,
  generate,
  HEADER,
  kindOf,
  linesFingerprint,
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

  it("list an export as four tab-separated fields and keep the READMEs in the full file", async () => {
    const { llms, full } = await generate()
    expect(llms).toMatch(/^Badge\tcomponent\t@spy4x\/preact-ui\t\S.+$/m)
    expect(full).toContain("## Components")
  })

  it("start llms.txt with the header and give every other line exactly three tabs", async () => {
    const { llms } = await generate()
    const lines = llms.split("\n")
    expect(lines.slice(0, HEADER.length)).toEqual(HEADER)
    expect(HEADER.filter((line) => !line.startsWith("# ") || line.includes("\t"))).toEqual([])
    const exports = lines.slice(0, -1).filter((line) => !line.startsWith("#"))
    expect(exports.length).toBeGreaterThan(0)
    expect(exports.filter((line) => line.split("\t").length !== 4)).toEqual([])
  })

  it("end llms.txt with the hash of its export lines", async () => {
    const { llms } = await generate()
    const lines = llms.split("\n")
    const exports = lines.filter((line) => line !== "" && !line.startsWith("#"))
    expect(lines.at(-1)).toBe("")
    expect(lines.at(-2)).toBe(`${FINGERPRINT_PREFIX}${await linesFingerprint(exports)}`)
    expect(lines.at(-2)).toMatch(/^# export surface: sha256 [0-9a-f]{64}$/)
  })

  it("leave out the props of a listed component and keep the component", async () => {
    const { llms, dropped } = await generate()
    expect(dropped).toContain("@spy4x/preact-ui: BadgeProps")
    expect(llms).not.toMatch(/^BadgeProps\t/m)
    expect(llms).toMatch(/^Badge\t/m)
  })
})

/** An entry of the entry point `@spy4x/pkg` with no summary. */
const entry = (name: string, kind: Entry["kind"], keyword: string): Entry => ({
  name,
  kind,
  keyword,
  summary: "",
  specifier: "@spy4x/pkg",
})

describe("exportLine", () => {
  it("joins name, kind, specifier and summary with one tab each", () => {
    expect(exportLine({ ...entry("Badge", "component", "function"), summary: "A small label." }))
      .toBe("Badge\tcomponent\t@spy4x/pkg\tA small label.")
  })

  it("turns a tab or a line break inside a summary into one space", () => {
    expect(exportLine({ ...entry("clamp", "helper", "function"), summary: "Keeps\ta \n value." }))
      .toBe("clamp\thelper\t@spy4x/pkg\tKeeps a value.")
  })

  it("keeps an empty fourth field for an export with no summary", () => {
    expect(exportLine(entry("BarDatum", "type", "interface"))).toBe("BarDatum\ttype\t@spy4x/pkg\t")
  })
})

describe("describesParameters", () => {
  it("leaves out a type named after a function, a class or createFoo", () => {
    const dropped = describesParameters([
      entry("Badge", "component", "function"),
      entry("BadgeProps", "type", "interface"),
      entry("BadgeLabels", "type", "typeAlias"),
      entry("niceScale", "helper", "function"),
      entry("NiceScaleOptions", "type", "interface"),
      entry("createStore", "helper", "function"),
      entry("StoreConfig", "type", "interface"),
      entry("Client", "component", "class"),
      entry("ClientDeps", "type", "interface"),
    ])
    expect([...dropped].sort()).toEqual([
      "BadgeLabels",
      "BadgeProps",
      "ClientDeps",
      "NiceScaleOptions",
      "StoreConfig",
    ])
  })

  it("leaves out the props of a component declared as a constant", () => {
    const dropped = describesParameters([
      entry("Button", "component", "variable"),
      entry("ButtonProps", "type", "typeAlias"),
    ])
    expect([...dropped]).toEqual(["ButtonProps"])
  })

  it("keeps a type named after an interface, a type, an enum or a lower-case constant", () => {
    const dropped = describesParameters([
      entry("Alarm", "type", "interface"),
      entry("AlarmInput", "type", "interface"),
      entry("Range", "type", "typeAlias"),
      entry("RangeOptions", "type", "interface"),
      entry("Tone", "type", "enum"),
      entry("ToneLabels", "type", "interface"),
      entry("palette", "helper", "variable"),
      entry("PaletteConfig", "type", "interface"),
    ])
    expect([...dropped]).toEqual([])
  })

  it("keeps an enum, a type with another ending and a bare suffix", () => {
    const dropped = describesParameters([
      entry("Badge", "component", "function"),
      entry("BadgeOptions", "type", "enum"),
      entry("BadgeTone", "type", "typeAlias"),
      entry("create", "helper", "function"),
      entry("Props", "type", "interface"),
    ])
    expect([...dropped]).toEqual([])
  })
})

describe("exportLines", () => {
  it("sorts the names of one entry point by code unit and keeps the entry points' order", () => {
    const sub = { ...entry("alpha", "helper", "function"), specifier: "@spy4x/pkg/sub" }
    const { lines } = exportLines([
      entry("zeta", "helper", "function"),
      entry("Badge", "component", "function"),
      sub,
      entry("alpha", "helper", "function"),
    ])
    expect(lines.map((line) => line.split("\t")[0] + " " + line.split("\t")[2])).toEqual([
      "Badge @spy4x/pkg",
      "alpha @spy4x/pkg",
      "zeta @spy4x/pkg",
      "alpha @spy4x/pkg/sub",
    ])
  })

  it("keeps a props type whose component is listed under another entry point", () => {
    const { lines, dropped } = exportLines([
      entry("Badge", "component", "function"),
      { ...entry("BadgeProps", "type", "interface"), specifier: "@spy4x/pkg/sub" },
    ])
    expect(dropped).toEqual([])
    expect(lines.length).toBe(2)
  })

  it("names what it leaves out with its import specifier", () => {
    const { lines, dropped } = exportLines([
      entry("Badge", "component", "function"),
      entry("BadgeProps", "type", "interface"),
    ])
    expect(dropped).toEqual(["@spy4x/pkg: BadgeProps"])
    expect(lines).toEqual(["Badge\tcomponent\t@spy4x/pkg\t"])
  })
})

describe("deprecatedSummary", () => {
  it("puts the first sentence of the tag before the summary", () => {
    expect(
      deprecatedSummary("Shows a toast.", [{ kind: "deprecated", doc: "Use `toast`. Gone in 2." }]),
    )
      .toBe("Deprecated: Use `toast`. Shows a toast.")
  })

  it("adds the full stop a tag's text lacks", () => {
    expect(deprecatedSummary("Shows a toast.", [{ kind: "deprecated", doc: "Use `toast`" }]))
      .toBe("Deprecated: Use `toast`. Shows a toast.")
  })

  it("writes the bare word for a tag with no text", () => {
    expect(deprecatedSummary("", [{ kind: "deprecated" }])).toBe("Deprecated.")
  })

  it("returns the summary unchanged without the tag", () => {
    expect(deprecatedSummary("Shows a toast.", [{ kind: "param", doc: "x" }])).toBe(
      "Shows a toast.",
    )
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
        {
          name: "oldStep",
          declarations: [{
            kind: "function",
            jsDoc: {
              doc: "Rounds a step.",
              tags: [{ kind: "deprecated", doc: "Use `niceStep`." }],
            },
          }],
        },
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
      keyword: "interface",
    })
  })

  it("starts the summary of an export tagged @deprecated with the tag's text", () => {
    const entries = buildEntries(fixture(), [], "", "@spy4x/pkg", index())
    expect(entries.find((entry) => entry.name === "oldStep")?.summary).toBe(
      "Deprecated: Use `niceStep`. Rounds a step.",
    )
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
