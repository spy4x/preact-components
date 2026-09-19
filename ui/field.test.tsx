import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Checkbox } from "./checkbox.tsx"
import { Field, type FieldChild, labelTarget } from "./field.tsx"
import { Input, Select, Textarea } from "./input.tsx"
import { RadioGroup } from "./radio.tsx"

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

    // Every `for`-shaped token, not just the well-formed ones. `labelFors` reads `for="…"` only, so
    // the two ways this wiring breaks are invisible to it: `preact-render-to-string` writes
    // `for=""` as the **bare** attribute (`<label for>A</label>`), and `for={undefined}` as no
    // attribute at all — the latter is the renderer's own behaviour, which is why the assertion that
    // used to sit here was `not.toContain('for=""')`: that string never appears, so it could not
    // fail. `forTokens` answers `[""]` and `[]` for the two broken forms, so this is the assertion
    // that goes red for them.
    expect(forTokens(html)).toEqual(["email"])
    expect(labelFors(html)).toEqual(["email"])
    expect(html.match(/id="email"/g)).toEqual(['id="email"'])
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

/**
 * The `for` of a `Field` label resolves only against a labelable element, and the defect these tests
 * exist for was that no test ever checked the *target*: a `for` aimed at a `<fieldset>` or at a
 * `<label>` is a dead reference, and counting `for=` occurrences passes over it. `labelable(html)`
 * is the missing half — every `for` a `Field` emits is resolved against the rendered markup.
 */
describe("Field label target", () => {
  it("emits no for at all for labelFor={false}", () => {
    const html = render(
      <Field id="search" label="Search" labelFor={false}>
        <input id="search" />
      </Field>,
    )

    expect(html).toContain('class="label"')
    expect(html).not.toContain("for=")
    // The control still carries the id, so aria-describedby keeps working.
    expect(html).toContain('id="search"')
  })

  it("keeps aria-describedby wired to the control when the label has no for", () => {
    const html = render(
      <Field id="archive" label="Archived" labelFor={false} error="Pick a state">
        <input id="archive" />
      </Field>,
    )

    expect(html).toContain('aria-describedby="archive-error"')
    expect(html).toContain('id="archive-error"')
    expect(html).not.toContain("for=")
  })

  it("aims the label at an explicit element id instead of the control's", () => {
    const html = render(
      <Field id="wrap" label="Email" labelFor="inner">
        <div id="wrap">
          <input id="inner" />
        </div>
      </Field>,
    )

    expect(labelFors(html)).toEqual(["inner"])
    expect(labelable(html)).toEqual(["inner"])
  })

  it('throws rather than rendering for="" for an unusable labelFor', () => {
    // A plain-JS caller never sees the type, and `for=""` is a reference to nothing — the same
    // reasoning as the children check: fail loudly instead of emitting a stray attribute.
    for (const labelFor of ["", 0, null] as unknown as (string | boolean | null)[]) {
      expect(() =>
        render(
          <Field id="a" label="A" labelFor={labelFor as string}>
            <input id="a" />
          </Field>,
        )
      ).toThrow(/labelFor must be/)
    }
  })
})

describe("labelTarget", () => {
  it("resolves the accepted values", () => {
    // `undefined` is the absent prop, and the prop's default is `true`: a caller who passes nothing
    // keeps the label wired to the field's own control.
    expect(labelTarget(undefined, "email")).toBe("email")
    expect(labelTarget(true, "email")).toBe("email")
    expect(labelTarget("other", "email")).toBe("other")
    expect(labelTarget(false, "email")).toBeUndefined()
  })

  it("rejects a labelFor that could only resolve to nothing", () => {
    expect(() => labelTarget("", "email")).toThrow(/labelFor must be/)
    expect(() => labelTarget(1 as unknown as boolean, "email")).toThrow(/labelFor must be/)
  })
})

/**
 * A labelable control keeps its `for`, by rendered markup.
 *
 * The guard against `labelFor={false}` over-reaching: a caller who passes one of these and forgets
 * the prop still gets a working label, because the default is `true` and the target *is* labelable.
 */
describe("Field labelable controls", () => {
  // Built per test rather than held as elements: a shared element in a list would need a `key` it
  // has no use for, and `Field` renders each one on its own.
  const controls: [string, () => FieldChild][] = [
    ["input", () => <input id="email" />],
    ["input of type email", () => <Input id="email" type="email" value="" />],
    ["select", () => <Select id="email" options={[{ value: "a", label: "A" }]} />],
    ["textarea", () => <Textarea id="email" value="" />],
    ["button", () => <button id="email" type="submit">Send</button>],
  ]

  for (const [name, control] of controls) {
    it(`keeps for when the child is a ${name}`, () => {
      const html = render(<Field id="email" label="Email">{control()}</Field>)

      expect(labelFors(html)).toEqual(["email"])
      expect(labelable(html)).toEqual(["email"])
      // One label names the control: the `for` points at it and no label wraps it, so the two
      // counts are the same element rather than two.
      expect(labelAssociations(html, "email")).toEqual([1, 0])
    })
  }
})

/**
 * The controls the issue names: each owns its own labelling, so the `Field` label must not claim it.
 *
 * Rendered through the real call site — `Field` wrapping the shipped component — because the defect
 * was in exactly that composition, not in `Field` alone.
 */
describe("Field around a self-labelling control", () => {
  it("emits no for at all when the child is a RadioGroup", () => {
    const html = render(
      <Field id="notification-method" label="Notification method" labelFor={false}>
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={[{ value: "email", label: "Email" }]}
          id="notification-method"
        />
      </Field>,
    )

    expect(html).toContain("<fieldset")
    expect(html).not.toContain("for=")
    expect(html).toContain('id="notification-method"')
  })

  it("emits no for at all when the child is a Checkbox", () => {
    const html = render(
      <Field id="archive" label="Archived" labelFor={false}>
        <Checkbox id="archive" checked={false}>Archived</Checkbox>
      </Field>,
    )

    expect(html).not.toContain("for=")
    expect(html).toContain('id="archive"')
  })

  it("names a Field-wrapped Checkbox with exactly one label element", () => {
    const html = render(
      <Field id="archive" label="Archived" labelFor={false} hint="Hides the row">
        <Checkbox id="archive" checked={false}>Archived</Checkbox>
      </Field>,
    )

    // Two labels naming one checkbox — `Field`'s `for`, plus the `<label>` the checkbox renders
    // around its own input — is the duplicate labelling the issue reports. With `labelFor={false}`
    // the control is named once, by the label that wraps it, and `Field`'s label is a visual heading
    // that claims nothing.
    expect(labelAssociations(html, "archive")).toEqual([0, 1])
    expect(html).toContain('<label class="label gap-2 items-center"><input id="archive"')
    expect(html).toContain('aria-describedby="archive-hint"')
  })

  it("still counts as two labels when the default for is left in place", () => {
    // The same field without the opt-out: this is the markup the issue reports, and the reason the
    // assertion above is not a tautology: `Field`'s `for` label and the checkbox's own wrapping
    // label are two different elements naming one control, and neither wraps the other.
    const html = render(
      <Field id="archive" label="Archived">
        <Checkbox id="archive" checked={false}>Archived</Checkbox>
      </Field>,
    )

    expect(labelAssociations(html, "archive")).toEqual([1, 1])
    expect(html).toContain('for="archive"')
    // Two `<label>` elements really are rendered, and the two counts above are what makes them a
    // duplicate rather than one association written twice: `Field`'s label sits above the control and
    // holds none of the checkbox's own contents.
    expect(html.match(/<label/g)?.length).toBe(2)
    expect(html).toContain('</label><div class="mt-2"><label')
  })

  it("claims nothing when the child is a RadioGroup", () => {
    const html = render(
      <Field id="notification-method" label="Notification method" labelFor={false}>
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={[{ value: "email", label: "Email" }]}
          id="notification-method"
        />
      </Field>,
    )

    // The whole point of the issue: no `for` may point at a `<fieldset>`.
    expect(labelFors(html)).toEqual([])
    expect(html).not.toContain("for=")
    // The field's own label is still rendered — it is the row's visual heading — but it is not the
    // element that names the group: the `<legend>` is, and each radio is named by the `<label>`
    // wrapping it. `radio.test.tsx` asserts those counts on this same composition.
    expect(html.match(/<label class="label">/g)?.length).toBe(1)
    expect(html).toContain("<legend")
    expect(html).toContain('id="notification-method"')
  })
})

/**
 * `for` values whose target is not a labelable element.
 *
 * A regression guard for the count-only assertion the issue points at: this markup has exactly one
 * `for` and that `for` is still wrong.
 */
describe("labelable", () => {
  it("rejects a for aimed at a fieldset", () => {
    const html = '<label for="g">G</label><fieldset id="g"><legend>G</legend></fieldset>'

    expect(labelFors(html)).toEqual(["g"])
    expect(labelable(html)).toEqual([])
  })

  it("rejects a for aimed at a label", () => {
    const html = '<label for="c">C</label><label id="c"><input type="checkbox" /></label>'

    expect(labelable(html)).toEqual([])
  })

  it("rejects a for aimed at an input of type hidden", () => {
    expect(labelable('<label for="h">H</label><input id="h" type="hidden" />')).toEqual([])
    expect(labelable('<label for="h">H</label><input type="hidden" id="h" />')).toEqual([])
  })

  it("rejects a for that resolves to nothing", () => {
    expect(labelable('<label for="missing">M</label>')).toEqual([])
  })

  it("accepts every labelable element the spec names", () => {
    const elements = [
      '<button id="e"></button>',
      '<input id="e" />',
      '<meter id="e"></meter>',
      '<output id="e"></output>',
      '<progress id="e"></progress>',
      '<select id="e"></select>',
      '<textarea id="e"></textarea>',
    ]

    for (const element of elements) {
      expect(labelable(`<label for="e">E</label>${element}`)).toEqual(["e"])
    }
  })
})

/** Every `for` attribute in the markup, in document order. */
function labelFors(html: string): string[] {
  return [...html.matchAll(/(?<![-\w])for="([^"]*)"/g)].map((match) => match[1])
}

/**
 * Every `for`-shaped token in the markup, well-formed or not, as its attribute value.
 *
 * The superset of {@link labelFors} that a broken `Field` wiring shows up in. `preact-render-to-string`
 * renders `for=""` as the bare attribute `<label for>` — no `=`, so `labelFors` skips it — and
 * `for={undefined}` as no attribute at all, which `labelFors` cannot report either. Both answer `""`
 * here, while a well-formed `for="email"` answers `"email"`, so one list asserts the value and the
 * absence of the stray forms together.
 */
function forTokens(html: string): string[] {
  const values = [...html.matchAll(/(?<![-\w])for="([^"]*)"/g)].map((match) => match[1])
  const bare = html.match(/(?<![-\w])for(?=[\s>/])/g) ?? []
  return [...values, ...bare.map(() => "")]
}

/**
 * The two ways a `<label>` can name the control carrying `id`, counted separately.
 *
 * Per the HTML spec a label names a control either by `for`, or by containing it — which is how
 * `Checkbox` and `Radio` bind their `<input>`. Counting only `for`s is what let the original defect
 * pass, and the two belong in separate columns here rather than in one total: `Field`'s label points
 * at the control from above and never wraps it, so a control named once reports `[1, 0]`, while
 * `Field` wrapping a `Checkbox` reports `[1, 1]` — the two label elements the issue complains about.
 *
 * A label counted in the second column is one whose markup contains the control, so it may in turn
 * be contained by another element with the same `id`; nested ids are not unreserved here, unlike
 * `findById`. A `<fieldset>` is the case in point: `RadioGroup` stamps the group's `id` on it, so any
 * label around a radio inside that fieldset counts for the group as well. The tests that assert on a
 * group therefore assert on the rendered `for` attributes and on the radio ids instead.
 */
function labelAssociations(
  html: string,
  id: string,
): [forTargets: number, labelAncestors: number] {
  const forTargets = labelFors(html).filter((target) => target === id).length
  const labelAncestors = html.split("<label").slice(1).filter((part) => {
    const tag = part.slice(0, part.indexOf(">"))
    return !tag.includes(`for="${id}"`) && containsId(part, id)
  }).length
  return [forTargets, labelAncestors]
}

/**
 * Whether an element carrying `id` appears inside `markup` — a cheap containment test over rendered
 * markup, used only as a marker for the single control the tests render.
 *
 * An `id` cannot contain a space or a quote, so the boundaries are enough: the ` id="` stops a
 * longer id that merely starts with this one, and the `<` in front of it counts id prefixes out
 * (`notification-method-0` must not answer a marker for `notification-method`). A DOM harness would
 * answer this exactly; this repo has none, so the tests stay on markup.
 */
function containsId(markup: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`<[a-z-]+[^>]* id="${escaped}"(?:[ /]|>)`).test(markup)
}

/**
 * The opening tags of every element carrying `id="<id>"`.
 *
 * Attributes are only ever single- or double-quoted by `preact-render-to-string`, and an id cannot
 * contain an unescaped `>`, so a generous character class is enough and saves hand-rolling a parser
 * (browser-only anyway).
 */
function findById(html: string, id: string): string[] {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [...html.matchAll(new RegExp(`<[a-z]+[^>]*\\bid="${escaped}"[^>]*>`, "g"))].map(
    (match) => match[0],
  )
}

/**
 * The `for` targets that resolve to a **labelable** element in the same markup.
 *
 * Per the HTML spec the labelable set is `button`, `input` of a type other than `hidden`, `meter`,
 * `output`, `progress`, `select` and `textarea`. A `<fieldset>` and a `<label>` are not in it, so a
 * `for` pointing at either is a dead reference. This is what the count-only assertion the issue
 * complains about never checked.
 */
function labelable(html: string): string[] {
  return labelFors(html).filter((target) => {
    const [element] = findById(html, target)
    if (element === undefined) return false
    const tag = element.match(/^<([a-z]+)/)?.[1]
    if (tag === "input") return !/\btype="hidden"/.test(element)
    return ["button", "meter", "output", "progress", "select", "textarea"].includes(tag ?? "")
  })
}
