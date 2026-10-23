import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ResendButton } from "./resend-button.tsx"

const noop = () => {}

/** The element carrying `data-e2e="<e2e>"`, whole, or `""`. Holds no nested element of its tag. */
function part(html: string, tag: string, e2e: string): string {
  return html.match(new RegExp(`<${tag}[^>]*data-e2e="${e2e}"[^>]*>.*?</${tag}>`))?.[0] ?? ""
}

describe("ResendButton", () => {
  it("counts down in a sentence kept out of live regions, with no button, before readyAt", () => {
    // 44.5 s ahead reads as 45 for as long as the render takes under half a second.
    const html = render(<ResendButton onResend={noop} readyAt={Date.now() + 44_500} />)
    const waiting = part(html, "p", "resend-button-waiting")
    expect(waiting).toContain('aria-live="off"')
    expect(waiting).toContain(
      "Not there? Check your spam folder. You can send it again in 45 seconds.",
    )
    expect(html).not.toContain("<button")
  })

  it("says 1 second, not 1 seconds, in the last second", () => {
    const html = render(<ResendButton onResend={noop} readyAt={Date.now() + 500} />)
    expect(html).toContain("You can send it again in 1 second.")
  })

  it("shows the button once readyAt has passed", () => {
    const html = render(<ResendButton onResend={noop} readyAt={Date.now() - 1} />)
    expect(html).toContain("Not there? Check your spam folder, or")
    expect(part(html, "button", "resend-button-send")).toContain("Send it again")
    expect(html).not.toContain('data-e2e="resend-button-waiting"')
  })

  it("shows the button at once without a readyAt", () => {
    const html = render(<ResendButton onResend={noop} />)
    expect(html).toContain('data-e2e="resend-button-send"')
  })

  it("shows the busy label on a busy button that stays enabled, so it keeps focus", () => {
    const html = render(<ResendButton onResend={noop} busy busyLabel="Sending a link…" />)
    const button = part(html, "button", "resend-button-send")
    expect(button).toContain('aria-busy="true"')
    expect(button).toContain("Sending a link…")
    expect(button.replace(/\sclass="[^"]*"/, "")).not.toMatch(/\sdisabled[\s=>]/)
  })

  it("draws every text from its props", () => {
    const waiting = render(
      <ResendButton
        onResend={noop}
        readyAt={Date.now() + 9_500}
        waitingText={(seconds) => `Wait ${seconds}.`}
      />,
    )
    expect(waiting).toContain("Wait 10.")
    const ready = render(<ResendButton onResend={noop} readyText="Lost it?" label="Send anew" />)
    expect(ready).toContain("Lost it?")
    expect(ready).toContain("Send anew")
  })

  it("keeps an empty status line in the page before any resend, ready to take focus", () => {
    const html = render(<ResendButton onResend={noop} />)
    const status = part(html, "p", "resend-button-sent")
    expect(status).toContain('role="status"')
    expect(status).toContain('tabindex="-1"')
    expect(status).toMatch(/>\s*<\/p>$/)
  })

  it("gives the button a 44 px touch target on a phone", () => {
    const html = render(<ResendButton onResend={noop} />)
    expect(part(html, "button", "resend-button-send")).toContain("min-h-11")
  })
})
