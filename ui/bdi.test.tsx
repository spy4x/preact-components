import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { isolate, Isolated } from "./bdi.tsx"

describe("Isolated", () => {
  it("draws the value in a bdi where the message puts it", () => {
    const html = render(
      <Isolated message={(name) => `${name} is not an accepted file type`} value="report.pdf" />,
    )
    expect(html).toBe("<bdi>report.pdf</bdi> is not an accepted file type")
  })

  it("draws a message that drops the value as it is, with no bdi", () => {
    expect(render(<Isolated message={() => "Could not load"} value="English" />))
      .toBe("Could not load")
  })
})

describe("isolate", () => {
  it("wraps the value in a first-strong isolate and its closing mark", () => {
    expect(isolate("report.pdf")).toBe("\u2068report.pdf\u2069")
  })
})

describe("@spy4x/preact-ui/bdi", () => {
  it("is published as its own subpath and in the barrel, so an app can import both helpers", async () => {
    const subpath = await import("@spy4x/preact-ui/bdi")
    const barrel = await import("@spy4x/preact-ui")
    expect([subpath.Isolated, subpath.isolate]).toEqual([Isolated, isolate])
    expect([barrel.Isolated, barrel.isolate]).toEqual([Isolated, isolate])
  })
})
