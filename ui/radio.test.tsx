import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Field } from "./field.tsx"
import { Radio, RadioGroup } from "./radio.tsx"

/**
 * The group the tests render.
 *
 * Every assertion here is markup and ARIA wiring: the repo has no DOM harness, so arrow-key
 * navigation itself is not exercised. What is asserted is the property that gives it to the browser —
 * one shared `name` and no reimplemented roving tab stop.
 */
const methods = [
  { value: "email", label: "Email" },
  { value: "sms", label: "Phone (SMS)" },
  { value: "push", label: "Push notification" },
]

describe("Radio", () => {
  it("renders the shipped radio class on a native radio", () => {
    const html = render(<Radio name="notification-method" value="email">Email</Radio>)

    expect(html).toContain('type="radio"')
    expect(html).toContain('class="radio"')
  })

  it("binds the choice to its label by wrapping it", () => {
    const html = render(<Radio name="m" value="email">Email</Radio>)

    expect(html).toContain('<label class="label gap-2 items-center"')
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf("Email"))
    expect(html.indexOf("Email")).toBeLessThan(html.indexOf("</label>"))
    expect(html).not.toContain("for=")
  })

  it("renders the checked state from the prop, not from the option", () => {
    expect(render(<Radio name="m" value="email" checked />)).toContain("checked")
    expect(render(<Radio name="m" value="email" checked={false} />)).not.toContain("checked")
  })

  it("keeps the caller's box class and wrapper class apart", () => {
    const html = render(<Radio class="size-5" labelClass="mt-4">Email</Radio>)

    expect(html).toContain("radio size-5")
    expect(html).toContain("label gap-2 items-center mt-4")
  })
})

describe("RadioGroup", () => {
  it("names the group with a legend on a fieldset", () => {
    const html = render(
      <RadioGroup legend="Notification method" name="notification-method" options={methods} />,
    )

    expect(html).toContain("<fieldset")
    expect(html).toContain("<legend")
    expect(html).toContain("Notification method")
    expect(html).toContain('class="label mb-2"')
    expect(html.indexOf("<legend")).toBeLessThan(html.indexOf("<input"))
  })

  it("adds no role that the native elements already carry", () => {
    const html = render(
      <RadioGroup legend="Notification method" name="notification-method" options={methods} />,
    )

    expect(html).not.toContain("radiogroup")
    expect(html).not.toContain('role="radio"')
    expect(html).not.toContain("aria-checked")
    expect(html).not.toContain("tabindex")
  })

  it("shares one name across the group so the platform owns arrow keys and the tab stop", () => {
    const html = render(
      <RadioGroup legend="Notification method" name="notification-method" options={methods} />,
    )

    expect(html.match(/name="notification-method"/g)?.length).toBe(3)
    expect(html.match(/type="radio"/g)?.length).toBe(3)
  })

  it("checks exactly the option the value selects", () => {
    const html = render(
      <RadioGroup
        legend="Notification method"
        name="notification-method"
        options={methods}
        value="sms"
      />,
    )

    expect(html.match(/checked/g)?.length).toBe(1)
    expect(html).toContain('value="sms" checked')
  })

  it("checks nothing when the value matches no option", () => {
    const html = render(
      <RadioGroup
        legend="Notification method"
        name="notification-method"
        options={methods}
        value="pigeon"
      />,
    )

    expect(html).not.toContain("checked")
  })

  it("checks nothing for a null value", () => {
    expect(
      render(
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={methods}
          value={null}
        />,
      ),
    ).not.toContain("checked")
  })

  it("stringifies option values so a numeric choice stays comparable", () => {
    const html = render(
      <RadioGroup legend="Depth" name="depth" options={[{ value: 0, label: "Zero" }]} value={0} />,
    )

    expect(html).toContain('value="0" checked')
  })

  it("disables a single option without disabling the group", () => {
    const html = render(
      <RadioGroup
        legend="Notification method"
        name="notification-method"
        options={[{ value: "email", label: "Email", disabled: true }, ...methods.slice(1)]}
      />,
    )

    expect(html.match(/disabled/g)?.length).toBe(1)
  })

  it("passes fieldset attributes straight through", () => {
    const html = render(
      <RadioGroup
        legend="Notification method"
        name="notification-method"
        options={methods}
        id="notification-method"
        disabled
        class="sm:col-span-3"
      />,
    )

    expect(html).toContain('id="notification-method"')
    expect(html).toContain("sm:col-span-3")
    expect(html.match(/disabled/g)?.length).toBe(1)
  })

  it("derives radio ids from the group id when one is given", () => {
    const html = render(
      <RadioGroup
        legend="Notification method"
        name="notification-method"
        options={methods}
        id="notification-method"
      />,
    )

    expect(html).toContain('id="notification-method-0"')
    expect(html).toContain('id="notification-method-2"')
  })

  it("renders no ids for radios the wrapping labels already name", () => {
    const html = render(
      <RadioGroup legend="Notification method" name="notification-method" options={methods} />,
    )

    expect(html).not.toContain("id=")
  })

  it("fits the Field contract", () => {
    const html = render(
      <Field
        id="notification-method"
        label="Notification method"
        hint="Where alerts go"
        labelFor={false}
      >
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={methods}
          id="notification-method"
        />
      </Field>,
    )

    // Counting `for=` was the whole assertion here, and it passed over the defect: the one `for`
    // it counted pointed at a `<fieldset>`, which is not a labelable element — no `for` can resolve
    // against it. Asserting the *target* is what closes that gap.
    expect(html.match(/for=/g)).toBeNull()
    expect(html).not.toContain('for="notification-method"')
    expect(html).toContain('id="notification-method"')
    expect(html).toContain('aria-describedby="notification-method-hint"')
  })

  it("names each radio through its own label, and the group through its legend", () => {
    const html = render(
      <Field
        id="notification-method"
        label="Notification method"
        hint="Where alerts go"
        labelFor={false}
      >
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={methods}
          id="notification-method"
        />
      </Field>,
    )

    // One `<legend>` names the group; each radio is named by the `<label>` wrapping it, and by
    // nothing else — the fieldset's `id` is not a label target and the group's radios carry no `for`.
    expect(labelsNaming(html, "notification-method-0")).toBe(1)
    expect(html.match(/<legend/g)?.length).toBe(1)
    expect(html).toContain(
      '<label class="label gap-2 items-center"><input id="notification-method-0"',
    )
  })

  it("still emits the dead for without the Field opt-out", () => {
    // The default is unchanged, so an unmigrated caller keeps its old markup — and the assertion
    // above is not a tautology. This is the exact case the issue reports.
    const html = render(
      <Field id="notification-method" label="Notification method">
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={methods}
          id="notification-method"
        />
      </Field>,
    )

    expect(html.match(/for=/g)?.length).toBe(1)
    expect(html).toContain('for="notification-method"')
    expect(html).toContain('id="notification-method"')
    // The target is the `<fieldset>`, which no `for` can resolve against: `labelable` is the
    // assertion the old count-only line was missing.
    expect(labelable(html)).toEqual([])
  })
})

/** Every `for` attribute value in the markup, in document order. */
function labelFors(html: string): string[] {
  return [...html.matchAll(/(?<![-\w])for="([^"]*)"/g)].map((match) => match[1])
}

/**
 * How many `<label>` elements name the control carrying `id`.
 *
 * Both association mechanisms count: an explicit `for`, and being the control's own ancestor, which
 * is how `Radio` binds its `<input>`. They are alternatives, not separate labels, so the answer is
 * the larger of the two rather than their sum.
 *
 * Only the innermost element carrying the `id` is the control: a `RadioGroup`'s fieldset `id` also
 * prefixes the `id` of every radio inside it, and those radios are not what a marker for the group
 * is looking at.
 */
function labelsNaming(html: string, id: string): number {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const tags = [...html.matchAll(new RegExp(`<[a-z]+[^>]*\\bid="${escaped}"[^>]*>`, "g"))].map(
    (match) => match[0],
  )
  const control = tags[tags.length - 1]
  if (control === undefined) return 0
  const forCount = labelFors(html).filter((target) => target === id).length
  const wrapping = html.split("<label").slice(1).filter((part) => part.includes(control)).length
  return Math.max(forCount, wrapping)
}

/**
 * The `for` targets that resolve to a **labelable** element in the same markup.
 *
 * Per the HTML spec that set is `button`, `input` of a type other than `hidden`, `meter`, `output`,
 * `progress`, `select` and `textarea`. A `<fieldset>` is not in it — the flaw this suite used to
 * assert its way past.
 */
function labelable(html: string): string[] {
  return labelFors(html).filter((target) => {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const [element] = html.match(new RegExp(`<[a-z]+[^>]*\\bid="${escaped}"[^>]*>`)) ?? []
    if (element === undefined) return false
    const tag = element.match(/^<([a-z]+)/)?.[1]
    if (tag === "input") return !/\btype="hidden"/.test(element)
    return ["button", "meter", "output", "progress", "select", "textarea"].includes(tag ?? "")
  })
}
