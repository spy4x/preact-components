import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import type { ValidationModel } from "@spy4x/validation/model"
import {
  CheckboxField,
  commitNumber,
  FieldIssues,
  NumberField,
  SelectField,
  TextField,
} from "./field.tsx"

interface Form {
  name: string
  zoneId: number
  isOn: boolean
}

const model = (patch: Partial<Form> = {}) =>
  signal<Form>({ name: "North", zoneId: 0, isOn: false, ...patch })
const noIssues = signal<ValidationModel<Form>>({})

/** Every value of an attribute, in document order. */
function attributes(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`\\b${name}="([^"]*)"`, "g"))].map((match) => match[1])
}

/** How many times a boolean attribute is rendered. It carries no value, so `attributes` misses it. */
function count(html: string, name: string): number {
  return [...html.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length
}

describe("TextField", () => {
  it("shows the model's value in the input", () => {
    expect(render(<TextField vm={model()} vl={noIssues} name="name" label="Name" />))
      .toContain(`value="North"`)
  })

  it("renders a `null` value as empty rather than as the text `null`", () => {
    const vm = signal<Form>({ name: null as unknown as string, zoneId: 0, isOn: false })
    expect(render(<TextField vm={vm} vl={noIssues} name="name" label="Name" />))
      .not.toContain("null")
  })

  it("binds the label to the input's own id", () => {
    const html = render(<TextField vm={model()} vl={noIssues} name="name" label="Name" />)
    const [forId] = attributes(html, "for")
    const [inputId] = attributes(html, "id")

    expect(forId).toBeDefined()
    expect(inputId).toBe(forId)
  })

  it("gives two rows on one page different ids", () => {
    const html = render(
      <div>
        <TextField vm={model()} vl={noIssues} name="name" label="Name" />
        <TextField vm={model()} vl={noIssues} name="name" label="Name" />
      </div>,
    )

    const ids = attributes(html, "id")
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    expect([...new Set(attributes(html, "for"))]).toHaveLength(2)
  })

  it("spans the grid cell the caller asks for", () => {
    const html = render(
      <TextField vm={model()} vl={noIssues} name="name" label="Name" span="sm:col-span-6" />,
    )
    expect(html).toContain(`class="sm:col-span-6"`)
  })
})

describe("NumberField", () => {
  it("renders the numeric value as text", () => {
    expect(
      render(<NumberField vm={model({ zoneId: 12 })} vl={noIssues} name="zoneId" label="Zone" />),
    )
      .toContain(`value="12"`)
  })

  it("commits 0 for the empty box a number input reports", () => {
    expect(commitNumber("")).toBe(0)
    expect(commitNumber("  ")).toBe(0)
  })

  it("commits 0 for a half-typed box instead of NaN", () => {
    expect(commitNumber("-")).toBe(0)
    expect(commitNumber("1e")).toBe(0)
  })

  it("commits a parsable number", () => {
    expect(commitNumber(" 12 ")).toBe(12)
    expect(commitNumber("-3.5")).toBe(-3.5)
  })
})

describe("SelectField", () => {
  const options = [{ value: 0, label: "Zero" }, { value: 3, label: "Three" }]

  it("marks the option the model holds as selected", () => {
    const html = render(
      <SelectField
        vm={model({ zoneId: 3 })}
        vl={noIssues}
        name="zoneId"
        label="Zone"
        options={options}
      />,
    )
    expect(html).toContain(`selected value="3"`)
  })

  it("falls back to the empty option when no option carries the model's value", () => {
    const html = render(
      <SelectField
        vm={model({ zoneId: 9 })}
        vl={noIssues}
        name="zoneId"
        label="Zone"
        placeholder="Select zone"
        options={options}
      />,
    )

    expect(html).toContain("Select zone")
    expect(count(html, "selected")).toBe(1)
    expect(html).toContain(`selected value>Select zone`)
  })

  it("selects the zero option for a zero value and not the empty placeholder", () => {
    const html = render(
      <SelectField
        vm={model({ zoneId: 0 })}
        vl={noIssues}
        name="zoneId"
        label="Zone"
        placeholder="Select zone"
        options={options}
      />,
    )

    expect(count(html, "selected")).toBe(1)
    expect(html).toContain(`<option selected value="0">Zero</option>`)
  })

  it("renders every option value as a string the browser can report back", () => {
    const html = render(
      <SelectField
        vm={model({ zoneId: 3 })}
        vl={noIssues}
        name="zoneId"
        label="Zone"
        options={options}
      />,
    )
    expect(attributes(html, "value")).toEqual(["0", "3"])
  })
})

describe("CheckboxField", () => {
  it("reflects the model's boolean", () => {
    expect(
      render(
        <CheckboxField vm={model({ isOn: true })} vl={noIssues} name="isOn" label="Is on" />,
      ),
    ).toContain(`checked`)
  })
})

describe("FieldIssues", () => {
  it("renders nothing for a field with no issues", () => {
    expect(render(<FieldIssues vl={noIssues} name="name" />)).toBe("")
  })

  it("renders the message of the field it belongs to", () => {
    const vl = signal<ValidationModel<Form>>({
      name: { SCHEMA: { message: "name must be non-empty" } },
      zoneId: { NON_UNIQUE: { message: "already in use" } },
    })

    const name = render(<FieldIssues vl={vl} name="name" />)
    expect(name).toContain("name must be non-empty")
    expect(name).not.toContain("already in use")
  })

  it("renders every issue of one field", () => {
    const vl = signal<ValidationModel<Form>>({
      name: {
        SCHEMA: { message: "name must be non-empty" },
        NON_UNIQUE: { message: "already in use" },
      },
    })

    const html = render(<FieldIssues vl={vl} name="name" />)
    expect(html).toContain("name must be non-empty")
    expect(html).toContain("already in use")
  })

  it("lets the caller render an issue itself", () => {
    const vl = signal<ValidationModel<Form>>({
      zoneId: { NON_UNIQUE: { message: "already in use", payload: 7 } },
    })

    const html = render(
      <FieldIssues
        vl={vl}
        name="zoneId"
        renderIssue={(issue) => <a href={`/zones/${issue.payload}/edit`}>{issue.message}</a>}
      />,
    )

    expect(html).toContain(`href="/zones/7/edit"`)
    expect(html).toContain("already in use")
  })
})
