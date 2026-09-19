import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Field, type FieldChild } from "./field.tsx"
import { Input } from "./input.tsx"

describe("Field", () => {
  it("renders the label above the control by default", () => {
    const html = render(
      <Field id="email" label="Email">
        <input id="email" />
      </Field>,
    )

    expect(html.indexOf(">Email<")).toBeLessThan(html.indexOf("<input"))
    expect(html).toContain('class="label"')
    expect(html).toContain('<div class="mt-2">')
  })

  it("renders the label below the control when suffix is set", () => {
    const html = render(
      <Field id="email" label="Email" suffix>
        <input id="email" />
      </Field>,
    )

    expect(html).toContain('for="email"')
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf(">Email<"))
  })

  it("wires exactly one for to the control's id", () => {
    const html = render(
      <Field id="email" label="Email">
        <input id="email" />
      </Field>,
    )

    expect(labelFors(html)).toEqual(["email"])
    expect(html.match(/id="email"/g)).toEqual(['id="email"'])
    expect(html).not.toContain('for=""')
  })

  it("keeps a single for when the label wraps text that repeats the id", () => {
    const html = render(
      <Field id="email" label="email">
        <input id="email" />
      </Field>,
    )

    expect(labelFors(html)).toEqual(["email"])
  })

  it("clones the wiring onto a single element child", () => {
    const html = render(
      <Field id="email" label="Email" error="Required" hint="Work address only">
        <Input id="email" value="" />
      </Field>,
    )

    expect(html).toContain('id="email"')
    expect(html).toContain('aria-describedby="email-error email-hint"')
    expect(html).toContain('id="email-error"')
    expect(html).toContain('id="email-hint"')
    expect(html).toContain('class="input"')
  })

  it("throws instead of rendering undefined when the child is not one element", () => {
    // A multi-child field has no single element to wire: cloning it would put `<undefined id="a">`
    // in the document. The type rejects both of these at the call site — the cast is what a
    // plain-JS caller does, and the throw is what stops it from reaching the DOM.
    const arrayChild = [<input key="a" id="a" />, <input key="b" id="b" />] as unknown as FieldChild
    const textChild = "text" as unknown as FieldChild

    expect(() =>
      render(
        <Field id="a" label="A">
          {arrayChild}
        </Field>,
      )
    ).toThrow(/children must be exactly one element/)
    expect(() =>
      render(
        <Field id="a" label="A">
          {textChild}
        </Field>,
      )
    ).toThrow(/children must be exactly one element/)
  })

  it("keeps the caller's own aria-describedby alongside the messages", () => {
    const html = render(
      <Field id="a" label="A" error="E">
        <input id="a" aria-describedby="own" />
      </Field>,
    )

    expect(html).toContain('aria-describedby="own a-error"')
    expect(html).toContain('id="a-error"')
  })

  it("marks the control invalid while an error shows", () => {
    const withError = render(
      <Field id="a" label="A" error="E">
        <input id="a" />
      </Field>,
    )
    const without = render(
      <Field id="a" label="A" hint="H">
        <input id="a" />
      </Field>,
    )

    expect(withError).toContain('aria-invalid="true"')
    expect(without).not.toContain("aria-invalid")
  })

  it("clones only DOM attributes onto the control, never the message ids", () => {
    const html = render(
      <Field id="email" label="Email" error="Required" hint="Work address only">
        <Input id="email" value="" />
      </Field>,
    )

    // The message ids are for the function child; cloning them onto a real element would render
    // `errorId="email-error"` as an unknown attribute on the control.
    expect(html).not.toContain('errorId="')
    expect(html).not.toContain('hintId="')
  })

  it("hands the wiring to a function child", () => {
    const html = render(
      <Field id="email" label="Email" error="Required">
        {(wiring) => (
          <input
            id={wiring.id}
            aria-describedby={wiring["aria-describedby"]}
            data-error={wiring.errorId}
          />
        )}
      </Field>,
    )

    expect(html).toContain('id="email"')
    expect(html).toContain('aria-describedby="email-error"')
    expect(html).toContain('data-error="email-error"')
  })

  it("renders no error paragraph and no wiring for an empty error", () => {
    const html = render(
      <Field id="email" label="Email" error="">
        <input id="email" />
      </Field>,
    )

    expect(html).not.toContain("email-error")
    expect(html).not.toContain("aria-describedby")
  })

  it("renders the error with a live region pointing at the control's id", () => {
    const html = render(
      <Field id="email" label="Email" error="Enter an address">
        <input id="email" />
      </Field>,
    )

    expect(html).toContain('id="email-error"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("Enter an address")
    expect(html).toContain("text-red-700")
  })

  it("renders the hint under the control", () => {
    const html = render(
      <Field id="email" label="Email" hint="Work address only">
        <input id="email" />
      </Field>,
    )

    expect(html).toContain('id="email-hint"')
    expect(html).toContain("Work address only")
    expect(html).toContain("text-gray-500")
  })

  it("marks a required field on the label and leaves required native to the control", () => {
    const html = render(
      <Field id="email" label="Email" required>
        <input id="email" required />
      </Field>,
    )

    expect(html).toContain('aria-hidden="true"')
    expect(html.match(/required/g)?.length ?? 0).toBeGreaterThan(0)
    expect(labelFors(html)).toEqual(["email"])
  })

  it("dims the label of a disabled field without stealing focus semantics", () => {
    const html = render(
      <Field id="email" label="Email" disabled>
        <input id="email" disabled />
      </Field>,
    )

    expect(html).toContain("opacity-50")
    expect(html).toContain("disabled")
    expect(html).not.toContain("aria-disabled")
  })

  it("puts the caller's class on the wrapper, not on the control", () => {
    const html = render(
      <Field id="email" label="Email" class="sm:col-span-3">
        <Input id="email" />
      </Field>,
    )

    expect(html).toContain('class="sm:col-span-3"')
    expect(html).toContain('id="email"')
  })

  it("renders a control without a label", () => {
    const html = render(
      <Field id="search">
        <input id="search" aria-label="Search" />
      </Field>,
    )

    expect(html).not.toContain("<label")
    expect(html).toContain('aria-label="Search"')
  })
})

/** Every `for` attribute in the markup, in document order. */
function labelFors(html: string): string[] {
  return [...html.matchAll(/for="([^"]*)"/g)].map((match) => match[1])
}
