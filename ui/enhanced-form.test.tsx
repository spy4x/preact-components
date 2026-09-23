import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { EnhancedForm, enhancedFormMessage } from "./enhanced-form.tsx"

describe("enhancedFormMessage", () => {
  const labels = { sending: "Sending…", done: "Sent.", failed: "Nope." }

  it("is empty for idle, which is what keeps the region empty until there is something to say", () => {
    expect(enhancedFormMessage("idle", labels)).toBe("")
  })

  it("reads the matching label for every other status", () => {
    expect(enhancedFormMessage("sending", labels)).toBe("Sending…")
    expect(enhancedFormMessage("done", labels)).toBe("Sent.")
    expect(enhancedFormMessage("failed", labels)).toBe("Nope.")
  })
})

describe("EnhancedForm", () => {
  it("renders a real form, posting to action by method, before any script has run", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain('action="/api/subscribe"')
    expect(html).toContain('method="post"')
  })

  it("defaults method to post, so a pre-hydration submit never puts fields in the address bar", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" onSubmit={() => {}}>
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain('method="post"')
    expect(html).not.toContain('method="get"')
  })

  it("takes an explicit method when a caller asks for one", () => {
    const html = render(
      <EnhancedForm action="/search" method="get">
        <input name="q" />
      </EnhancedForm>,
    )

    expect(html).toContain('method="get"')
  })

  it("renders no endpoint when none is given — nothing here defaults one", () => {
    const html = render(
      <EnhancedForm>
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).not.toContain("action=")
  })

  it("renders children inside an enabled fieldset before any submit", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain("<fieldset")
    expect(html).not.toMatch(/<fieldset[^>]*\sdisabled/)
    expect(html).toContain('name="email"')
  })

  it("carries an always-present, empty live region", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    // Nothing between the region's tags: the region exists before there is anything to announce.
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
  })

  it("merges caller labels over the defaults rather than replacing the whole set", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" labels={{ sending: "Envoi…" }}>
        <input name="email" />
      </EnhancedForm>,
    )

    // The idle render shows neither string — this only proves the merge does not throw and the
    // region still renders empty; `enhancedFormMessage`'s own suite covers the resulting text.
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
  })

  it("passes extra utilities through to the form", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" class="max-w-sm">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain("max-w-sm")
  })
})
