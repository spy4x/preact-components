import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconHome } from "@spy4x/preact-icons"
import { AppShell, type AppShellItem, type AppShellProps } from "./app-shell.tsx"

/** `count` destinations keyed `i1`…, each a link to `/i1`…. */
function itemsOf(count: number): AppShellItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `i${index + 1}`,
    label: `Item ${index + 1}`,
    href: `/i${index + 1}`,
    Icon: IconHome,
  }))
}

const user = { name: "Ada Lovelace", email: "ada@example.com" }

/** An app's shell with the given props over a signed-in person and three destinations. */
function shell(props: Partial<AppShellProps> = {}): string {
  return render(
    <AppShell
      items={itemsOf(3)}
      account={{
        user,
        items: [{ label: "Profile", href: "/profile" }],
        onThemeChange: () => {},
        signOut: { label: "Sign out", action: "/sign-out" },
      }}
      notifications={{ href: "/notifications", unread: 3 }}
      {...props}
    >
      <p>page body</p>
    </AppShell>,
  )
}

/** The markup from the element carrying this `data-e2e` up to the next close of `tag`. */
function region(html: string, e2e: string, tag: string): string {
  const start = html.indexOf(`data-e2e="${e2e}"`)
  if (start < 0) return ""
  return html.slice(start, html.indexOf(`</${tag}>`, start))
}

/** The markup of the element carrying this `data-e2e`, up to its last matching close. */
function whole(html: string, e2e: string, tag: string): string {
  const start = html.indexOf(`data-e2e="${e2e}"`)
  if (start < 0) return ""
  return html.slice(start, html.lastIndexOf(`</${tag}>`))
}

describe("AppShell", () => {
  it("names the bell with its unread count and hides the badge", () => {
    const column = whole(shell(), "rail-shell-column", "aside")
    expect(column).toContain('aria-label="Notifications, 3 unread"')
    expect(column).toMatch(/aria-hidden="true" data-e2e="rail-shell-counter">3</)
  })

  it("names the account button by the person and draws no tag in a product", () => {
    const html = shell()
    expect(html).toContain('aria-label="Account: Ada Lovelace"')
    expect(html).not.toContain(">Admin<")
    const tabbar = region(html, "rail-shell-tabbar", "nav")
    expect(tabbar).toContain(">Account<")
  })

  it("marks the admin with a neutral badge, the tab's and the sheet's word, and the name", () => {
    const html = shell({ account: { user, tag: "Admin" } })
    expect(html).toContain('aria-label="Account: Ada Lovelace, Admin"')
    const account = region(html, "app-shell-account", "button")
    expect(account).toMatch(/<span class="[^"]*bg-track[^"]*">Admin<\/span>/)
    expect(account).toContain("min-h-14")
    expect(region(html, "rail-shell-more", "button")).toContain(">Admin<")
    expect(region(html, "rail-shell-dialog", "h2")).toContain(">Admin")
    expect(region(html, "app-shell-sheet-account-header", "div")).not.toBe("")
    expect(whole(html, "app-shell-sheet-account", "dialog")).toMatch(/bg-track[^"]*">Admin</)
    expect(html).not.toMatch(/bg-selected[^"]*">Admin</)
  })

  it("keeps one live region outside the rail, present and empty with no connection", () => {
    const quiet = shell()
    expect(quiet.match(/data-e2e="shell-ws-status"/g)).toHaveLength(1)
    expect(quiet).toContain(
      '<span class="sr-only" role="status" data-e2e="shell-ws-status"></span>',
    )
    expect(quiet.indexOf("shell-ws-status")).toBeLessThan(quiet.indexOf("<aside"))
    const live = shell({ connection: "reconnecting" })
    expect(live).toContain('data-e2e="shell-ws-status">Reconnecting…</span>')
  })

  it("draws the connection cell and the phone strip only while the connection is news", () => {
    for (const connection of ["idle", "closed", "reconnecting"] as const) {
      const html = shell({ connection })
      expect(html).toContain('data-e2e="app-shell-connection"')
      expect(html).toContain('data-e2e="app-shell-offline-strip"')
    }
    for (const connection of ["open", "connecting"] as const) {
      const html = shell({ connection })
      expect(html).not.toContain("app-shell-connection")
      expect(html).not.toContain("app-shell-offline-strip")
    }
  })

  it("orders the bottom zone: connection, bell, account", () => {
    const bottom = whole(shell({ connection: "idle" }), "rail-shell-bottom", "aside")
    const connection = bottom.indexOf("app-shell-connection")
    const bell = bottom.indexOf('href="/notifications"')
    const account = bottom.indexOf("app-shell-account")
    expect(connection).toBeGreaterThan(-1)
    expect(connection).toBeLessThan(bell)
    expect(bell).toBeLessThan(account)
  })

  it("centres the page in a 48 rem column, or 64 rem when wide, with the banner first", () => {
    const html = shell({ banner: <p>verify your e-mail</p> })
    const content = region(html, "app-shell-content", "main")
    expect(html).toMatch(/class="mx-auto w-full max-w-3xl" data-e2e="app-shell-content"/)
    expect(content.indexOf("verify your e-mail")).toBeLessThan(content.indexOf("page body"))
    expect(shell({ width: "wide" })).toMatch(/max-w-5xl" data-e2e="app-shell-content"/)
  })

  it("puts four destinations in the phone bar and the rest in the sheet, account last", () => {
    const html = shell({ items: itemsOf(5) })
    const tabbar = region(html, "rail-shell-tabbar", "nav")
    const tabs = [...tabbar.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(tabs).toEqual(["/i1", "/i2", "/i3", "/i4"])
    expect(tabbar).toContain('aria-label="Account, 3 unread"')
    const sheet = whole(html, "rail-shell-dialog", "dialog")
    const order = ["/i5", "/notifications", "app-shell-sheet-account-header", "/profile"]
      .map((mark) => sheet.indexOf(mark))
    for (const index of order) expect(index).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(sheet.indexOf("app-shell-sheet-theme")).toBeGreaterThan(sheet.indexOf("/profile"))
    expect(sheet.indexOf(">Sign out<")).toBeGreaterThan(sheet.indexOf("app-shell-sheet-theme"))
  })

  it("offers the theme in the sheet as pressed buttons, and closes the sheet on sign out", () => {
    const sheet = whole(shell(), "app-shell-sheet-account", "dialog")
    expect(sheet).toMatch(/aria-pressed="true"[^>]*data-e2e="app-shell-theme-system"/)
    expect(sheet).toMatch(/aria-pressed="false"[^>]*data-e2e="app-shell-theme-dark"/)
    expect(sheet).toMatch(/<button type="submit"[^>]*data-rail-close[^>]*>Sign out</)
  })

  it("draws a plain placeholder and no menu while the person is unknown", () => {
    const html = shell({ account: {} })
    expect(html).toContain('data-e2e="app-shell-account-pending"')
    expect(html).toContain("starting:opacity-0")
    expect(html).not.toContain('app-shell-account"')
    expect(html).not.toContain("account-menu-button")
  })

  it("draws no brand mark and no top bar", () => {
    const html = shell()
    expect(html).not.toContain("<header")
    expect(html).not.toContain('data-e2e="rail-shell-top"')
  })

  it("prints the caller's words in place of every default", () => {
    const html = shell({
      connection: "closed",
      labels: {
        account: "Compte",
        notifications: "Avis",
        counter: (count) => `${count} non lus`,
        connection: { closed: "Hors ligne" },
        accountTrigger: (name) => `Compte : ${name}`,
        skipToContent: "Aller au contenu",
      },
    })
    expect(html).toContain('aria-label="Avis, 3 non lus"')
    expect(html).toContain('aria-label="Compte : Ada Lovelace"')
    expect(html).toContain(">Compte<")
    expect(html).toContain('data-e2e="shell-ws-status">Hors ligne</span>')
    expect(html).toContain(">Aller au contenu</a>")
    for (const word of ["Notifications", "unread", "Offline", ">Account<"]) {
      expect(html).not.toContain(word)
    }
  })
})
