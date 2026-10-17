import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { AccountMenu } from "./account-menu.tsx"

const user = { name: "Ada Lovelace", email: "ada@example.com" }

/** The trigger's opening tag, found by its `data-e2e`. */
function triggerTag(html: string, e2e = "account-menu-button"): string {
  return html.match(new RegExp(`<[a-z]+[^>]*data-e2e="${e2e}"[^>]*>`))?.[0] ?? ""
}

/** The trigger's markup up to its close, found by its `data-e2e`. */
function trigger(html: string, e2e = "account-menu-button"): string {
  const start = html.indexOf(`data-e2e="${e2e}"`)
  return html.slice(start, html.indexOf("</summary>", start))
}

describe("AccountMenu", () => {
  it("draws the full trigger with a decorative avatar, the name and the e-mail", () => {
    const html = render(<AccountMenu user={user} />)
    const content = trigger(html)
    expect(content).toContain(">Ada Lovelace<")
    expect(content).toContain(">ada@example.com<")
    expect(content).toMatch(/alt=""|aria-hidden="true"/)
  })

  it("draws the avatar alone, named by the person, with display avatar", () => {
    const html = render(<AccountMenu user={user} display="avatar" />)
    const content = trigger(html)
    expect(content).not.toContain(">Ada Lovelace<")
    expect(content).not.toContain("ada@example.com")
    expect(content).toContain("Ada Lovelace")
  })

  it("names the trigger by labels.trigger when given", () => {
    const html = render(<AccountMenu user={user} labels={{ trigger: "Account: Ada" }} />)
    expect(html).toContain('aria-label="Account: Ada"')
  })

  it("lists the caller's items, then the theme choice, then sign out after a divider", () => {
    const html = render(
      <AccountMenu
        user={user}
        items={[{ label: "Profile", href: "/profile" }]}
        onThemeChange={() => undefined}
        signOut={{ label: "Sign out", action: "/sign-out" }}
      />,
    )
    const profile = html.indexOf(">Profile<")
    const theme = html.indexOf('data-e2e="account-menu-theme"')
    const separator = html.indexOf('role="separator"')
    const signOut = html.indexOf(">Sign out<")
    expect(profile).toBeGreaterThan(-1)
    expect(theme).toBeGreaterThan(profile)
    expect(separator).toBeGreaterThan(theme)
    expect(signOut).toBeGreaterThan(separator)
    expect(html).toMatch(/<form method="post" action="\/sign-out" role="none">/)
  })

  // Before hydration `DropdownItem` is a plain button, where the choice is `aria-current`; the
  // hydrated `menuitemradio` with `aria-checked` is proven in `pages/e2e/system.spec.ts`.
  it("marks only the current theme in a group named by its heading", () => {
    const html = render(<AccountMenu user={user} theme="dark" onThemeChange={() => undefined} />)
    expect(html).toContain('role="group" aria-label="Theme"')
    const item = (value: string) =>
      html.match(new RegExp(`<[a-z]+[^>]*data-e2e="account-menu-theme-${value}"[^>]*>`))?.[0] ??
        ""
    expect(item("dark")).toContain('aria-current="true"')
    expect(item("light")).not.toContain("aria-current")
    expect(item("system")).not.toContain("aria-current")
  })

  it("draws no theme choice and no sign out when their props are left out", () => {
    const html = render(<AccountMenu user={user} />)
    expect(html).not.toContain('data-e2e="account-menu-theme"')
    expect(html).not.toContain('role="separator"')
  })

  it("prints the caller's theme words in place of the defaults", () => {
    const html = render(
      <AccountMenu
        user={user}
        onThemeChange={() => undefined}
        labels={{ theme: "Thème", system: "Système", light: "Clair", dark: "Sombre" }}
      />,
    )
    expect(html).toContain('aria-label="Thème"')
    for (const word of ["Système", "Clair", "Sombre"]) expect(html).toContain(`>${word}<`)
    for (const word of [">System<", ">Light<", ">Dark<", '"Theme"']) {
      expect(html).not.toContain(word)
    }
  })

  it("puts the caller's data-e2e on the trigger", () => {
    const html = render(<AccountMenu user={user} dataE2E="sidebar-account" />)
    expect(triggerTag(html, "sidebar-account")).not.toEqual("")
  })

  it("draws the tag as a neutral gray badge under the avatar, inside the trigger's name", () => {
    const html = render(<AccountMenu user={user} display="avatar" tag="Admin" />)
    const content = trigger(html)
    expect(content).toMatch(/<span class="[^"]*bg-track[^"]*">Admin<\/span>/)
    expect(content).not.toMatch(/bg-selected|bg-accent/)
    expect(content.indexOf("Ada Lovelace")).toBeLessThan(content.indexOf(">Admin<"))
  })

  it("draws a hidden header row with the name, the e-mail and the tag only when asked", () => {
    const withHeader = render(<AccountMenu user={user} tag="Admin" header />)
    const start = withHeader.indexOf('data-e2e="account-menu-header"')
    expect(start).toBeGreaterThan(-1)
    const row = withHeader.slice(
      withHeader.lastIndexOf("<div", start),
      withHeader.indexOf("</div>", start),
    )
    expect(row).toContain('aria-hidden="true"')
    expect(row).toContain(">ada@example.com<")
    expect(row).toContain(">Admin<")
    expect(render(<AccountMenu user={user} />)).not.toContain("account-menu-header")
  })

  it("merges the caller's trigger and panel classes over its own", () => {
    const html = render(
      <AccountMenu
        user={user}
        display="avatar"
        triggerClasses="size-12 caller-trigger"
        panelClasses="left-[calc(100%+1.25rem)] bottom-0"
      />,
    )
    expect(triggerTag(html)).toContain("caller-trigger")
    expect(html).toContain("left-[calc(100%+1.25rem)]")
    expect(html).not.toMatch(/class="[^"]*bottom-full[^"]*left-\[calc/)
  })
})
