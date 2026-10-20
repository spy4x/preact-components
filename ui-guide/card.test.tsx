import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MissingDemoBanner } from "./card.tsx"

describe("MissingDemoBanner", () => {
  it("renders a danger-toned alert in theme tokens that names every missing card", () => {
    const html = render(<MissingDemoBanner names={["Button", "Modal"]} />)

    expect(html).toMatch(/^<div data-e2e="ui-guide-missing-demos" role="alert"/)
    // The theme's danger tokens, so an app's repainted danger colour and the ink palette apply.
    expect(html).toContain("border-danger bg-danger-soft")
    expect(html).not.toMatch(/red-\d/)
    expect(html).toContain("2 cards are missing from this registry")
    expect(html).toContain(`<code class="font-mono">Button</code>`)
    expect(html).toContain(`<code class="font-mono">Modal</code>`)
  })

  it("says card is, singular, when one card is missing", () => {
    const html = render(<MissingDemoBanner names={["Button"]} />)

    expect(html).toContain("1 card is missing from this registry")
  })
})
