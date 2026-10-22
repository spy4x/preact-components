import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { FactList } from "./fact-list.tsx"

describe("FactList", () => {
  it("renders each label and value as a term and its description, in order", () => {
    const html = render(
      <FactList
        facts={[{ label: "Attempts", value: "4 of 20" }, { label: "Status", value: "Failed" }]}
      />,
    )
    expect(html).toMatch(/^<dl /)
    expect(html).toContain('<dt class="text-muted">Attempts</dt>')
    expect(html).toContain(">4 of 20</dd>")
    expect(html.indexOf("Attempts")).toBeLessThan(html.indexOf("Status"))
  })

  it("puts a hint in a second description under its value", () => {
    const html = render(
      <FactList
        facts={[{
          id: "error",
          label: "Last error",
          value: "TimeoutError",
          hint: "The error type only.",
        }]}
      />,
    )
    expect(html).toContain('data-e2e="error"')
    expect(html).toMatch(
      />TimeoutError<\/dd><dd class="basis-full[^"]*">The error type only\.<\/dd>/,
    )
  })

  it("lets a long value wrap under its label instead of overflowing", () => {
    const html = render(<FactList facts={[{ label: "Job", value: "auth.password-reset-mail" }]} />)
    expect(html).toContain("flex flex-wrap")
    expect(html).toContain("wrap-anywhere")
  })

  it("renders nothing for no facts", () => {
    expect(render(<FactList facts={[]} />)).toBe("")
  })
})
