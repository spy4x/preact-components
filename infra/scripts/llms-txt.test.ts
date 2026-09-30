import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  firstSentence,
  generate,
  jsdocSummary,
  kindOf,
  packageDescription,
  readmeSummary,
  resolveModule,
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

describe("jsdocSummary", () => {
  const source = `
/** Not this one. */
export const other = 1

/**
 * Adds two numbers
 * across lines. The second sentence is left out.
 *
 * @param a First.
 */
export function add(a: number) {}

export const bare = 1
`

  it("returns the first sentence of the block directly above the declaration", () => {
    expect(jsdocSummary(source, "add")).toBe("Adds two numbers across lines.")
  })

  it("returns nothing for a declaration with no JSDoc", () => {
    expect(jsdocSummary(source, "bare")).toBe("")
  })

  it("turns an inline link into the linked name", () => {
    expect(firstSentence("Options for {@link preactThemeCss}. More.")).toBe(
      "Options for `preactThemeCss`.",
    )
  })
})

describe("readmeSummary", () => {
  const readme = [
    "| Component | Summary |",
    "| --- | --- |",
    "| `Widget` | Draws a widget. Second sentence. |",
    "",
    "- `helper(x)` — Does the helping. More.",
  ].join("\n")

  it("reads a table row's second cell", () => {
    expect(readmeSummary(readme, "Widget")).toBe("Draws a widget.")
  })

  it("reads a list item after the name", () => {
    expect(readmeSummary(readme, "helper")).toBe("Does the helping.")
  })

  it("returns nothing for a name the README does not mention", () => {
    expect(readmeSummary(readme, "Missing")).toBe("")
  })
})

describe("kindOf", () => {
  it("names the five kinds", () => {
    expect(kindOf("Props", "interface")).toBe("type")
    expect(kindOf("useThing", "function")).toBe("hook")
    expect(kindOf("Button", "function")).toBe("component")
    expect(kindOf("DEFAULT_COLOR", "const")).toBe("constant")
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

describe("resolveModule", () => {
  it("follows a re-export to the module that declares the name", async () => {
    const found = await resolveModule(new URL("ui/+index.ts", ROOT))
    expect(found.get("Badge")?.file.pathname.endsWith("/ui/badge.tsx")).toBe(true)
    expect(found.get("BadgeProps")?.keyword).toBe("interface")
  })
})
