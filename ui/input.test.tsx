import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Input, Select, Textarea } from "./input.tsx"

describe("Input", () => {
  it("renders the shipped input class", () => {
    const html = render(<Input />)

    expect(html).toContain('class="input"')
    expect(html).toContain("<input")
  })

  it("passes native input attributes straight through", () => {
    const html = render(
      <Input
        type="email"
        name="email"
        value="a@example.com"
        placeholder="you@example.com"
        required
        disabled
        autocomplete="email"
        data-e2e="email"
      />,
    )

    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).toContain('value="a@example.com"')
    expect(html).toContain('placeholder="you@example.com"')
    expect(html).toContain('autocomplete="email"')
    expect(html).toContain('data-e2e="email"')
    expect(html).toContain("required")
    expect(html).toContain("disabled")
  })

  it("renders the caller's value and does not keep a draft of its own", () => {
    const html = render(<Input value="first" onInput={() => {}} />)

    expect(html).toContain('value="first"')
    // An empty value renders as a bare boolean attribute; either shape means "empty", not "absent".
    expect(render(<Input value="" onInput={() => {}} />)).toContain("<input value")
  })

  it("appends a caller class instead of replacing the primitive's", () => {
    const html = render(<Input class="my-3 w-60" />)

    expect(html).toContain("my-3")
    expect(html).toContain("w-60")
    expect(html).toContain("input")
  })

  it("renders an aria-describedby and an id for a Field to point at", () => {
    const html = render(<Input id="email" aria-describedby="email-error" />)

    expect(html).toContain('id="email"')
    expect(html).toContain('aria-describedby="email-error"')
  })
})

describe("Textarea", () => {
  it("renders the shipped textarea class", () => {
    const html = render(<Textarea />)

    expect(html).toContain('class="textarea"')
    expect(html).toContain("<textarea")
  })

  it("passes native textarea attributes straight through", () => {
    const html = render(
      <Textarea name="notes" rows={4} value="hello" placeholder="Notes" required />,
    )

    expect(html).toContain('name="notes"')
    expect(html).toContain('rows="4"')
    expect(html).toContain('placeholder="Notes"')
    expect(html).toContain("hello")
    expect(html).toContain("required")
  })

  it("appends a caller class instead of replacing the primitive's", () => {
    expect(render(<Textarea class="min-h-32" />)).toContain("min-h-32")
    expect(render(<Textarea class="min-h-32" />)).toContain("textarea")
  })
})

describe("Select", () => {
  it("renders the shipped select class", () => {
    const html = render(<Select options={[]} />)

    expect(html).toContain('class="select"')
    expect(html).toContain("<select")
  })

  it("stringifies option values so the renderer matches them unambiguously", () => {
    const html = render(
      <Select
        value="0"
        options={[{ value: 0, label: "Zero" }, { value: 1, label: "One" }]}
      />,
    )

    expect(html).toContain(">Zero</option>")
    expect(html).toContain(">One</option>")
    expect(html).toContain('value="0"')
    expect(html).toContain('value="1"')
    expect(html.match(/selected/g)?.length ?? 0).toBe(1)
    expect(html).toContain('selected value="0"')
  })

  it("checks nothing when the value matches no option", () => {
    const html = render(<Select value="" options={[{ value: 1, label: "One" }]} />)

    expect(html).not.toContain("selected")
  })

  it("renders the placeholder as the leading empty option", () => {
    const html = render(
      <Select placeholder="Choose one" options={[{ value: 1, label: "One" }]} />,
    )

    expect(html.indexOf("Choose one")).toBeLessThan(html.indexOf(">One<"))
    expect(html).not.toContain("selected")
  })

  it("renders no placeholder option when none is asked for", () => {
    const html = render(<Select options={[{ value: 1, label: "One" }]} />)

    expect(html.match(/<option/g)?.length).toBe(1)
  })

  it("passes native select attributes straight through", () => {
    const html = render(<Select name="role" id="role" multiple options={[]} />)

    expect(html).toContain('name="role"')
    expect(html).toContain('id="role"')
    expect(html).toContain("multiple")
  })

  it("appends a caller class instead of replacing the primitive's", () => {
    expect(render(<Select class="mt-2" options={[]} />)).toContain("mt-2")
    expect(render(<Select class="mt-2" options={[]} />)).toContain("select")
  })
})
