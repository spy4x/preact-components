import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  DEFAULT_PUSH_SETTINGS_LABELS,
  PushSettings,
  type PushSettingsProps,
  type PushSettingsStatus,
} from "./push-settings.tsx"

const noop = () => {}

/** The block as HTML, with the two required callbacks filled in. */
function html(props: Partial<PushSettingsProps> & { status: PushSettingsStatus }): string {
  return render(<PushSettings onEnable={noop} onDisable={noop} {...props} />)
}

/** The accessible names of the buttons in the markup, in order. */
function buttons(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>(?:<span[^>]*>.*?<\/span>)?([^<]*)<\/button>/g)]
    .map((match) => match[1])
}

const EMPTY_STATUS = '<p role="status" class="sr-only"></p>'

describe("PushSettings", () => {
  it("names the block Notifications and marks which state it shows", () => {
    const markup = html({ status: "off" })
    const group = markup.match(
      /^<div role="group" aria-labelledby="([^"]+)" data-push-status="off"/,
    )

    expect(group).not.toBe(null)
    expect(markup).toContain(`<p id="${group?.[1]}" class="font-medium">Notifications</p>`)
  })

  it("says it is checking, with no button, before the device was read", () => {
    const markup = html({ status: "checking" })

    expect(markup).toContain("Checking this device…")
    expect(buttons(markup)).toEqual([])
  })

  it("says the browser cannot show notifications, with no button", () => {
    const markup = html({ status: "unsupported" })

    expect(markup).toContain("This browser cannot show notifications.")
    expect(buttons(markup)).toEqual([])
  })

  it("says to add the app to the home screen first on an iPhone or iPad, with no button", () => {
    const markup = html({ status: "needs-install" })

    expect(markup).toContain("Tap Share, then Add to Home Screen, and open the app from there.")
    expect(buttons(markup)).toEqual([])
  })

  it("says notifications are not set up on this server, with no button", () => {
    const markup = html({ status: "unavailable" })

    expect(markup).toContain("Notifications are not set up on this server.")
    expect(buttons(markup)).toEqual([])
  })

  it("says how to allow notifications when the browser blocks them, with no button", () => {
    const markup = html({ status: "blocked", onTest: noop })

    expect(markup).toContain("set Notifications to Allow, then come back here.")
    expect(buttons(markup)).toEqual([])
  })

  it("offers only Turn on notifications while they are off, even with a test handler", () => {
    const markup = html({ status: "off", onTest: noop })

    expect(markup).toContain("Notifications are off on this device.")
    expect(buttons(markup)).toEqual(["Turn on notifications"])
  })

  it("says notifications are on and offers only Turn off without a test handler", () => {
    const markup = html({ status: "on" })

    expect(markup).toContain("Notifications are on for this device.")
    expect(buttons(markup)).toEqual(["Turn off notifications"])
  })

  it("adds Send a test notification while on when the app passes a handler", () => {
    const markup = html({ status: "on", onTest: noop })

    expect(buttons(markup)).toEqual(["Turn off notifications", "Send a test notification"])
  })

  it("marks only the button whose action is running as busy", () => {
    const busyButtons = (markup: string) =>
      [...markup.matchAll(/<button[^>]*data-push-action="(\w+)"[^>]*>/g)]
        .filter((match) => match[0].includes('aria-busy="true"'))
        .map((match) => match[1])

    expect(busyButtons(html({ status: "off", busy: "enable" }))).toEqual(["toggle"])
    expect(busyButtons(html({ status: "on", busy: "disable", onTest: noop }))).toEqual(["toggle"])
    expect(busyButtons(html({ status: "on", busy: "test", onTest: noop }))).toEqual(["test"])
    expect(busyButtons(html({ status: "on", onTest: noop }))).toEqual([])
  })

  it("shows each action's own failure message and ties it to the button that failed", () => {
    const describedBy = (markup: string, action: string) =>
      markup.match(new RegExp(`<button[^>]*data-push-action="${action}"[^>]*>`))?.[0]
        .match(/aria-describedby="([^"]+)"/)?.[1]
    const messageId = (markup: string) =>
      markup.match(/<p id="([^"]+)" aria-hidden="true" data-push-message/)?.[1]

    const enable = html({ status: "off", failed: "enable" })
    expect(enable).toContain(">Notifications could not be turned on. Try again.</p>")
    expect(describedBy(enable, "toggle")).toBe(messageId(enable))
    expect(messageId(enable)).toBeTruthy()

    const disable = html({ status: "on", failed: "disable", onTest: noop })
    expect(disable).toContain(">Notifications could not be turned off. Try again.</p>")
    expect(describedBy(disable, "toggle")).toBe(messageId(disable))
    expect(describedBy(disable, "test")).toBe(undefined)

    const test = html({ status: "on", failed: "test", onTest: noop })
    expect(test).toContain(">The test notification could not be sent. Try again.</p>")
    expect(describedBy(test, "test")).toBe(messageId(test))
    expect(describedBy(test, "toggle")).toBe(undefined)
  })

  it("says the test notification was sent once it was", () => {
    const markup = html({ status: "on", sent: true, onTest: noop })

    expect(markup).toContain('data-push-message="sent"')
    expect(markup).toContain("Test notification sent. It should arrive in a moment.")
  })

  it("renders an empty live region and no message before anything happened", () => {
    for (const status of ["checking", "off", "on", "blocked"] as const) {
      const markup = html({ status })

      expect(markup).toContain(EMPTY_STATUS)
      expect(markup).not.toContain("data-push-message")
    }
  })

  it("replaces any word through labels and keeps the defaults for the rest", () => {
    const markup = html({
      status: "off",
      labels: { title: "Reminders", off: "This phone stays quiet.", enable: "Remind me here" },
    })

    expect(markup).toContain(">Reminders</p>")
    expect(markup).toContain("This phone stays quiet.")
    expect(buttons(markup)).toEqual(["Remind me here"])
    expect(html({ status: "on", labels: { title: "Reminders" } }))
      .toContain(DEFAULT_PUSH_SETTINGS_LABELS.on)
  })

  it("adds the caller's classes to the block", () => {
    expect(html({ status: "off", class: "pc-card p-4" })).toMatch(
      /^<div role="group"[^>]*class="[^"]*pc-card p-4"/,
    )
  })
})
