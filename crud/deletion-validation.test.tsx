import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DeletionValidation } from "./deletion-validation.tsx"
import type { DeletionDependency } from "./types.ts"

const dependencies: DeletionDependency[] = [
  {
    kind: "Zones",
    values: [
      { title: "Zone A", url: "/zones/1/edit" },
      { title: "Zone B", url: "/zones/2/edit" },
    ],
  },
  { kind: "Schedules", values: [{ title: "Weekly sweep", url: "/schedules/3/edit" }] },
]

describe("DeletionValidation", () => {
  it("renders the alert region on an empty list, with no visible content", () => {
    const html = render(<DeletionValidation dependencies={[]} model="Region" />)

    expect(html).toContain('role="alert"')
    expect(html).not.toContain("border-red-600")
    expect(html).not.toContain("To archive this Region")
  })

  it("carries no class on the region while the dependency list is empty", () => {
    const html = render(<DeletionValidation dependencies={[]} model="Region" />)
    const match = html.match(/<div([^>]*)role="alert"/)

    expect(match).not.toBeNull()
    expect(match?.[1]).not.toContain("class=")
  })

  it("lists every dependency kind and its linked values when the list is non-empty", () => {
    const html = render(<DeletionValidation dependencies={dependencies} model="Region" />)

    expect(html).toContain("To archive this Region, please first archive:")
    expect(html).toContain("Zones:")
    expect(html).toContain("Schedules:")
    expect(html).toContain('href="/zones/1/edit"')
    expect(html).toContain("Zone A")
    expect(html).toContain('href="/schedules/3/edit"')
    expect(html).toContain("Weekly sweep")
  })

  it("styles the region as the visible card once there are dependencies", () => {
    const html = render(<DeletionValidation dependencies={dependencies} model="Region" />)
    const match = html.match(/<div([^>]*)role="alert"/)

    expect(match?.[1]).toContain("border-red-600")
  })
})
