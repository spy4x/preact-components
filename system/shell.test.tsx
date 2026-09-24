import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { IconBars3 } from "@preact-components/icons"
import { Shell, type ShellNavItem, type ShellUser } from "./shell.tsx"

const navItems: ShellNavItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Reports", href: "/reports", Icon: IconBars3, counter: 3 },
]

const user: ShellUser = { name: "Ada Lovelace", email: "ada@example.com" }

/** One attribute's value off an already-extracted tag, or `undefined`. */
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]
}

/** Every `<a href="…">…</a>` for one `href`, whole tag included — an item appears twice (sidebar
 * and drawer), so a test that cares about one instance reads this list rather than assuming a count. */
function linksTo(html: string, href: string): string[] {
  return [...html.matchAll(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`, "g"))].map((m) => m[0])
}

describe("Shell", () => {
  it("renders every nav item's href, once in the sidebar and once in the drawer", () => {
    const html = render(<Shell navItems={navItems} brand="Acme" user={null}>page</Shell>)
    expect(linksTo(html, "/dashboard")).toHaveLength(2)
    expect(linksTo(html, "/reports")).toHaveLength(2)
  })

  it("marks the item matching currentPath as the current page, and no other", () => {
    const html = render(
      <Shell navItems={navItems} brand="Acme" user={null} currentPath="/reports">page</Shell>,
    )
    for (const tag of linksTo(html, "/reports")) expect(tag).toContain('aria-current="page"')
    for (const tag of linksTo(html, "/dashboard")) expect(tag).not.toContain("aria-current")
  })

  it("renders an item's icon and counter badge, once in each copy", () => {
    const html = render(<Shell navItems={navItems} brand="Acme" user={null}>page</Shell>)
    for (const tag of linksTo(html, "/reports")) {
      expect(tag).toContain("<svg")
      expect(tag).toContain(">3<")
    }
    for (const tag of linksTo(html, "/dashboard")) {
      expect(tag).not.toContain("<svg")
    }
  })

  it("omits the counter badge for zero, a negative number, or no counter at all", () => {
    const html = render(
      <Shell
        navItems={[
          { name: "Zero", href: "/zero", counter: 0 },
          { name: "Negative", href: "/negative", counter: -1 },
          { name: "None", href: "/none" },
        ]}
        brand="Acme"
        user={null}
      >
        page
      </Shell>,
    )
    expect(html).not.toMatch(/>0<\/span>/)
    expect(html).not.toMatch(/>-1<\/span>/)
  })

  it("renders a nav item with no href as a heading, and its children beneath it", () => {
    const html = render(
      <Shell
        navItems={[{ name: "Settings", children: [{ name: "Billing", href: "/billing" }] }]}
        brand="Acme"
        user={null}
      >
        page
      </Shell>,
    )
    expect(html).toContain(">Settings<")
    expect(html).not.toMatch(/<a[^>]*>[^<]*Settings/)
    expect(linksTo(html, "/billing")).toHaveLength(2)
  })

  it("renders brand and status exactly once each, with no anchor of the component's own", () => {
    const html = render(
      <Shell
        navItems={navItems}
        brand={<span data-e2e="my-brand">Acme</span>}
        status={<span data-e2e="my-status">Online</span>}
        user={null}
      >
        page
      </Shell>,
    )
    expect([...html.matchAll(/data-e2e="my-brand"/g)]).toHaveLength(1)
    expect([...html.matchAll(/data-e2e="my-status"/g)]).toHaveLength(1)
    expect(html).not.toMatch(/<a[^>]*>\s*<span data-e2e="my-brand"/)
  })

  it("renders no user menu when user is null", () => {
    const html = render(<Shell navItems={navItems} brand="Acme" user={null}>page</Shell>)
    expect(html).not.toContain("shell-user-menu-button")
  })

  it("renders the user menu, named from the user's own name, when a user is given", () => {
    const html = render(
      <Shell navItems={navItems} brand="Acme" user={user}>page</Shell>,
    )
    expect(html).toContain("shell-user-menu-button")
    expect(html).toContain("Ada Lovelace")
  })

  it("renders every user menu item", () => {
    const html = render(
      <Shell
        navItems={navItems}
        brand="Acme"
        user={user}
        userMenuItems={[{ label: "Profile", href: "/profile" }, { label: "Sign out" }]}
      >
        page
      </Shell>,
    )
    expect(html).toContain(">Profile<")
    expect(html).toContain(">Sign out<")
    expect(html).toMatch(/<a[^>]*href="\/profile"[^>]*>Profile<\/a>/)
    expect(html).toMatch(/<button[^>]*>Sign out<\/button>/)
  })

  it("puts the skip link before any other link, targeting a focusable #shell content id", () => {
    const html = render(<Shell navItems={navItems} brand="Acme" user={null}>the page</Shell>)
    const skipLink = html.match(/<a[^>]*data-e2e="shell-skip-link"[^>]*>[^<]*<\/a>/)?.[0] ?? ""
    expect(skipLink).toBeTruthy()
    const firstAnchor = html.match(/<a[^>]*>/)?.[0] ?? ""
    expect(skipLink.startsWith(firstAnchor)).toBe(true)
    const href = attr(skipLink, "href") ?? ""
    expect(href.startsWith("#")).toBe(true)
    const targetId = href.slice(1)
    const mainTag = html.match(/<main[^>]*>/)?.[0] ?? ""
    expect(attr(mainTag, "id")).toBe(targetId)
    expect(attr(mainTag, "tabindex")).toBe("-1")
    expect(html).toContain("the page")
  })

  it("takes a labels override for every string it prints", () => {
    const html = render(
      <Shell
        navItems={navItems}
        brand="Acme"
        user={user}
        labels={{
          menu: "Ouvrir le menu",
          nav: "Navigation principale",
          skipToContent: "Aller au contenu",
          userMenu: "Menu du compte",
        }}
      >
        page
      </Shell>,
    )
    expect(html).toContain("Ouvrir le menu")
    expect(html).toContain("Navigation principale")
    expect(html).toContain("Aller au contenu")
    expect(html).toContain('aria-label="Menu du compte"')
    expect(html).not.toContain("Skip to content")
    expect(html).not.toContain("Main navigation")
    expect(html).not.toContain("Account menu")
  })

  it("prints no visible text beyond the caller's own brand, nav items, status and children", () => {
    const html = render(
      <Shell
        navItems={[{ name: "Zzyzx", href: "/zzyzx" }]}
        brand={<span>Qwerty Corp</span>}
        status={<span>Frobnicate</span>}
        user={null}
      >
        <span>Widget content</span>
      </Shell>,
    )
    // "Skip to content" is the component's own fixed default text (see the labels-override test
    // above for proof it is not hard-coded past being overridable), so it is expected here too.
    const words = new Set(
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean),
    )
    expect(words).toEqual(
      new Set([
        "Qwerty",
        "Corp",
        "Zzyzx",
        "Frobnicate",
        "Widget",
        "content",
        "Skip",
        "to",
      ]),
    )
  })

  it("merges a caller's class onto the root element without losing its own", () => {
    const html = render(
      <Shell navItems={navItems} brand="Acme" user={null} class="bg-red-500">page</Shell>,
    )
    const rootTag = html.match(/<div class="[^"]*">/)?.[0] ?? ""
    expect(rootTag).toContain("bg-red-500")
    expect(rootTag).toContain("min-h-screen")
  })
})
