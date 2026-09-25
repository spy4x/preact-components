import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { CiStatusPill, normalizeCiStatus } from "./ci-status-pill.tsx"

describe("normalizeCiStatus", () => {
  it("recognises passing, failing and running regardless of case", () => {
    expect(normalizeCiStatus("Passing")).toBe("passing")
    expect(normalizeCiStatus("FAILING")).toBe("failing")
    expect(normalizeCiStatus("  running ")).toBe("running")
  })

  it("falls back to unknown for anything else", () => {
    expect(normalizeCiStatus("success")).toBe("unknown")
    expect(normalizeCiStatus("")).toBe("unknown")
    expect(normalizeCiStatus("queued")).toBe("unknown")
  })
})

describe("CiStatusPill", () => {
  it("colours a recognised status with its own tone", () => {
    expect(render(<CiStatusPill status="passing" />)).toContain("green")
    expect(render(<CiStatusPill status="failing" />)).toContain("red")
    expect(render(<CiStatusPill status="running" />)).toContain("blue")
  })

  it("never throws on an unrecognised status, and renders it as a neutral pill", () => {
    expect(() => render(<CiStatusPill status="queued" />)).not.toThrow()
    const html = render(<CiStatusPill status="queued" />)
    expect(html).toContain("gray")
    expect(html).toContain("queued")
  })

  it("renders a caller-supplied label instead of the default", () => {
    expect(render(<CiStatusPill status="passing" label="All green" />)).toContain("All green")
  })
})
