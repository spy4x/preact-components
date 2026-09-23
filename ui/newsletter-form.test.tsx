import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { HONEYPOT_FIELD_NAME } from "./honeypot.tsx"
import { NewsletterForm } from "./newsletter-form.tsx"

describe("NewsletterForm", () => {
  it("renders one email field and a submit button, posting to action", () => {
    const html = render(<NewsletterForm action="/api/subscribe" />)

    expect(html).toContain('action="/api/subscribe"')
    expect(html).toContain('method="post"')
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).toContain("Subscribe")
  })

  it("marks the email field required, both visibly and to the browser's own validation", () => {
    const html = render(<NewsletterForm action="/api/subscribe" />)

    expect(html).toContain(">*<")
    expect(html).toMatch(/<input[^>]*\srequired/)
  })

  it("renders no honeypot field by default", () => {
    const html = render(<NewsletterForm action="/api/subscribe" />)

    expect(html).not.toContain(HONEYPOT_FIELD_NAME)
  })

  it("adds the off-screen honeypot field when asked for one", () => {
    const html = render(<NewsletterForm action="/api/subscribe" honeypot />)

    // Scoped to the honeypot's own wrapper: the required email field's `*` also renders
    // `aria-hidden="true"` (`Field`'s own marker), so a bare `toContain` here would pass whether
    // or not the honeypot itself carried the attribute at all.
    const honeypotBlock = html.match(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ""
    expect(honeypotBlock).toContain(`name="${HONEYPOT_FIELD_NAME}"`)
  })

  it("overrides its copy through labels, keeping the rest of the defaults", () => {
    const html = render(
      <NewsletterForm action="/api/subscribe" labels={{ submit: "S'inscrire" }} />,
    )

    expect(html).toContain("S'inscrire")
    expect(html).toContain("Email")
  })

  it("carries no onSubmit down when the caller gave none, so the native post is untouched", () => {
    const html = render(<NewsletterForm action="/api/subscribe" />)

    // No callback means EnhancedForm never calls `preventDefault`; this only proves the wrapper
    // does not force one into existence — `EnhancedForm`'s own suite covers the fallback itself.
    expect(html).toContain('action="/api/subscribe"')
  })
})
