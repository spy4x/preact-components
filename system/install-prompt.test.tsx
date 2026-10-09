import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { InstallPrompt } from "./install-prompt.tsx"

const noop = () => {}

describe("InstallPrompt", () => {
  it("offers an Install button where the browser has an install dialog", () => {
    const html = render(<InstallPrompt mode="prompt" onInstall={noop} onDismiss={noop} />)

    expect(html).toContain('aria-label="Install this app"')
    expect(html).toMatch(/<button[^>]*>Install<\/button>/)
    expect(html).toMatch(/<button[^>]*>Not now<\/button>/)
  })

  it("explains Share, then Add to Home Screen on iOS, with no Install button", () => {
    const html = render(<InstallPrompt mode="ios" onInstall={noop} onDismiss={noop} />)

    expect(html).toContain("then Add to Home Screen.")
    expect(html).toMatch(/<svg[^>]*aria-label="Share"/)
    expect(html).not.toMatch(/>Install<\/button>/)
  })

  it("renders nothing once installed or when there is nothing to offer", () => {
    expect(render(<InstallPrompt mode="installed" onInstall={noop} onDismiss={noop} />)).toBe("")
    expect(render(<InstallPrompt mode="unavailable" onInstall={noop} onDismiss={noop} />)).toBe("")
  })

  it("renders no failure message before anything failed", () => {
    const html = render(<InstallPrompt mode="prompt" onInstall={noop} onDismiss={noop} />)

    expect(html).toContain('<p role="status" class="sr-only"></p>')
    expect(html).not.toContain("That did not work")
  })
})
