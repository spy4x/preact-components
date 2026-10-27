import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  entryPoints,
  memberConfig,
  memberProblems,
  packageDirectories,
  workspaceMembers,
} from "./workspace.ts"

describe("workspaceMembers", () => {
  it("lists every package directory of the real tree, pages and ui-guide included", async () => {
    const members = await workspaceMembers()
    expect([...members].sort()).toEqual(await packageDirectories())
    expect(members).toContain("pages")
    expect(members).toContain("ui-guide")
  })
})

describe("memberProblems", () => {
  it("names a package directory the workspace does not list", () => {
    expect(memberProblems(["ui"], ["new-pkg", "ui"])).toEqual([
      "new-pkg/ carries a deno.json and is not in the workspace in deno.jsonc: add it there, " +
      "or remove its deno.json",
    ])
  })

  it("names a member that has no package directory", () => {
    expect(memberProblems(["gone", "ui"], ["ui"])).toEqual([
      "deno.jsonc lists gone in the workspace, and gone/ has no deno.json",
    ])
  })

  it("finds nothing when the two agree", () => {
    expect(memberProblems(["ui", "cn"], ["cn", "ui"])).toEqual([])
  })
})

describe("entryPoints", () => {
  it("lists the barrel first, then every subpath, as file URLs", async () => {
    const points = await entryPoints(await memberConfig("theme"))
    expect(points.map(({ subpath }) => subpath)).toEqual([
      ".",
      "./spacing",
      "./spacing-runner",
      "./vite",
      "./lint",
    ])
    expect(points[0].href).toMatch(/\/theme\/\+index\.ts$/)
  })
})
