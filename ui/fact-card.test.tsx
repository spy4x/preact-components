import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { FactCard } from "./fact-card.tsx"

describe("FactCard", () => {
  it("renders facts as a real definition list", () => {
    const html = render(
      <FactCard
        facts={[
          { key: "Stack", value: "Deno + Hono + Fresh" },
          { key: "Status", value: "Ready" },
        ]}
      />,
    )
    expect(html).toContain("<dl")
    expect(html).toContain("<dt")
    expect(html).toContain("Stack")
    expect(html).toContain("Deno + Hono + Fresh")
    expect(html).toContain("Status")
  })

  it("renders no header when title is omitted", () => {
    const html = render(<FactCard facts={[{ key: "A", value: "1" }]} />)
    expect(html).not.toContain("card-header")
  })

  it("renders a header with the given title and action", () => {
    const html = render(
      <FactCard title="Project" action={<span>Edit</span>} facts={[{ key: "A", value: "1" }]} />,
    )
    expect(html).toContain("card-header")
    expect(html).toContain("Project")
    expect(html).toContain("Edit")
  })

  it("renders markup passed as a fact's value, not only text", () => {
    const html = render(
      <FactCard facts={[{ key: "State", value: <strong>Live</strong> }]} />,
    )
    expect(html).toContain("<strong>Live</strong>")
  })

  it("renders the card and body classes the composed primitives own", () => {
    const html = render(<FactCard facts={[{ key: "A", value: "1" }]} />)
    expect(html).toContain("card")
    expect(html).toContain("card-body")
  })
})
