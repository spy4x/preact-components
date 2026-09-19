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
      <Field id="archive" label="Archived" error="Pick a state" labelFor={false}>
        <Checkbox id="archive" checked={false} />
      </Field>,
    )

    // A `for` here would point at the checkbox's `<label>`, which is not a labelable element: the
    // reference resolves against nothing, and the control ends up with two labels naming it.
    expect(html).not.toContain("for=")
    expect(html).toContain('id="archive"')
    expect(html).toContain('aria-describedby="archive-error"')
    // One label names the control — the one that wraps the box. The `Field` label is still rendered
    // above it as the row's visual heading; it claims nothing.
    expect(labelAssociations(html, "archive")).toEqual([0, 1])
  })

  it("is named twice when Field keeps its default for", () => {
    // The markup the issue reports, asserted so the test above is not a tautology, and so a
    // caller who migrates sees exactly what changes.
    const html = render(
      <Field id="archive" label="Archived" error="Pick a state">
        <Checkbox id="archive" checked={false} />
      </Field>,
    )

    expect(html).toContain('for="archive"')
    // `[forTargets, labelAncestors]`: `Field`'s label points at the checkbox and the checkbox's own
    // label contains its input — two label elements naming one control, neither wrapping the other.
    expect(labelAssociations(html, "archive")).toEqual([1, 1])
  })
})

/**
 * The two ways a `<label>` can name the control carrying `id`, counted separately.
 *
 * Per the HTML spec a label names a control either by `for` or by containing it, which is how
 * `Checkbox` binds its `<input>`. Keeping the two columns apart is what makes the duplicate visible:
 * `Field`'s label points at the control from above and never wraps it, so the opt-out reports
 * `[0, 1]` and the default reports `[1, 1]` — one control, two label elements.
 *
 * The control is the innermost element carrying the `id`, because a label that contains the control
 * also contains whatever contains it.
 */
function labelAssociations(
  html: string,
  id: string,
): [forTargets: number, labelAncestors: number] {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const openingTags = [
    ...html.matchAll(new RegExp(`<[a-z]+[^>]*\\bid="${escaped}"[^>]*>`, "g")),
  ].map((match) => match[0])
  const forTargets =
    [...html.matchAll(/(?<![-\w])for="([^"]*)"/g)].filter((match) => match[1] === id).length
  const labelAncestors = openingTags.length === 0 ? 0 : html.split("<label").slice(1).filter(
    (part) => part.includes(openingTags[openingTags.length - 1]),
  ).length
  return [forTargets, labelAncestors]
}
