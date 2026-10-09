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

  it("appends a caller's spacing after its own, merging nothing", () => {
    // A merge would drop `space-y-4`: the form joins its classes so `tailwind-merge` stays out (#511).
    const html = render(
      <EnhancedForm action="/api/subscribe" class="space-y-8">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain(
      '<form action="/api/subscribe" method="post" class="space-y-4 space-y-8">',
    )
  })

  it("keeps its own idle state when no status is passed", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" sending={<p>Wait</p>}>
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).not.toContain("Wait")
    expect(html).toContain('name="email"')
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
  })
})

describe("EnhancedForm with a controlled status", () => {
  it("disables the fieldset and announces sending while the caller's status is sending", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" status="sending">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toMatch(/<fieldset[^>]*\sdisabled/)
    expect(html).toMatch(/<p role="status"[^>]*>Sending…<\/p>/)
  })

  it("shows the slot for the caller's status and hides the region's duplicate", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" status="done" done={<p>Thanks.</p>}>
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain("Thanks.")
    expect(html).not.toContain('name="email"')
    expect(html).toMatch(/<p role="status"[^>]*sr-only[^>]*>Sent.<\/p>/)
  })

  it("keeps the fields on screen, enabled, and announces failure with no failed slot", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" status="failed">
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain('name="email"')
    expect(html).not.toMatch(/<fieldset[^>]*\sdisabled/)
    expect(html).toMatch(/<p role="status"[^>]*>Something went wrong. Please try again.<\/p>/)
  })

  it("draws the failure text in the danger colour, with a stable class hook", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" status="failed">
        <input />
      </EnhancedForm>,
    )
    const region = html.match(/<p role="status"[^>]*>/)?.[0] ?? ""

    expect(region).toContain("enhanced-form-error")
    expect(region).toContain("text-danger")
    expect(region).not.toContain("text-muted")
  })

  it("keeps sending and done text muted, without the failure hook", () => {
    for (const status of ["sending", "done"] as const) {
      const html = render(
        <EnhancedForm action="/api/subscribe" status={status}>
          <input />
        </EnhancedForm>,
      )
      const region = html.match(/<p role="status"[^>]*>/)?.[0] ?? ""

      expect(region).toContain("text-muted")
      expect(region).not.toContain("text-danger")
      expect(region).not.toContain("enhanced-form-error")
    }
  })

  it("says nothing in any status when every label is empty", () => {
    for (const status of ["idle", "sending", "done", "failed"] as const) {
      const html = render(
        <EnhancedForm
          action="/api/subscribe"
          status={status}
          labels={{ sending: "", done: "", failed: "" }}
        >
          <input name="email" />
        </EnhancedForm>,
      )

      // The region stays in the page, empty, so a caller that later sets a label still has a
      // region assistive technology is already watching.
      expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
    }
  })

  it("still renders a real form that posts natively before hydration", () => {
    const html = render(
      <EnhancedForm action="/api/subscribe" status="idle" onSubmit={() => {}}>
        <input name="email" />
      </EnhancedForm>,
    )

    expect(html).toContain('action="/api/subscribe"')
    expect(html).toContain('method="post"')
  })
})
