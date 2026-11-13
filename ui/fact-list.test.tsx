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
      />TimeoutError<\/dd><dd class="[^"]*sm:col-start-2">The error type only\.<\/dd>/,
    )
  })

  it("stacks each value under its label on a phone, in two columns from sm, wrapping long values", () => {
    const html = render(<FactList facts={[{ label: "Job", value: "auth.password-reset-mail" }]} />)
    expect(html).toContain('class="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-3"')
    expect(html).toContain("wrap-anywhere sm:col-span-2")
  })

  it("renders nothing for no facts", () => {
    expect(render(<FactList facts={[]} />)).toBe("")
  })
})
