import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UnsentChangesDialog, type UnsentChangesDialogProps } from "./unsent-changes-dialog.tsx"

const noop = () => {}

/** The dialog rendered to a string with no-op ports and the given props. */
function html(props: Partial<UnsentChangesDialogProps> & { unsent: number }): string {
  return render(
    <UnsentChangesDialog
      onSend={noop}
      onSignOut={noop}
      onCancel={noop}
      onReview={noop}
      {...props}
    />,
  )
}

/** The opening tag of the element carrying `data-e2e="<e2e>"`. */
function tagOf(markup: string, e2e: string): string {
  return markup.match(new RegExp(`<[a-z]+[^>]*data-e2e="${e2e}"[^>]*>`))?.[0] ?? ""
}

/** The text inside the live region, tags removed. */
function statusText(markup: string): string {
  const region = markup.match(/<div[^>]*role="status"[^>]*>(.*?)<\/div><\/div><\/div>/)?.[1] ??
    markup.match(/<div[^>]*role="status"[^>]*>(.*?)<\/div>/)?.[1] ?? ""
  return region.replace(/<[^>]+>/g, "")
}

/** The visible label of each footer button, in DOM order. */
function footerButtons(markup: string): string[] {
  const footer = markup.match(/<footer.*?<\/footer>/)?.[0] ?? ""
  return [...footer.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "")
  )
}

describe("UnsentChangesDialog", () => {
  it("asks with the count and says the changes stay on this browser", () => {
    const markup = html({ unsent: 3 })

    expect(markup).toContain("You have 3 unsent changes")
    expect(markup).toContain("They haven't reached the server yet.")
    expect(markup).toContain("they stay on this browser and are sent only when you sign in here")
    expect(markup).not.toContain("need your choice")
  })

  it("counts one change in the singular", () => {
    const markup = html({ unsent: 1 })

    expect(markup).toContain("You have 1 unsent change<")
  })

  it("offers cancel, sign out anyway and the focused send as the one primary", () => {
    const markup = html({ unsent: 3 })

    expect(footerButtons(markup)).toEqual(["Cancel", "Sign out anyway", "Send, then sign out"])
    expect(tagOf(markup, "unsent-wait")).toContain("autofocus")
    expect(tagOf(markup, "unsent-cancel")).not.toContain("autofocus")
    expect(tagOf(markup, "unsent-sign-out-anyway")).not.toContain("autofocus")
  })

  it("says how many wait on a choice while others can still be sent", () => {
    expect(html({ unsent: 3, conflicts: 1 })).toContain(
      "1 of them needs your choice before it can be sent.",
    )
    expect(html({ unsent: 3, conflicts: 2 })).toContain(
      "2 of them need your choice before they can be sent.",
    )
  })

  it("leaves the live region empty and in the page before anything is sent", () => {
    const markup = html({ unsent: 3 })

    expect(tagOf(markup, "unsent-status")).toContain('role="status"')
    expect(tagOf(markup, "unsent-status")).toContain('aria-live="polite"')
    expect(statusText(markup)).toBe("")
  })

  it("keeps the primary focusable but busy while sending, with the progress in the live region", () => {
    const markup = html({ unsent: 2, sent: 1, state: "sending" })
    const primary = tagOf(markup, "unsent-wait")

    expect(primary).toContain('aria-disabled="true"')
    expect(primary).toContain('aria-busy="true"')
    expect(primary).not.toMatch(/\sdisabled[\s=>]/)
    expect(footerButtons(markup)[2]).toBe("Sending…")
    expect(statusText(markup)).toBe("Sending changes…1 of 3 sent")
    expect(markup).toMatch(/role="progressbar"[^>]*aria-valuenow="1"[^>]*aria-valuemax="3"/)
  })

  it("keeps sign out anyway and cancel usable while it waits", () => {
    const markup = html({ unsent: 2, sent: 1, state: "sending" })

    expect(tagOf(markup, "unsent-cancel")).not.toContain("aria-disabled")
    expect(tagOf(markup, "unsent-sign-out-anyway")).not.toContain("aria-disabled")
  })

  it("says it waits for a connection when offline, with no measured progress", () => {
    const markup = html({ unsent: 3, state: "offline" })

    expect(statusText(markup)).toContain("You're offline. We'll send your changes when you're back")

    expect(markup).not.toMatch(/role="progressbar"[^>]*aria-valuenow/)
  })

  it("says it tries again after a failed send", () => {
    const markup = html({ unsent: 3, state: "retrying" })

    expect(statusText(markup)).toContain("Couldn't reach the server. Trying again…")
  })

  it("counts only sendable changes in the progress when some wait on a choice", () => {
    const markup = html({ unsent: 3, conflicts: 1, sent: 1, state: "sending" })

    expect(statusText(markup)).toContain("1 of 3 sent")
  })

  it("turns the primary into review once only changes waiting on a choice are left", () => {
    const markup = html({ unsent: 2, conflicts: 2, sent: 3, state: "sending" })

    expect(markup).toContain("2 changes need your choice")
    expect(footerButtons(markup)).toEqual(["Cancel", "Sign out anyway", "Review changes"])
    expect(tagOf(markup, "unsent-review")).not.toContain("aria-disabled")
    expect(statusText(markup)).toContain("The server didn't accept them as they are.")
    expect(markup).not.toContain("unsent-wait")
  })

  it("asks for a choice from the start when every change waits on one", () => {
    const markup = html({ unsent: 1, conflicts: 1 })

    expect(markup).toContain("1 change needs your choice")
    expect(statusText(markup)).toBe(
      "The server didn't accept it as it is. Choose what to keep, then sign out.",
    )
    expect(tagOf(markup, "unsent-review")).toContain("autofocus")
  })

  it("describes the dialog by its body, and by the explanation once a choice is needed", () => {
    const describedBy = (markup: string) =>
      tagOf(markup, "unsent-dialog").match(/aria-describedby="([^"]+)"/)?.[1] ?? ""
    const asking = html({ unsent: 3 })
    const choosing = html({ unsent: 1, conflicts: 1 })

    expect(asking).toContain(`id="${describedBy(asking)}" class="flex flex-col gap-2 text-sm`)
    expect(tagOf(choosing, "unsent-status")).toContain(`id="${describedBy(choosing)}"`)
  })

  it("replaces any word through labels", () => {
    const markup = html({
      unsent: 2,
      labels: { title: (n) => `${n} pending`, send: "Sync and leave", cancel: "Stay" },
    })

    expect(markup).toContain("2 pending")
    expect(footerButtons(markup)).toEqual(["Stay", "Sign out anyway", "Sync and leave"])
  })
})
