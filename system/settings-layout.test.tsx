import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  SettingsLayout,
  type SettingsLayoutProps,
  type SettingsSection,
} from "./settings-layout.tsx"

const sections: SettingsSection[] = [
  { id: "danger", label: "Delete account", href: "/profile/danger", tone: "danger" },
  { id: "account", label: "Account", href: "/profile/account", description: "Your name." },
  { id: "security", label: "Sign-in and security", href: "/profile/security", value: "2FA off" },
]

function layout(props: Partial<SettingsLayoutProps> = {}): string {
  return render(
    <SettingsLayout title="Profile" href="/profile" sections={sections} current={null} {...props}>
      <p>Section body</p>
    </SettingsLayout>,
  )
}

/** The opening tag of the first element carrying this `data-e2e`. */
function tag(html: string, e2e: string): string {
  return html.match(new RegExp(`<[a-z0-9]+[^>]*data-e2e="${e2e}"[^>]*>`))?.[0] ?? ""
}

/** The class attribute of an opening tag. */
function classOf(openingTag: string): string[] {
  return (openingTag.match(/class="([^"]*)"/)?.[1] ?? "").split(" ")
}

describe("SettingsLayout", () => {
  it("marks only the current section's nav item with aria-current page", () => {
    const html = layout({ current: "security" })
    expect(tag(html, "settings-nav-security")).toContain('aria-current="page"')
    expect(tag(html, "settings-nav-account")).not.toContain("aria-current")
    expect(tag(html, "settings-nav-danger")).not.toContain("aria-current")
    expect(html.match(/aria-current="page"/g)?.length).toBe(1)
  })

  it("draws every nav item as a real link to its section", () => {
    const html = layout()
    for (const section of sections) {
      const opening = tag(html, `settings-nav-${section.id}`)
      expect(opening.startsWith("<a ")).toBe(true)
      expect(opening).toContain(`href="${section.href}"`)
    }
  })

  it("names the nav by the title unless labels.nav says otherwise", () => {
    expect(tag(layout(), "settings-nav")).toContain('aria-label="Profile"')
    expect(tag(layout({ labels: { nav: "Profile sections" } }), "settings-nav"))
      .toContain('aria-label="Profile sections"')
  })

  it("draws danger sections last, after a divider, in danger text", () => {
    const html = layout()
    const account = html.indexOf('data-e2e="settings-nav-account"')
    const security = html.indexOf('data-e2e="settings-nav-security"')
    const danger = html.indexOf('data-e2e="settings-nav-danger"')
    expect(account).toBeLessThan(security)
    expect(security).toBeLessThan(danger)
    const dangerList = html.slice(html.lastIndexOf("<ul", danger), danger)
    expect(classOf(dangerList.slice(0, dangerList.indexOf(">")))).toContain("md:border-t")
    expect(classOf(tag(html, "settings-nav-danger"))).toContain("text-danger")
    expect(classOf(tag(html, "settings-nav-account"))).not.toContain("text-danger")
  })

  it("keeps a current danger item in danger text on the danger tint, not the accent", () => {
    const classes = classOf(tag(layout({ current: "danger" }), "settings-nav-danger"))
    expect(classes).toContain("bg-danger-soft")
    expect(classes).toContain("text-danger")
    expect(classes.join(" ")).not.toContain("selected-text")
  })

  it("on the list's own address shows the list on a phone and hides the section there", () => {
    const html = layout()
    expect(classOf(tag(html, "settings-nav"))).not.toContain("max-md:hidden")
    expect(classOf(tag(html, "settings-section"))).toContain("max-md:hidden")
    expect(html).not.toContain('data-e2e="settings-back"')
    expect(html).not.toContain('data-e2e="settings-heading"')
  })

  it("draws each phone row with a chevron and its value, both hidden from md up", () => {
    const html = layout()
    const start = html.indexOf('data-e2e="settings-nav-security"')
    const row = html.slice(start, html.indexOf("</a>", start))
    expect(row).toMatch(/<span class="[^"]*md:hidden[^"]*">2FA off<\/span>/)
    expect(row).toMatch(/<svg[^>]*class="[^"]*md:hidden[^"]*"/)
    expect(classOf(tag(html, "settings-nav-security"))).toContain("max-md:min-h-11")
  })

  it("with a section open hides the list on a phone and shows a back link to it", () => {
    const html = layout({ current: "account" })
    expect(classOf(tag(html, "settings-nav"))).toContain("max-md:hidden")
    expect(classOf(tag(html, "settings-section"))).not.toContain("max-md:hidden")
    const back = tag(html, "settings-back")
    expect(back).toContain('href="/profile"')
    expect(classOf(back)).toContain("md:hidden")
    expect(html).toContain("Back to Profile</a>")
    expect(layout({ current: "account", labels: { back: "All settings" } }))
      .toContain("All settings</a>")
  })

  it("heads the open section with its label and description, focusable from script only", () => {
    const html = layout({ current: "account" })
    const heading = tag(html, "settings-heading")
    expect(heading.startsWith("<h2 ")).toBe(true)
    expect(heading).toContain('tabindex="-1"')
    const id = heading.match(/id="([^"]+)"/)?.[1]
    expect(id).toBeDefined()
    expect(tag(html, "settings-section")).toContain(`aria-labelledby="${id}"`)
    expect(html).toContain(">Account</h2>")
    expect(html).toContain(">Your name.</p>")
    expect(html).toContain("<p>Section body</p>")
  })

  it("keeps the title for screen readers on a phone while a section is open", () => {
    const html = layout({ current: "account" })
    const header = html.indexOf('data-e2e="page-header"')
    const wrapper = html.slice(html.lastIndexOf("<div", header), header)
    expect(classOf(wrapper.slice(0, wrapper.indexOf(">")))).toContain("max-md:sr-only")
    expect(html).toMatch(/<h1[^>]*>.*Profile/)
    expect(layout()).not.toContain("max-md:sr-only")
  })

  it("draws the intro under the title, and hides it on a phone while a section is open", () => {
    const list = layout({ intro: <p data-e2e="intro">Ada</p> })
    expect(list.indexOf('data-e2e="intro"')).toBeGreaterThan(list.indexOf('data-e2e="page-header"'))
    const open = layout({ current: "account", intro: <p data-e2e="intro">Ada</p> })
    const at = open.indexOf('data-e2e="intro"')
    const wrapper = open.slice(open.lastIndexOf("<div", at), at)
    expect(classOf(wrapper.slice(0, wrapper.indexOf(">")))).toContain("max-md:hidden")
  })

  it("moves both headings down with headingLevel", () => {
    const html = layout({ current: "account", headingLevel: 3 })
    expect(html).toMatch(/<h3[^>]*>.*Profile/)
    expect(tag(html, "settings-heading").startsWith("<h4 ")).toBe(true)
  })

  it("throws when current names no section", () => {
    expect(() => layout({ current: "missing" })).toThrow('no section has the id "missing"')
  })

  it("with defaultSection on the list's address heads children with it from md up only", () => {
    const html = layout({ defaultSection: "account" })
    const heading = tag(html, "settings-heading")
    const id = heading.match(/id="([^"]+)"/)?.[1]
    expect(id).toBeDefined()
    expect(html).toContain(">Account</h2>")
    expect(html).toContain(">Your name.</p>")
    expect(tag(html, "settings-section")).toContain(`aria-labelledby="${id}"`)
    expect(classOf(tag(html, "settings-section"))).toContain("max-md:hidden")
    expect(classOf(tag(html, "settings-nav"))).not.toContain("max-md:hidden")
    expect(html).not.toContain('data-e2e="settings-back"')
  })

  it("draws the default section's item current from md up only, with no aria-current", () => {
    const html = layout({ defaultSection: "account" })
    const account = classOf(tag(html, "settings-nav-account"))
    expect(account.some((name) => name.startsWith("md:bg-[var(--color-surface-active"))).toBe(true)
    expect(account.some((name) => name.startsWith("bg-[var(--color-surface-active"))).toBe(false)
    expect(account).toContain("max-md:text-foreground")
    expect(html).not.toContain("aria-current")
    expect(classOf(tag(html, "settings-nav-security")).join(" ")).not.toContain("surface-active")
  })

  it("draws a default danger section on the danger tint from md up only", () => {
    const classes = classOf(tag(layout({ defaultSection: "danger" }), "settings-nav-danger"))
    expect(classes).toContain("md:bg-danger-soft")
    expect(classes).not.toContain("bg-danger-soft")
    expect(classes).toContain("text-danger")
  })

  it("ignores defaultSection while a section is open", () => {
    const html = layout({ current: "security", defaultSection: "account" })
    expect(html).toContain(">Sign-in and security</h2>")
    expect(html).not.toContain(">Account</h2>")
    expect(classOf(tag(html, "settings-nav-account")).join(" ")).not.toContain("surface-active")
  })

  it("throws when defaultSection names no section", () => {
    expect(() => layout({ defaultSection: "missing" })).toThrow('no section has the id "missing"')
  })
})
