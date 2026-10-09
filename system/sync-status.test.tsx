import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { syncState, SyncStatus } from "./sync-status.tsx"

/** The text inside the live region, without its markup. */
function regionText(html: string): string {
  const match = html.match(
    /<span role="status" aria-live="polite" aria-atomic="true">(.*?)<\/span>(?=<button|<\/div>$)/,
  )
  return (match?.[1] ?? "").replace(/<[^>]+>/g, "")
}

describe("syncState", () => {
  it("puts offline first, then a failure, then a running sync, then waiting changes", () => {
    expect(syncState({ online: false, pending: 2, syncing: true, failed: true })).toBe("offline")
    expect(syncState({ online: true, pending: 2, syncing: true, failed: true })).toBe("failed")
    expect(syncState({ online: true, pending: 2, syncing: true })).toBe("syncing")
    expect(syncState({ online: true, pending: 2 })).toBe("waiting")
    expect(syncState({ online: true, pending: 0 })).toBe("synced")
  })
})

describe("SyncStatus", () => {
  it("says how many changes wait while offline", () => {
    const html = render(<SyncStatus online={false} pending={3} />)

    expect(regionText(html)).toBe("Offline, 3 changes waiting")
    expect(html).toContain('data-sync-state="offline"')
  })

  it("counts one waiting change in the singular", () => {
    expect(regionText(render(<SyncStatus online pending={1} />))).toBe("1 change waiting to sync")
  })

  it("keeps the live region in the page when there is nothing to say", () => {
    const html = render(<SyncStatus online pending={0} labels={{ synced: "" }} />)

    expect(html).toContain('<span role="status" aria-live="polite" aria-atomic="true"></span>')
  })

  it("offers Retry after a failure, outside the live region", () => {
    const html = render(<SyncStatus online pending={2} failed onRetry={() => {}} />)

    expect(regionText(html)).toBe("Sync failed")
    expect(html).toMatch(/<\/span><button[^>]*>.*Retry.*<\/button><\/div>$/)
  })

  it("offers no Retry while offline, where it cannot help", () => {
    const html = render(<SyncStatus online={false} pending={2} failed onRetry={() => {}} />)

    expect(html).not.toContain("Retry")
  })

  it("takes the caller's words", () => {
    const html = render(
      <SyncStatus online pending={0} syncing labels={{ syncing: (n) => `Envoi de ${n}` }} />,
    )

    expect(regionText(html)).toBe("Envoi de 0")
  })
})
