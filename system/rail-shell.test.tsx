import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { RailShell } from "./rail-shell.tsx"

describe("RailShell", () => {
  it("draws Rail's icons variant, calling its slots with the earlier place names", () => {
    const calls: string[] = []
    const html = render(
      <RailShell
        items={[{ key: "a", label: "A", href: "/a" }]}
        sidebarTop={(place) => {
          calls.push(`top:${place}`)
          return null
        }}
        sidebarBottom={(place) => {
          calls.push(`bottom:${place}`)
          return null
        }}
      >
        page
      </RailShell>,
    )
    expect(calls.sort()).toEqual(["bottom:overlay", "bottom:rail", "top:overlay", "top:rail"])
    expect(html).toContain('data-rail-variant="icons"')
  })
})
