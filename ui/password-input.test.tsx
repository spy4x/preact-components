import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Field } from "./field.tsx"
import { PasswordInput } from "./password-input.tsx"

/** The `<input>` tag of the rendered markup. */
function inputTag(html: string): string {
  return /<input[^>]*>/.exec(html)?.[0] ?? ""
}

/** The toggle's opening `<button>` tag of the rendered markup. */
function toggleTag(html: string): string {
  return /<button[^>]*>/.exec(html)?.[0] ?? ""
}

describe("PasswordInput", () => {
  it("starts hidden: a password input and an unpressed toggle named Show password", () => {
    const html = render(<PasswordInput name="password" />)
    expect(inputTag(html)).toContain('type="password"')
    expect(toggleTag(html)).toContain('aria-pressed="false"')
    expect(toggleTag(html)).toContain('aria-label="Show password"')
  })

  it("draws the toggle as a type=button sibling of the input", () => {
    const html = render(<PasswordInput name="password" />)
    expect(toggleTag(html)).toContain('type="button"')
    expect(html).toMatch(/<input[^>]*>\s*<button/)
  })

  it("names the toggle from a labels override", () => {
    const html = render(<PasswordInput labels={{ show: "Passwort anzeigen", hide: "Verbergen" }} />)
    expect(toggleTag(html)).toContain('aria-label="Passwort anzeigen"')
    expect(html).not.toContain("Show password")
  })

  it("passes native attributes and data-e2e to the input, and toggleDataE2E to the toggle", () => {
    const html = render(
      <PasswordInput
        id="pw"
        name="secret"
        autocomplete="new-password"
        required
        minLength={8}
        aria-describedby="pw-hint"
        class="w-64"
        data-e2e="pw-input"
        toggleDataE2E="pw-toggle"
      />,
    )
    const input = inputTag(html)
    for (
      const part of [
        'id="pw"',
        'name="secret"',
        'autocomplete="new-password"',
        "required",
        'minlength="8"',
        'aria-describedby="pw-hint"',
        'data-e2e="pw-input"',
      ]
    ) expect(input).toContain(part)
    expect(input).toMatch(/class="pc-input pe-12 w-64"/)
    expect(toggleTag(html)).toContain('data-e2e="pw-toggle"')
  })

  it("takes a Field's id and hint wiring on its input as a direct child", () => {
    const html = render(
      <Field id="account-password" label="Password" hint="At least 8 characters">
        <PasswordInput name="password" />
      </Field>,
    )
    const input = inputTag(html)
    expect(input).toContain('id="account-password"')
    expect(input).toMatch(/aria-describedby="[^"]+"/)
    expect(html).toContain('for="account-password"')
  })
})
