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
      <Field id="notification-method" label="Notification method" hint="Where alerts go">
        <RadioGroup
          legend="Notification method"
          name="notification-method"
          options={methods}
          id="notification-method"
        />
      </Field>,
    )

    expect(html.match(/for="notification-method"/g)?.length).toBe(1)
  })
})
