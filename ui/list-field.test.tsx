import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ListField } from "./list-field.tsx"

const noop = () => {}

describe("ListField", () => {
  it("draws one named input per line inside a group named by its legend", () => {
    const html = render(
      <ListField
        id="points"
        label="Key points"
        value={["One", "Two"]}
        onChange={noop}
        name="tldr"
      />,
    )
    expect(html).toContain("<fieldset")
    expect(html).toContain('<legend class="pc-label">Key points</legend>')
    expect(html).toContain('id="points"')
    expect(html).toContain('id="points-1"')
    expect(html).toContain('aria-label="Item 1"')
    expect(html).toContain('aria-label="Item 2"')
    expect(html.match(/name="tldr"/g)?.length).toBe(2)
    expect(html).toContain('value="Two"')
    expect(html).toContain('aria-label="Remove item 2"')
  })

  it("offers the add button and the count below the limit", () => {
    const html = render(
      <ListField id="p" label="Points" value={["One"]} onChange={noop} max={5} />,
    )
    expect(html).toContain("Add item")
    expect(html).toContain("1 of 5")
  })

  it("hides the add button once the list holds max lines", () => {
    const html = render(
      <ListField id="p" label="Points" value={["a", "b"]} onChange={noop} max={2} />,
    )
    expect(html).not.toContain("Add item")
    expect(html).toContain("2 of 2")
  })

  it("draws no empty list, only the add button, when there are no lines", () => {
    const html = render(<ListField id="p" label="Points" value={[]} onChange={noop} />)
    expect(html).not.toContain("<ol")
    expect(html).toContain("Add item")
  })

  it("ties the error and the hint to the group and marks every line invalid", () => {
    const html = render(
      <ListField
        id="p"
        label="Points"
        value={["a", "b"]}
        onChange={noop}
        error="Keep each point short."
        hint="Up to five."
      />,
    )
    expect(html).toContain('aria-describedby="p-error p-hint"')
    expect(html).toContain('<p id="p-error"')
    expect(html).toContain('<p id="p-hint"')
    expect(html.match(/aria-invalid="true"/g)?.length).toBe(2)
  })

  it("takes its words from labels", () => {
    const html = render(
      <ListField
        id="p"
        label="Points"
        value={["a"]}
        onChange={noop}
        max={3}
        labels={{
          item: (n) => `Point ${n}`,
          remove: (n) => `Remove point ${n}`,
          add: "Add point",
          count: (n, max) => `${n}/${max}`,
        }}
      />,
    )
    for (
      const text of ['aria-label="Point 1"', 'aria-label="Remove point 1"', "Add point", "1/3"]
    ) {
      expect(html).toContain(text)
    }
  })
})
