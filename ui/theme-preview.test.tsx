import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { THEME_PREVIEW_CSS } from "@spy4x/preact-theme"
import { ThemePreview } from "./theme-preview.tsx"

/** Each radio's opening tag, in order. */
const radios = (html: string) => html.match(/<input[^>]*>/g) ?? []
const isChecked = (input = "") => / checked(\s|\/|>)/.test(input)

describe("ThemePreview", () => {
  it("renders a Dark / Light radio pair with dark checked, then the children inside the frame", () => {
    const html = render(
      <ThemePreview name="look">
        <button type="button">Save</button>
      </ThemePreview>,
    )
    const [dark, light] = radios(html)

    expect(radios(html).length).toBe(2)
    expect(dark).toContain(`value="dark"`)
    expect(isChecked(dark)).toBe(true)
    expect(isChecked(light)).toBe(false)
    expect(html).toMatch(/<legend[^>]*>Theme<\/legend>/)
    expect(html).toMatch(/>Dark<\/label>.*>Light<\/label>/)
    expect(html).toMatch(
      /<div data-theme-preview-frame[^>]*><button type="button">Save<\/button><\/div><\/div>$/,
    )
    expect(html).not.toContain("<script")
  })

  it("checks light when asked, and takes the caller's words and name", () => {
    const html = render(
      <ThemePreview
        name="look"
        defaultTheme="light"
        labels={{ legend: "Palette", dark: "Night", light: "Day" }}
        hideLegend
      >
        <p>Sample</p>
      </ThemePreview>,
    )
    const [dark, light] = radios(html)

    expect(isChecked(dark)).toBe(false)
    expect(isChecked(light)).toBe(true)
    expect(html).toContain(`<legend class="sr-only">Palette</legend>`)
    expect(html).toMatch(/>Night<\/label>.*>Day<\/label>/)
    for (const input of radios(html)) expect(input).toContain(`name="look"`)
  })

  it("gives both radios one generated name when the caller gives none", () => {
    const [dark, light] = radios(render(<ThemePreview>x</ThemePreview>))
    const name = dark?.match(/name="([^"]+)"/)?.[1]

    expect(name).toMatch(/^theme-preview-/)
    expect(light).toContain(`name="${name}"`)
  })

  it("renders the markup theme-preview.css selects: each radio's choice, and the frame right after their fieldset", () => {
    const html = render(<ThemePreview name="look">x</ThemePreview>)

    expect(html).toMatch(/^<div class="[^"]*"><fieldset/)
    expect(radios(html)[0]).toContain(`data-theme-preview-choice="dark"`)
    expect(radios(html)[1]).toContain(`data-theme-preview-choice="light"`)
    expect(html).toMatch(/<\/fieldset><div data-theme-preview-frame /)
    for (const theme of ["dark", "light"]) {
      expect(THEME_PREVIEW_CSS).toContain(
        `:has([data-theme-preview-choice=${theme}]:checked) + [data-theme-preview-frame]`,
      )
    }
  })

  it("draws the frame on its palette's canvas, border and text colour", () => {
    const frame = render(<ThemePreview name="look">x</ThemePreview>)
      .match(/<div data-theme-preview-frame class="([^"]*)"/)?.[1].split(" ") ?? []

    expect(frame).toEqual(
      expect.arrayContaining(["bg-canvas", "text-foreground", "border", "border-subtle"]),
    )
  })
})
