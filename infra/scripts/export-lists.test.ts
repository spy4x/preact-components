import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  CATALOGUED,
  type Docs,
  exportListProblems,
  type PackageSurface,
  readDocs,
  readPackages,
  stripJsonc,
} from "./export-lists.ts"

/** One package per catalogued id plus `cn`, each exporting one component from its own subpath. */
function packages(): Record<string, PackageSurface> {
  const surfaces: Record<string, PackageSurface> = {
    cn: { names: ["cn"], subpaths: {} },
  }
  for (const id of CATALOGUED) {
    surfaces[id] = { names: [`Widget`, `widgetHelper`], subpaths: { widget: [`Widget`] } }
  }
  return surfaces
}

/** Docs that agree with {@link packages}: every row, every install line, every component. */
function docs(): Docs {
  const ids = Object.keys(packages())
  const contents: Record<string, string> = { cn: "`cn()`", map: "`Widget`, `widgetHelper`" }
  const rows = ids.map((id) => `| \`${id}/\` | ${contents[id] ?? "`Widget`"} |`)
  const summary = ["| Directory | Contents |", "| --- | --- |", ...rows].join("\n")
  const packageReadmes: Record<string, string> = {}
  for (const id of CATALOGUED) {
    packageReadmes[id] = [
      "## Components",
      "",
      "| Component | Subpath | Props |",
      "| --- | --- | --- |",
      "| `Widget` | `widget` | `value` |",
    ].join("\n")
  }
  return {
    agents: `## Package layout\n\n${summary}\n`,
    readme: [
      "## Install",
      "",
      ...ids.map((id) => `deno add jsr:@preact-components/${id}`),
      "",
      "## Scope",
      "",
      summary,
    ].join("\n"),
    packageReadmes,
  }
}

describe("export lists", () => {
  it("finds no drift between the docs and the packages' real exports", async () => {
    const real = await readPackages()
    expect(exportListProblems(await readDocs(Object.keys(real)), real)).toEqual([])
  })

  it("reports nothing when every document agrees with the exports", () => {
    expect(exportListProblems(docs(), packages())).toEqual([])
  })

  it("reports a summary row that names something its package does not export", () => {
    const input = docs()
    input.agents = input.agents.replace("| `ui/` | `Widget` |", "| `ui/` | `Widget`, `Gadget` |")
    expect(exportListProblems(input, packages())).toEqual([
      "AGENTS.md lists `Gadget` under ui/, which ui does not export",
    ])
  })

  it("reports an export a complete summary row leaves out", () => {
    const surfaces = packages()
    surfaces.cn.names.push("cx")
    expect(exportListProblems(docs(), surfaces)).toEqual([
      "AGENTS.md's cn/ row does not name `cx`, which cn exports",
      "README.md's cn/ row does not name `cx`, which cn exports",
    ])
  })

  it("accepts a subpath name in a summary row", () => {
    const input = docs()
    input.readme = input.readme.replace("| `ui/` | `Widget` |", "| `ui/` | `Widget`, `widget` |")
    expect(exportListProblems(input, packages())).toEqual([])
  })

  it("reports a published package with no summary row", () => {
    const input = docs()
    input.readme = input.readme.replace("| `system/` | `Widget` |\n", "")
    expect(exportListProblems(input, packages())).toEqual([
      "README.md has no row for the published package system/",
    ])
  })

  it("reports an install line for no package and a package with no install line", () => {
    const input = docs()
    input.readme = input.readme.replace(
      "deno add jsr:@preact-components/cn",
      "deno add jsr:@preact-components/nav",
    )
    expect(exportListProblems(input, packages())).toEqual([
      "README.md installs nav, which is not a package",
      "README.md has no `deno add` line for cn",
    ])
  })

  it("reports a component the package README leaves out", () => {
    const surfaces = packages()
    surfaces.ui.names.push("Gadget")
    expect(exportListProblems(docs(), surfaces)).toEqual([
      "ui exports the component `Gadget`, and ui/README.md does not list it",
    ])
  })

  it("reports a component the package README lists and the package does not export", () => {
    const input = docs()
    input.packageReadmes.system += "\n| `Nav` | | `items` |"
    expect(exportListProblems(input, packages())).toEqual([
      "system/README.md lists the component `Nav`, which system does not export",
    ])
  })

  it("reports a row whose subpath does not export its component", () => {
    const input = docs()
    input.packageReadmes.charts = input.packageReadmes.charts.replace("`widget`", "`gadget`")
    expect(exportListProblems(input, packages())).toEqual([
      "charts/README.md says `gadget` exports `Widget`, and it does not",
    ])
  })

  it("reports a catalogued package whose README has no Components table", () => {
    const input = docs()
    input.packageReadmes.crud = "## Usage\n\n| `Widget` | `widget` | |"
    expect(exportListProblems(input, packages())).toEqual([
      `crud/README.md has no "## Components" table`,
    ])
  })
})

describe("stripJsonc", () => {
  it("drops comments and trailing commas and keeps // inside a string", () => {
    const text = `{\n  // a comment\n  "url": "https://x.example/", /* block */\n  "list": [1,],\n}`
    expect(JSON.parse(stripJsonc(text))).toEqual({ url: "https://x.example/", list: [1] })
  })
})
