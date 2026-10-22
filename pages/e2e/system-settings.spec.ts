/**
 * Playwright specs for `SettingsLayout` and `AccountMenu`'s linked header (`system/`), on the
 * `SettingsLayout` and `AccountMenu` cards of the guide's System page.
 */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"

const DEMO = `[data-e2e="settings-layout-demo"]`

/** The parts of the `SettingsLayout` card the specs drive. */
function settings(page: Page) {
  const root = page.locator(DEMO)
  const nav = root.locator(`[data-e2e="settings-nav"]`)
  return {
    root,
    nav,
    // A phone row's name ends with its value ("Two-factor off"), so the label is matched as the start.
    item: (name: string) => nav.getByRole("link", { name: new RegExp(`^${name}( |$)`) }),
    heading: root.locator(`[data-e2e="settings-heading"]`),
    back: root.locator(`[data-e2e="settings-back"]`),
    section: root.locator(`[data-e2e="settings-section"]`),
    route: page.locator(`[data-e2e="settings-layout-demo-route"]`),
  }
}

/** A nav item by its whole accessible name, such as a phone row's label and its value. */
function nav(view: ReturnType<typeof settings>, name: string): Locator {
  const [label, value] = name.split(", ")
  return view.nav.getByRole("link", { name: `${label} ${value}`, exact: true })
}

/** Throws unless `locator` holds the document's focus. */
async function expectFocused(locator: Locator, what: string): Promise<void> {
  const focused = await locator.evaluate((element) => element === document.activeElement)
  if (!focused) {
    const active = await locator.page().evaluate(() =>
      document.activeElement?.outerHTML.slice(0, 120) ?? "nothing"
    )
    throw new Error(`${what} does not hold focus; ${active} does`)
  }
}

/** Throws when axe finds a violation in the element `selector` names, or measured no contrast. */
async function expectAxeClean(page: Page, selector: string): Promise<string> {
  const { violations, passes } = await new AxeBuilder({ page }).include(selector).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map((rule) => `${rule.id}: ${rule.help} (${rule.nodes.length})`).join("; "),
    )
  }
  if (!passes.some((rule) => rule.id === "color-contrast")) {
    throw new Error(`axe did not measure colour contrast in ${selector}`)
  }
  return `${passes.length} axe rules passed`
}

/** Both widths in one palette: axe at 1440 px with the nav, then at 390 px on the phone list. */
async function settingsAxeClean(page: Page): Promise<string> {
  const view = settings(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await view.root.scrollIntoViewIfNeeded()
  const wide = await expectAxeClean(page, DEMO)
  await page.setViewportSize({ width: 390, height: 844 })
  await view.back.click()
  await view.item("Account").waitFor({ state: "visible" })
  const phone = await expectAxeClean(page, DEMO)
  return `1440 px: ${wide}; 390 px list: ${phone}`
}

export const specs: readonly Spec[] = [
  {
    name: "SettingsLayout: Tab reaches every nav item in order, and choosing one marks it " +
      "current and moves focus to its section's heading",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const view = settings(page)
      await view.root.scrollIntoViewIfNeeded()
      const names = [
        "Account",
        "Sign-in and security",
        "Language and region",
        "Appearance",
        "Delete account",
      ]
      await view.item(names[0]).focus()
      for (const name of names.slice(1)) {
        await page.keyboard.press("Tab")
        await expectFocused(view.item(name), `after Tab, ${name}`)
      }
      await view.item("Sign-in and security").focus()
      await page.keyboard.press("Enter")
      await view.route.filter({ hasText: "#settings-security" }).waitFor()
      await view.heading.filter({ hasText: "Sign-in and security" }).waitFor()
      await expectFocused(view.heading, "the section heading")
      if (await view.item("Sign-in and security").getAttribute("aria-current") !== "page") {
        throw new Error("the chosen item is not aria-current=page")
      }
      if (await view.item("Account").getAttribute("aria-current") !== null) {
        throw new Error("the item left behind is still aria-current")
      }
      const [navBox, sectionBox] = await Promise.all([
        view.nav.boundingBox(),
        view.section.boundingBox(),
      ])
      if (!navBox || !sectionBox || navBox.x + navBox.width > sectionBox.x) {
        throw new Error("at 1440 px the nav is not beside the section")
      }
      return `Tab walked ${names.length} items; Enter focused the heading; nav ${navBox.width} px`
    },
  },
  {
    name: "SettingsLayout at 390 px: the list is the page, a section replaces it with a back " +
      "link, and going back returns focus to that section's item",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const view = settings(page)
      await view.root.scrollIntoViewIfNeeded()
      // The demo opens on Account, so the phone shows that section and no list.
      await view.back.waitFor({ state: "visible" })
      if (await view.nav.isVisible()) throw new Error("the list shows beside an open section")
      await view.back.click()
      await view.route.filter({ hasText: "#settings" }).waitFor()
      await view.item("Account").waitFor({ state: "visible" })
      await expectFocused(view.item("Account"), "the item of the section that was open")
      if (await view.section.isVisible()) throw new Error("the section shows under the list")
      const row = await view.item("Sign-in and security").boundingBox()
      if (!row || row.height < 44) throw new Error(`a list row is ${row?.height} px tall`)
      await nav(view, "Sign-in and security, Two-factor off").waitFor()
      await view.item("Sign-in and security").click()
      await view.heading.filter({ hasText: "Sign-in and security" }).waitFor()
      await expectFocused(view.heading, "the section heading")
      if (await view.nav.isVisible()) throw new Error("the list still shows after choosing")
      return `rows ${row.height} px; back focused Account; choosing focused the heading`
    },
  },
  {
    name: "SettingsLayout with defaultSection on the list's address: 1440 px shows Account's " +
      "heading and current look with no aria-current, 390 px shows only the list",
    pageId: "system",
    run: async (page) => {
      // Reduced motion turns the items' colour transition off, so a resize repaints at once.
      await page.emulateMedia({ reducedMotion: "reduce" })
      // The demo opens on Account; the phone's back link is the way to the list's address.
      await page.setViewportSize({ width: 390, height: 844 })
      const view = settings(page)
      await view.root.scrollIntoViewIfNeeded()
      await view.back.click()
      await view.route.filter({ hasText: "#settings" }).waitFor()
      // Off every item, so no hover tint skews the colours read below.
      await page.mouse.move(0, 0)
      await page.setViewportSize({ width: 1440, height: 900 })
      await view.root.scrollIntoViewIfNeeded()
      await view.heading.filter({ hasText: "Account" }).waitFor({ state: "visible" })
      const account = view.item("Account")
      const tint = (locator: Locator) =>
        locator.evaluate((element) => getComputedStyle(element).backgroundColor)
      const [current, plain] = await Promise.all([tint(account), tint(view.item("Appearance"))])
      if (current === plain) throw new Error(`Account is not drawn current: ${current}`)
      if (await view.root.locator("[aria-current]").count() !== 0) {
        throw new Error("an item carries aria-current on the list's address")
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await account.waitFor({ state: "visible" })
      if (await view.section.isVisible()) throw new Error("at 390 px the section shows")
      const phone = await tint(account)
      if (phone !== plain) throw new Error(`at 390 px Account is tinted: ${phone}`)
      return `1440 px: heading shown, Account ${current}; 390 px: list only, Account ${phone}`
    },
  },
  {
    name: "SettingsLayout passes axe at 1440 and 390 px in light, colour contrast included",
    pageId: "system",
    run: settingsAxeClean,
  },
  {
    name: "SettingsLayout passes axe at 1440 and 390 px in dark, colour contrast included",
    pageId: "system",
    colorScheme: "dark",
    run: settingsAxeClean,
  },
  {
    name: "AccountMenu: with headerHref the header row is the first menu item, named by the " +
      "person, and a plain click on it calls navigate",
    pageId: "system",
    run: async (page) => {
      const card = page.locator(`[data-e2e="account-menu-demo"]`)
      const trigger = card.locator(`[data-e2e="account-menu-button"]`)
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
      const menu = card.getByRole("menu")
      await menu.waitFor({ state: "visible" })
      const first = menu.getByRole("menuitem").first()
      const header = menu.getByRole("menuitem", { name: "Uma Lee uma@example.com", exact: true })
      await header.waitFor()
      if (await first.getAttribute("data-e2e") !== "account-menu-header") {
        throw new Error("the header is not the menu's first item")
      }
      const before = page.url()
      await header.click()
      await card.locator(`[data-e2e="account-menu-demo-route"]`)
        .filter({ hasText: "#account-you" }).waitFor()
      if (page.url() !== before) throw new Error(`the page moved to ${page.url()}`)
      return "header first, named by the person; plain click routed to #account-you"
    },
  },
]
