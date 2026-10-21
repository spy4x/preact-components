import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Explorable } from "./explorable.tsx"

const controls = <input aria-label="Rate" type="range" />

describe("Explorable", () => {
  it("renders a figure named by its title, with the result and a left-aligned caption", () => {
    const html = render(
      <Explorable id="rates" title="What a rate does" lead="Move the slider." caption="Source: X">
        <p>Result</p>
      </Explorable>,
    )
    expect(html).toMatch(/^<figure id="rates" aria-labelledby="rates-title"/)
    expect(html).toMatch(/<p id="rates-title"[^>]*>What a rate does<\/p>/)
    expect(html).toContain("Move the slider.")
    expect(html).toContain("<p>Result</p>")
    expect(html).toMatch(/<figcaption class="[^"]*\btext-left\b[^"]*">Source: X<\/figcaption>/)
  })

  it("sets the title as a paragraph, not a heading, so a table of contents skips it", () => {
    const html = render(<Explorable title="What a rate does">x</Explorable>)
    expect(html).not.toMatch(/<h[1-6]/)
    expect(html).toMatch(/<p id="[^"]+-title" class="[^"]*\btext-base font-semibold\b/)
  })

  it("draws the frame on the card surface with a hairline border and the card radius", () => {
    const html = render(<Explorable title="T">x</Explorable>)
    expect(html).toMatch(
      /^<figure[^>]*class="[^"]*rounded-card border border-subtle bg-surface p-4 sm:p-6/,
    )
  })

  it("disables the controls and hides the Interactive line until it is live", () => {
    const html = render(<Explorable title="T" controls={controls}>x</Explorable>)
    expect(html).toMatch(/<fieldset disabled/)
    expect(html).toMatch(/<p hidden class="[^"]*"[^>]*><svg[^>]*>.*<\/svg>Interactive<\/p>/)
    expect(html).toContain('data-live="false"')
  })

  it("dims the controls only when scripts are off, so they never flash dim while scripts run", () => {
    const html = render(<Explorable title="T" controls={controls}>x</Explorable>)
    expect(html).toMatch(/<fieldset disabled class="[^"]*\bnoscript:opacity-50\b/)
    expect(html).not.toMatch(/<fieldset[^>]*class="[^"]*(?<!noscript:)\bopacity-/)
  })

  it("enables the controls and shows the Interactive line once live", () => {
    const html = render(<Explorable title="T" controls={controls} live>x</Explorable>)
    expect(html).toMatch(/<fieldset class=/)
    expect(html).not.toContain("disabled")
    expect(html).toMatch(/<p class="[^"]*"[^>]*><svg[^>]*>.*<\/svg>Interactive<\/p>/)
    expect(html).toContain('data-live="true"')
  })

  it("takes the Interactive line's words from interactiveLabel", () => {
    const html = render(<Explorable title="T" live interactiveLabel="Try it">x</Explorable>)
    expect(html).toContain("</svg>Try it</p>")
  })

  it("puts the no-script note inside noscript, and leaves out what it is not given", () => {
    const html = render(<Explorable title="T" noScriptNote="Shows a rate of 4%.">x</Explorable>)
    expect(html).toMatch(/<noscript><p[^>]*>Shows a rate of 4%\.<\/p><\/noscript>/)
    expect(html).not.toContain("<fieldset")
    expect(html).not.toContain("<figcaption")
  })
})
