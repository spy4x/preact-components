import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { HONEYPOT_FIELD_NAME } from "@spy4x/platform/universal/honeypot"
import { honeypotField } from "./honeypot.tsx"

describe("honeypotField", () => {
  it("renders off-screen, out of the tab order and hidden from assistive technology", () => {
    const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain(`name="${HONEYPOT_FIELD_NAME}"`)
    expect(html).toContain("Leave this field blank")
  })

  it("is a real, submittable text input rather than type=hidden", () => {
    // A bot that already skips a hidden input is the one thing this trap does not catch — see the
    // component's own doc.
    const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

    expect(html).toContain('type="text"')
  })

  it(
    "marks the source markup as not using display:none — a real browser check in " +
      "pages/checks/ui.ts proves the computed style, which this cannot",
    () => {
      // A literal string absent from the markup is weak evidence on its own — a `class` naming a
      // Tailwind utility that happens to compute to `display: none` some other way would still pass
      // this — so `enhancedFormsHoneypotChecks` reads `getComputedStyle` in a real browser instead.
      // This only guards the one thing a render-to-string test legitimately can: nobody wrote the
      // literal declaration by hand.
      const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

      expect(html).not.toContain("display:none")
      expect(html).not.toContain("display: none")
    },
  )

  it("turns autofill off, so a browser's own suggestions cannot fill a field it should never fill", () => {
    const html = render(honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank"))

    expect(html).toContain('autocomplete="off"')
  })
})
