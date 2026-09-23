import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ContactForm } from "./contact-form.tsx"
import { HONEYPOT_FIELD_NAME } from "./honeypot.tsx"

describe("ContactForm", () => {
  it("renders name, email and message fields, posting to action", () => {
    const html = render(<ContactForm action="/api/lead" />)

    expect(html).toContain('action="/api/lead"')
    expect(html).toContain('method="post"')
    expect(html).toContain('name="name"')
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).toContain('name="message"')
    expect(html).toContain("<textarea")
    expect(html).toContain("Send")
  })

  it("marks every field required", () => {
    const html = render(<ContactForm action="/api/lead" />)

    expect(html.match(/\srequired/g)?.length).toBe(3)
  })

  it("renders no honeypot field by default", () => {
    const html = render(<ContactForm action="/api/lead" />)

    expect(html).not.toContain(HONEYPOT_FIELD_NAME)
  })

  it("adds the off-screen honeypot field when asked for one", () => {
    const html = render(<ContactForm action="/api/lead" honeypot />)

    expect(html).toContain(`name="${HONEYPOT_FIELD_NAME}"`)
    expect(html).toContain('aria-hidden="true"')
  })

  it("gives each field a distinct id, so the labels do not collide", () => {
    const html = render(<ContactForm action="/api/lead" />)

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(3)
  })

  it("overrides its copy through labels, keeping the rest of the defaults", () => {
    const html = render(<ContactForm action="/api/lead" labels={{ submit: "Envoyer" }} />)

    expect(html).toContain("Envoyer")
    expect(html).toContain("Message")
  })
})
