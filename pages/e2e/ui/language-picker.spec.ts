import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * `LanguageDialog` and `LanguagePicker`: a radio group with one tab stop that the arrow keys move
 * and choose in, a page that switches language while the dialog stays open with focus on the
 * chosen row, a live region that says the new language in that language, Left and Right swapped in
 * Arabic, rows at least 44 px, and the offline and failure states.
 */
function languagePickerSpecs(): Spec[] {
  /** The open dialog of the LanguageDialog card, and the parts a spec drives. */
  const openDialog = async (page: Page) => {
    const card = page.locator("#demo-LanguageDialog")
    const opener = card.locator(`[data-e2e="language-dialog-open"]`)
    await opener.scrollIntoViewIfNeeded()
    await opener.click()
    const dialog = page.locator(`dialog[data-e2e="language-dialog"]`)
    await dialog.waitFor()
    const focused = page.locator(":focus")
    return {
      opener,
      dialog,
      focused,
      /** The row named `name`, checked or not. */
      radio: (name: string | RegExp, checked?: boolean) =>
        dialog.getByRole("radio", { name, checked, exact: typeof name === "string" }),
    }
  }
  return [
    {
      name:
        "LanguageDialog: opens on the chosen row; the arrow keys move and choose within one tab stop; the dialog stays open in the new language with focus on the chosen row; the live region says the language in itself; Escape returns focus to the opener",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const { opener, dialog, focused, radio } = await openDialog(page)
        await radio(/^Automatic: .+, like this device/, true).and(focused).waitFor()

        for (const row of await dialog.getByRole("radio").all()) {
          const box = await row.boundingBox()
          if (box === null || box.height < 44) throw new Error(`a row is ${box?.height} px tall`)
        }

        await page.keyboard.press("ArrowDown")
        await radio("English", true).and(focused).waitFor()
        await page.keyboard.press("ArrowDown")
        await radio("Deutsch", true).and(focused).waitFor()
        // Loading, then the whole card in German, the dialog still open, focus still on the row.
        await dialog.getByRole("heading", { name: "Sprache" }).waitFor()
        await radio("Deutsch", true).and(focused).waitFor()
        await dialog.locator(`[role="status"] [lang="de"]`).filter({ hasText: "Deutsch" }).waitFor()

        await page.keyboard.press("Tab")
        await dialog.locator(`[data-e2e="language-dialog-done"]`).and(focused).waitFor()
        await page.keyboard.press("Shift+Tab")
        await radio("Deutsch", true).and(focused).waitFor()

        await page.keyboard.press("End")
        await dialog.getByRole("heading", { name: "اللغة" }).waitFor()
        await radio("العربية", true).and(focused).waitFor()
        const direction = await dialog.evaluate((element) => getComputedStyle(element).direction)
        if (direction !== "rtl") throw new Error(`the Arabic dialog runs ${direction}`)
        // Right goes back up the list in a right-to-left page, to the Chinese row before Arabic.
        await page.keyboard.press("ArrowRight")
        await radio(/^(简体中文|中文)/, true).and(focused).waitFor()
        await dialog.getByRole("heading", { name: "语言" }).waitFor()

        await page.keyboard.press("Home")
        await dialog.getByRole("heading", { name: "Language" }).waitFor()
        await radio(/^Automatic/, true).and(focused).waitFor()

        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await opener.and(focused).waitFor()
        return "Automatic → English → Deutsch → العربية → 简体中文 → Automatic, Escape back to the opener"
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `LanguageDialog: axe finds no violation in the open dialog, in Arabic too, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const { dialog, radio } = await openDialog(page)
        const english = await axePasses(page, [`dialog[data-e2e="language-dialog"]`])
        await radio("العربية").click()
        await dialog.getByRole("heading", { name: "اللغة" }).waitFor()
        await axePasses(page, [`dialog[data-e2e="language-dialog"]`])
        return english
      },
    })),
    {
      name:
        "LanguageButton: names the language in use in itself after a hidden title; Enter opens the dialog, a choice renames the button, Escape and Done return focus to it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const card = page.locator("#demo-LanguageButton")
        const focused = page.locator(":focus")
        const dialog = page.locator(`dialog[data-e2e="language-dialog"]`)
        const button = (name: string) =>
          card.getByRole("button", { name, exact: true }).and(
            card.locator(`[data-e2e="language-button"]`),
          )
        await card.scrollIntoViewIfNeeded()
        await button("Language English").locator(`[lang="en"].notranslate`).waitFor()

        await button("Language English").focus()
        await page.keyboard.press("Enter")
        await dialog.getByRole("radio", { name: /^Automatic/, checked: true }).and(focused)
          .waitFor()
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("ArrowDown")
        await dialog.getByRole("heading", { name: "Sprache" }).waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await button("Sprache Deutsch").and(focused).waitFor()

        await button("Sprache Deutsch").click()
        await dialog.getByRole("radio", { name: "العربية" }).click()
        await dialog.getByRole("heading", { name: "اللغة" }).waitFor()
        await dialog.locator(`[data-e2e="language-dialog-done"]`).click()
        await dialog.waitFor({ state: "detached" })
        await button("اللغة العربية").and(focused).locator(`[lang="ar"][dir="rtl"]`).waitFor()
        return "Language English → Sprache Deutsch (Escape) → اللغة العربية (Done), focus back each time"
      },
    },
    {
      name:
        "LanguageButton in the page's top-level <header>: with its dialog open, axe (best-practice rules included) finds no nested banner or contentinfo landmark",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-LanguageButton")
        await card.scrollIntoViewIfNeeded()
        // Move the demo's row (the button and the dialog it renders) into a header at the top of
        // the body, as a signed-out page draws it: that header is the page's banner.
        await card.locator(`[data-e2e="language-button"]`).evaluate((button) => {
          const header = document.createElement("header")
          header.id = "e2e-language-header"
          header.append(button.parentElement!)
          document.body.prepend(header)
        })
        const header = page.locator("body > #e2e-language-header")
        await header.locator(`[data-e2e="language-button"]`).click()
        await header.locator(`dialog[data-e2e="language-dialog"]`).getByRole("heading").waitFor()
        const { violations, passes } = await new AxeBuilder({ page })
          .include("body > #e2e-language-header")
          .withTags(["wcag2a", "wcag2aa", "best-practice"])
          .analyze()
        if (violations.length > 0) {
          throw new Error(
            violations.map(({ id, nodes }) =>
              `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
            ).join(" | "),
          )
        }
        return `${passes.length} rules pass with the dialog open inside the banner`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `LanguageButton: axe finds no violation on the button, in Arabic too, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const card = page.locator("#demo-LanguageButton")
        const opener = card.locator(`[data-e2e="language-button"]`)
        await card.scrollIntoViewIfNeeded()
        const english = await axePasses(page, [`#demo-LanguageButton [data-e2e="language-button"]`])
        await opener.click()
        const dialog = page.locator(`dialog[data-e2e="language-dialog"]`)
        await dialog.getByRole("radio", { name: "العربية" }).click()
        await dialog.getByRole("heading", { name: "اللغة" }).waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await axePasses(page, [`#demo-LanguageButton [data-e2e="language-button"]`])
        return english
      },
    })),
    {
      name:
        "LanguagePicker: offline, the arrow keys skip the languages that cannot load; a failed load names the language in an alert, keeps the old one checked and leaves the live region empty",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-LanguagePicker")
        const focused = page.locator(":focus")
        const radio = (name: string | RegExp, checked?: boolean) =>
          card.getByRole("radio", { name, checked, exact: typeof name === "string" })
        await card.scrollIntoViewIfNeeded()
        await card.getByRole("button", { name: "Offline" }).click()
        await radio(/^Español/).and(page.locator(":disabled")).waitFor()
        await card.getByText("Needs a connection").first().waitFor()

        // English loads, and the live region says so.
        await radio(/^Automatic/, true).focus()
        await page.keyboard.press("ArrowDown")
        await radio("English", true).and(focused).waitFor()
        await card.locator(`[role="status"] [lang="en"]`).filter({ hasText: "English" }).waitFor()

        // Deutsch fails: an alert names it, English stays checked, focus stays on Deutsch.
        await card.getByRole("button", { name: "Loading fails" }).click()
        await radio("English", true).focus()
        await page.keyboard.press("ArrowDown")
        await card.getByRole("alert").filter({
          hasText: "Couldn't load Deutsch. Check your connection and try again.",
        }).waitFor()
        await radio("English", true).waitFor()
        // The live region was cleared when Deutsch began to load, so "English" is not said again.
        await card.locator(`p[role="status"]:empty`).waitFor({ state: "attached" })
        await radio("Deutsch", false).and(focused).waitFor()
        // The next row down is Русский: Español and Português (Brasil) are skipped.
        await page.keyboard.press("ArrowDown")
        await radio("Русский").and(focused).waitFor()
        return "Español and Português (Brasil) skipped; Deutsch failed and English stayed"
      },
    },
    {
      name:
        'LanguagePicker menu: the globe is named "Language: English"; Enter opens it on the first language, checked, Escape closes it and returns focus to the globe, a press outside closes it; rows are 44 px on a phone',
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const card = page.locator("#demo-LanguagePicker")
        const focused = page.locator(":focus")
        const globe = card.getByRole("button", { name: "Language: English", exact: true })
        const menu = card.getByRole("menu", { name: "Language" })
        await globe.scrollIntoViewIfNeeded()

        await globe.focus()
        await page.keyboard.press("Enter")
        const english = menu.getByRole("menuitemradio", { name: "English", checked: true })
        await english.and(focused).waitFor()
        await menu.getByRole("menuitemradio", { name: "العربية", checked: false }).waitFor()
        const row = await english.boundingBox()
        if (!row || row.height < 44) throw new Error(`row is ${row?.height} px tall, under 44`)

        await page.keyboard.press("Escape")
        await menu.waitFor({ state: "hidden" })
        await globe.and(focused).waitFor()

        await globe.click()
        await menu.waitFor()
        await page.mouse.click(5, 5)
        await menu.waitFor({ state: "hidden" })
        return `Escape back to the globe, outside press closed it, rows ${row.height} px`
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name:
        `LanguagePicker menu: axe finds no violation in the open menu, in Arabic too, where it lines up with the globe's left edge, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const card = page.locator("#demo-LanguagePicker")
        const root = `#demo-LanguagePicker div:has(> [data-e2e="language-menu"])`
        const menu = card.getByRole("menu")
        await card.scrollIntoViewIfNeeded()
        await card.getByRole("button", { name: "Language: English", exact: true }).click()
        await menu.waitFor()
        const english = await axePasses(page, [root])
        await page.keyboard.press("Escape")

        await card.getByRole("radio", { name: "العربية" }).click()
        const globe = card.getByRole("button", { name: "اللغة: العربية", exact: true })
        await globe.click()
        await menu.getByRole("menuitemradio", { name: "العربية", checked: true }).waitFor()
        await axePasses(page, [root])
        const [trigger, panel] = [await globe.boundingBox(), await menu.boundingBox()]
        if (!trigger || !panel || Math.abs(trigger.x - panel.x) > 1) {
          throw new Error(`panel starts at ${panel?.x}, globe at ${trigger?.x}`)
        }
        return english
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...languagePickerSpecs(),
]
