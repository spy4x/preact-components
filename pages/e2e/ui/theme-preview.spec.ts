import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** `tokens.css`'s `--color-canvas`: the light value on `:root`, the dark one on `.dark`. */
const CANVAS = { light: "oklch(0.967 0.003 264.542)", dark: "oklch(0.21 0.034 264.665)" }

/**
 * `ThemePreview`: native radios switch the frame's palette, and the page around it keeps its own.
 * Each spec runs on the guide in both of its own palettes, so a light frame on a dark page and a
 * dark frame on a light page are both drawn.
 */
function themePreviewSpecs(): Spec[] {
  const card = (page: Page) => page.locator("#demo-ThemePreview")
  const radio = (page: Page, name: string, checked: boolean) =>
    card(page).getByRole("group", { name: "Theme" }).getByRole("radio", { name, checked })
  const frame = (page: Page) => card(page).locator("[data-preview-frame]")
  /** The frame's canvas and colour scheme, and the card's own background around it. */
  const read = (page: Page) =>
    frame(page).evaluate((element) => ({
      frame: getComputedStyle(element).backgroundColor,
      scheme: getComputedStyle(element).colorScheme,
      page: getComputedStyle(element.closest("#demo-ThemePreview") ?? document.body)
        .backgroundColor,
    }))
  return (["light", "dark"] as const).flatMap((colorScheme): Spec[] => [
    {
      name:
        `ThemePreview on a ${colorScheme} page: starts dark, Tab reaches the checked radio and an arrow key turns only the frame light`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await radio(page, "Dark", true).waitFor()
        const before = await read(page)
        if (before.frame !== CANVAS.dark || before.scheme !== "dark") {
          throw new Error(`dark frame drew ${JSON.stringify(before)}`)
        }

        // Clicking the legend puts the start of Tab order there without focusing anything.
        await card(page).locator("legend").click()
        await page.keyboard.press("Tab")
        await radio(page, "Dark", true).and(page.locator(":focus")).waitFor()
        await page.keyboard.press("ArrowRight")
        await radio(page, "Light", true).and(page.locator(":focus")).waitFor()
        const after = await read(page)
        if (
          after.frame !== CANVAS.light || after.scheme !== "light" || after.page !== before.page
        ) {
          throw new Error(
            `light frame drew ${JSON.stringify(after)}, before ${JSON.stringify(before)}`,
          )
        }

        await page.keyboard.press("Tab")
        await frame(page).getByRole("button", { name: "Save" }).and(page.locator(":focus"))
          .waitFor()
        return `frame ${before.frame} → ${after.frame}; around it ${after.page} both times`
      },
    },
    {
      name:
        `ThemePreview on a ${colorScheme} page: dark: utilities and the preset's dark rules follow the frame, not the page`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        // Save's `dark:bg-accent-600` and the checkbox's `@variant dark { color-scheme: dark }`.
        const look = () =>
          frame(page).evaluate(async (element) => {
            // Button fades its colours; read them once the fade has ended.
            const save = element.querySelector("button")!
            await Promise.all(save.getAnimations().map((animation) => animation.finished))
            return {
              save: getComputedStyle(save).backgroundColor,
              checkbox: getComputedStyle(element.querySelector('input[type="checkbox"]')!)
                .colorScheme,
            }
          })
        await radio(page, "Dark", true).waitFor()
        const dark = await look()
        await card(page).locator("label", { hasText: "Light" }).click()
        await radio(page, "Light", true).waitFor()
        const light = await look()
        if (dark.checkbox !== "dark" || light.checkbox !== "light" || dark.save === light.save) {
          throw new Error(
            `dark frame ${JSON.stringify(dark)}, light frame ${JSON.stringify(light)}`,
          )
        }
        return `Save ${dark.save} in the dark frame, ${light.save} in the light one`
      },
    },
    ...(["Dark", "Light"] as const).map((theme): Spec => ({
      name:
        `ThemePreview on a ${colorScheme} page: axe finds no violation with ${theme} checked, text colour contrast included`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        await radio(page, "Dark", true).waitFor()
        // The radio is visually hidden, so a visitor clicks its chip, the label.
        if (theme === "Light") await card(page).locator("label", { hasText: "Light" }).click()
        await radio(page, theme, true).waitFor()
        return await axePasses(page, ["#demo-ThemePreview"])
      },
    })),
  ])
}

export const specs: readonly Spec[] = [
  ...themePreviewSpecs(),
]
