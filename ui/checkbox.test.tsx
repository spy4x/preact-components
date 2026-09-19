import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Checkbox } from "./checkbox.tsx"
import { Field } from "./field.tsx"

describe("Checkbox", () => {
  it("renders the shipped checkbox class on a native checkbox", () => {
    const html = render(<Checkbox>Archive</Checkbox>)

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('class="checkbox"')
  })

  it("binds the box to its label by wrapping it", () => {
    const html = render(<Checkbox>Archive</Checkbox>)

    expect(html).toContain('<label class="label gap-2 items-center"')
    expect(html.indexOf("<label")).toBeLessThan(html.indexOf("<input"))
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf("Archive"))
    expect(html.indexOf("Archive")).toBeLessThan(html.indexOf("</label>"))
    expect(html).not.toContain("for=")
  })

  it("renders the checked state from the prop", () => {
    expect(render(<Checkbox checked>On</Checkbox>)).toContain("checked")
    expect(render(<Checkbox checked={false}>Off</Checkbox>)).not.toContain("checked")
  })

  it("passes native checkbox attributes straight through", () => {
    const html = render(
      <Checkbox name="archive" value="1" id="archive" disabled data-e2e="archive">
        Archive
      </Checkbox>,
    )

    expect(html).toContain('name="archive"')
    expect(html).toContain('value="1"')
    expect(html).toContain('id="archive"')
    expect(html).toContain('data-e2e="archive"')
    expect(html).toContain("disabled")
  })

  it("names an unlabelled checkbox through aria-label", () => {
    expect(render(<Checkbox aria-label="Select row" />)).toContain('aria-label="Select row"')
  })

  it("keeps the caller's box class and wrapper class apart", () => {
    const html = render(<Checkbox class="mr-2" labelClass="mt-4">Archive</Checkbox>)

    expect(html).toContain("checkbox mr-2")
    expect(html).toContain("label gap-2 items-center mt-4")
  })

  it("fits the Field contract, whose wiring reaches the box", () => {
    const html = render(
      <Field id="archive" label="Archived" error="Pick a state">
        <Checkbox id="archive" checked={false} />
      </Field>,
    )

    expect(html).toContain('for="archive"')
    expect(html).toContain('id="archive"')
    expect(html).toContain('aria-describedby="archive-error"')
  })
})
