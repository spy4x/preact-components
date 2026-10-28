import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { SwatchChips, type SwatchOption } from "./swatch-chips.tsx"

const COLOURS: SwatchOption[] = [
  { value: "brown", name: "Brown", color: "#7a5230", id: "colour-brown" },
  { value: "grey", name: "Grey", color: "#8a8d91" },
  { value: "white", name: "White", color: "#ffffff", disabled: true },
]

describe("SwatchChips", () => {
  it("is a fieldset of native radios sharing a name, so the choice works with no script", () => {
    const html = render(
      <SwatchChips legend="Colour" name="colour" options={COLOURS} defaultValue="grey" />,
    )
    expect(html).toMatch(/^<fieldset[^>]*><legend class="pc-label mb-2">Colour<\/legend>/)
    const radios = html.match(/<input[^>]*>/g) ?? []
    expect(radios.length).toBe(3)
    for (const radio of radios) expect(radio).toContain('type="radio" class="sr-only"')
    expect(radios.filter((radio) => / checked/.test(radio))).toEqual([
      expect.stringContaining('value="grey"'),
    ])
    expect(radios[0]).toContain('id="colour-brown"')
    expect(radios[2]).toContain("disabled")
    expect(html).not.toContain("<script")
  })

  it("names each radio by the colour's written name, after a hidden swatch in that colour", () => {
    const html = render(<SwatchChips legend="Colour" name="colour" options={COLOURS} />)
    expect(html).toMatch(
      /<span aria-hidden="true" class="[^"]*rounded-full border border-strong" style="background-color:#7a5230;"><\/span>Brown<\/label>/,
    )
    expect(html).toContain('style="background-color:#ffffff;"></span>White</label>')
  })
})
