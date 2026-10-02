import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ErrorState } from "./error-state.tsx"

describe("ErrorState", () => {
  it("renders nothing without a message", () => {
    expect(render(<ErrorState />)).toBe("")
  })

  it("renders nothing for an empty message", () => {
    expect(render(<ErrorState message="" />)).toBe("")
  })

  it("renders nothing for a null message", () => {
    expect(render(<ErrorState message={null} />)).toBe("")
  })

  it("announces the message as an alert", () => {
    const html = render(<ErrorState message="Upload failed" />)

    expect(html).toContain('role="alert"')
    expect(html).toContain("Upload failed")
  })

  it("draws the panel with the danger tokens an app can repaint", () => {
    const html = render(<ErrorState message="Upload failed" />)

    expect(html).toContain("border-danger bg-danger-soft")
    expect(html).toContain("text-danger")
    expect(html).not.toMatch(/red-\d/)
  })

  it("appends a caller class", () => {
    expect(render(<ErrorState message="Nope" class="max-w-full" />)).toContain("max-w-full")
  })
})
