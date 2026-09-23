import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { HONEYPOT_FIELD_NAME, honeypotField, honeypotFilled } from "./honeypot.tsx"

describe("honeypotField", () => {
  it("renders off-screen, out of the tab order and hidden from assistive technology", () => {
    const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain(`name="${HONEYPOT_FIELD_NAME}"`)
    expect(html).toContain("Leave this field blank")
  })

  it("is a real, submittable text input rather than type=hidden or display:none", () => {
    // A bot that already skips those two is the one thing this trap does not catch — see the
    // component's own doc. `type="text"` and no `display: none` are the point.
    const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

    expect(html).toContain('type="text"')
    expect(html).not.toContain("display:none")
    expect(html).not.toContain("display: none")
  })
})

describe("honeypotFilled", () => {
  it("is false when the field was never filled in", () => {
    const data = new FormData()
    expect(honeypotFilled(data)).toBe(false)
  })

  it("is false when the field is present but empty", () => {
    const data = new FormData()
    data.set(HONEYPOT_FIELD_NAME, "")
    expect(honeypotFilled(data)).toBe(false)
  })

  it("is true once something filled it in", () => {
    const data = new FormData()
    data.set(HONEYPOT_FIELD_NAME, "http://spam.example")
    expect(honeypotFilled(data)).toBe(true)
  })

  it("reads a caller-chosen field name instead of the default", () => {
    const data = new FormData()
    data.set("company-site", "http://spam.example")
    expect(honeypotFilled(data)).toBe(false)
    expect(honeypotFilled(data, "company-site")).toBe(true)
  })
})
