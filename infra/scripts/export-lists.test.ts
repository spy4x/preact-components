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

/**
 * Docs that agree with {@link packages}: every row, every install line, every README link, every
 * component.
 */
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
      "## Packages",
      "",
      "| Package | What it holds |",
      "| --- | --- |",
      ...ids.map((id) => `| [\`@spy4x/preact-${id}\`](${id}/README.md) | ${id} |`),
    ].join("\n"),
    usage: ["## Install", "", ...ids.map((id) => `deno add jsr:@spy4x/preact-${id}`)].join("\n"),
    maintaining: `## Scope\n\n${summary}\n`,
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
      "docs/maintaining.md's cn/ row does not name `cx`, which cn exports",
    ])
  })

  it("reports a summary row for a directory that is not a published package", () => {
    const input = docs()
    input.agents = input.agents.replace(
      "| `ui/` | `Widget` |",
      "| `ui/` | `Widget` |\n| `auth/` | `Login`, `Nav` |",
    )
    expect(exportListProblems(input, packages())).toEqual([
      "AGENTS.md has a row for auth/, which is not a published package",
    ])
  })

  it("accepts the pages/ row, which publishes nothing", () => {
    const input = docs()
    input.agents = input.agents.replace(
      "| `ui/` | `Widget` |",
      "| `ui/` | `Widget` |\n| `pages/` | demo app, not published |",
    )
    expect(exportListProblems(input, packages())).toEqual([])
  })

  it("accepts a subpath name in a summary row", () => {
    const input = docs()
    input.maintaining = input.maintaining.replace(
      "| `ui/` | `Widget` |",
      "| `ui/` | `Widget`, `widget` |",
    )
    expect(exportListProblems(input, packages())).toEqual([])
  })

  it("reports a published package with no summary row", () => {
    const input = docs()
    input.maintaining = input.maintaining.replace("| `system/` | `Widget` |\n", "")
    expect(exportListProblems(input, packages())).toEqual([
      "docs/maintaining.md has no row for the published package system/",
    ])
  })

  it("reports an install line for no package and a package with no install line", () => {
    const input = docs()
    input.usage = input.usage.replace(
      "deno add jsr:@spy4x/preact-cn",
      "deno add jsr:@spy4x/preact-nav",
    )
    expect(exportListProblems(input, packages())).toEqual([
      "docs/usage.md installs nav, which is not a package",
      "docs/usage.md has no `deno add` line for cn",
    ])
  })

  it("reports a published package the README's Packages table does not link", () => {
    const input = docs()
    input.readme = input.readme.replace("](map/README.md)", "](map/)")
    expect(exportListProblems(input, packages())).toEqual([
      "README.md's Packages table does not link map/README.md",
    ])
  })

  it("does not count a README link outside the Packages table", () => {
    const input = docs()
    input.readme = input.readme.replace(/^.*\(crud\/README\.md\).*\n?/m, "") +
      "\n\n## Development\n\n| [crud](crud/README.md) | |\n"
    expect(exportListProblems(input, packages())).toEqual([
      "README.md's Packages table does not link crud/README.md",
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

  it("checks every component a Components row names, not only the first", () => {
    const input = docs()
    input.packageReadmes.ui = input.packageReadmes.ui.replace(
      "| `Widget` |",
      "| `Widget`, `Gadget` |",
    )
    expect(exportListProblems(input, packages())).toEqual([
      "ui/README.md says `widget` exports `Gadget`, and it does not",
      "ui/README.md lists the component `Gadget`, which ui does not export",
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
