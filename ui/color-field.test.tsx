import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { contrastRatio, isHexColor, readableTextColor } from "@spy4x/platform/universal/color"
import { render } from "preact-render-to-string"
import { COLOR_PRESETS, ColorField } from "./color-field.tsx"

/** Each radio's opening tag, in the order of the swatches. */
function radios(html: string): string[] {
  return html.match(/<input[^>]*type="radio"[^>]*>/g) ?? []
}

/** The radios the markup checks. */
function checkedRadios(html: string): string[] {
  return radios(html).filter((input) => / checked(\s|\/|>)/.test(input))
}

/** The opening tag of the element with this `id`. */
function elementWithId(html: string, id: string): string {
  return html.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? ""
}

const noop = () => {}

describe("COLOR_PRESETS", () => {
  it("holds 16 distinct lower-case hex colours, a gray among them", () => {
    expect(COLOR_PRESETS.length).toBe(16)
    expect(new Set(COLOR_PRESETS.map((preset) => preset.value)).size).toBe(16)
    for (const preset of COLOR_PRESETS) {
      expect(isHexColor(preset.value)).toBe(true)
      expect(preset.value).toBe(preset.value.toLowerCase())
    }
    expect(COLOR_PRESETS.some((preset) => preset.label === "Gray")).toBe(true)
  })

  it("gives every preset at least 4.5:1 with its readable text colour", () => {
    for (const preset of COLOR_PRESETS) {
      const ratio = contrastRatio(preset.value, readableTextColor(preset.value))
      if (ratio < 4.5) throw new Error(`${preset.label} ${preset.value}: ${ratio.toFixed(2)}`)
    }
  })
})

describe("ColorField", () => {
  it("renders a fieldset named by its legend, a radio per preset and Custom last, sharing a name", () => {
    const html = render(<ColorField value="#b91c1c" onChange={noop} legend="Tag colour" />)

    expect(html).toMatch(/^<fieldset[^>]*><legend class="pc-label mb-2">Tag colour<\/legend>/)
    const inputs = radios(html)
    expect(inputs.length).toBe(17)
    const name = inputs[0].match(/name="([^"]+)"/)?.[1]
    expect(name).toBeTruthy()
    for (const input of inputs) expect(input).toContain(`name="${name}"`)
    expect(inputs.at(-1)).toContain(`value="custom"`)
    expect(html).toMatch(/<span class="sr-only">Pick a custom colour<\/span><\/label><\/div>/)
    expect(html).toContain(`<span class="sr-only">Red</span>`)
  })

  it("checks the preset that matches the value, in any case, and draws one check mark", () => {
    const html = render(<ColorField value="#B91C1C" onChange={noop} />)

    const checked = checkedRadios(html)
    expect(checked.length).toBe(1)
    expect(checked[0]).toContain(`value="#b91c1c"`)
    expect(html.match(/<svg/g)?.length).toBe(2) // the check, and the plus on Custom
    expect(html).not.toContain("Hex code")
  })

  it("draws the check in the readable text colour of its swatch", () => {
    const html = render(<ColorField value="#facc15" onChange={noop} />)

    expect(html).toMatch(
      /background-color:\s*#facc15[^>]*><span class="inline-flex" style="color:\s*#000000/,
    )

    const blue = render(<ColorField value="#1d4ed8" onChange={noop} />)
    expect(blue).toMatch(
      /background-color:\s*#1d4ed8[^>]*><span class="inline-flex" style="color:\s*#ffffff/,
    )
  })

  it("opens on Custom for a colour no preset has, filling the swatch and the hex field", () => {
    const html = render(<ColorField value="#59168b" onChange={noop} />)

    const checked = checkedRadios(html)
    expect(checked.length).toBe(1)
    expect(checked[0]).toContain(`value="custom"`)
    expect(html).toMatch(/background-color:\s*#59168b/)
    expect(html).toContain(">Hex code</label>")
    expect(html).toMatch(/<input[^>]*value="#59168b"[^>]*placeholder="#59168b"/)
    expect(html).toMatch(/<input type="color"[^>]*aria-label="Colour picker"[^>]*value="#59168b"/)
  })

  it("checks None for no colour when allowed, and nothing when not", () => {
    const allowed = render(
      <ColorField value={null} onChange={noop} allowNone noneLabel="No group colour" />,
    )
    expect(radios(allowed)[0]).toContain(`value="none"`)
    expect(checkedRadios(allowed).length).toBe(1)
    expect(checkedRadios(allowed)[0]).toContain(`value="none"`)
    expect(allowed).toContain(`<span class="sr-only">No group colour</span>`)

    const plain = render(<ColorField value={null} onChange={noop} />)
    expect(radios(plain).length).toBe(17)
    expect(checkedRadios(plain).length).toBe(0)
  })

  it("treats a value that is not #rrggbb as no colour", () => {
    const html = render(<ColorField value="red" onChange={noop} preview={() => "sample"} />)

    expect(checkedRadios(html).length).toBe(0)
    expect(html).not.toContain("sample")
  })

  it("hands the preview the colour and its readable text colour, only while one is chosen", () => {
    const seen: string[] = []
    const html = render(
      <ColorField
        value="#facc15"
        onChange={noop}
        preview={(color, text) => {
          seen.push(`${color} ${text}`)
          return <b>Groceries</b>
        }}
      />,
    )
    expect(seen).toEqual(["#facc15 #000000"])
    expect(html).toContain("<b>Groceries</b>")

    render(<ColorField value={null} onChange={noop} preview={() => seen.push("none")} />)
    expect(seen).toEqual(["#facc15 #000000"])
  })

  it("ties the caller's error and the hint to the group with aria-describedby", () => {
    const html = render(
      <ColorField value={null} onChange={noop} error="Pick a colour" hint="Shown on the tag" />,
    )

    const describedBy = html.match(/<fieldset[^>]*aria-describedby="([^"]+)"/)?.[1]?.split(" ")
    expect(describedBy?.length).toBe(2)
    expect(elementWithId(html, describedBy![0])).toContain(`text-danger`)
    expect(html).toContain(">Pick a colour</p>")
    expect(elementWithId(html, describedBy![1])).toContain(`text-muted`)
    expect(html).toContain(">Shown on the tag</p>")

    const bare = render(<ColorField value={null} onChange={noop} />)
    expect(bare).not.toMatch(/<fieldset[^>]*aria-describedby/)
  })

  it("takes every word of the Custom swatch from labels", () => {
    const html = render(
      <ColorField
        value="#59168b"
        onChange={noop}
        labels={{
          custom: "Own colour",
          picker: "Picker",
          hexCode: "Code",
          hexPlaceholder: "#000000",
        }}
      />,
    )
    expect(html).toContain(`<span class="sr-only">Own colour</span>`)
    expect(html).toContain(`aria-label="Picker"`)
    expect(html).toContain(">Code</label>")
    expect(html).toContain(`placeholder="#000000"`)
  })
})
