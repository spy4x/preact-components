import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeClean, filterBarCard } from "./shared.ts"

/**
 * A highlighted danger `DropdownItem` keeps its text at 4.5:1, in each palette: the row under the
 * pointer, then the row with keyboard focus, each checked by axe's colour-contrast rule.
 */
function dangerItemContrastSpecs(): Spec[] {
  return (["light", "dark"] as const).map((colorScheme) => ({
    name: `DropdownItem danger in the ${colorScheme} palette: its text passes axe's contrast ` +
      "check while the row is hovered and while it has focus",
    pageId: "ui",
    colorScheme,
    run: async (page: Page) => {
      const item = page.locator(`[data-e2e="dropdown-item-danger"]`)
      const contrast = async (state: string) => {
        const { violations } = await new AxeBuilder({ page })
          .include(`[data-e2e="dropdown-item-danger"]`)
          .withRules(["color-contrast"])
          .analyze()
        if (violations.length > 0) {
          const nodes = violations.flatMap(({ nodes }) => nodes.map((node) => node.failureSummary))
          throw new Error(`${state}: ${nodes.join("; ")}`)
        }
      }
      await item.hover()
      await contrast("hovered")
      await page.mouse.move(0, 0)
      await item.focus()
      await item.and(page.locator(":focus")).waitFor()
      await contrast("focused")
    },
  }))
}

/**
 * A Dropdown sheet whose items overflow it: at 390 by 480 px the FilterBar's Tags sheet, capped at
 * 70% of the window's height, scrolls (#967). Throws when it does not, so a taller sheet cannot
 * turn the specs below into checks of a menu that never scrolls.
 */
async function openScrollingTagsSheet(page: Page) {
  await page.setViewportSize({ width: 390, height: 480 })
  const bar = filterBarCard(page)
  await bar.search.scrollIntoViewIfNeeded()
  await bar.tags.focus()
  await page.keyboard.press("Enter")
  await bar.tagsMenu.waitFor()
  const size = await bar.tagsMenu.evaluate((menu) => ({
    content: menu.scrollHeight,
    box: menu.clientHeight,
    overflow: getComputedStyle(menu).overflowY,
  }))
  if (size.content <= size.box || size.overflow !== "auto") {
    throw new Error(`the Tags sheet does not scroll: ${JSON.stringify(size)}`)
  }
  /**
   * The items in the tab order, by name: the roving tab stop leaves exactly one. Found by CSS, as
   * a role locator does not match the menu once it is closed and hidden.
   */
  const tabStops = () =>
    page.locator(`#demo-FilterBar [role="menu"][aria-label="Tags"]`).evaluate((menu) =>
      Array.from(menu.querySelectorAll<HTMLElement>(`[tabindex="0"]`)).map((item) =>
        item.textContent?.trim()
      )
    )
  return { ...bar, size, tabStops }
}

/** Dropdown: a menu shown as a phone sheet that scrolls passes axe and keeps its keys (#967). */
function dropdownSheetSpecs(): Spec[] {
  return [
    ...([1440, 390] as const).map((width): Spec => ({
      name: `Dropdown at ${width} px: with the menu open, Shift+Tab from an item reaches the ` +
        `trigger and Tab from the trigger goes back to that item, the menu still open, as in ` +
        `ARIA's menu pattern`,
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width, height: 900 })
        const bar = filterBarCard(page)
        await bar.search.scrollIntoViewIfNeeded()
        await bar.tags.focus()
        await page.keyboard.press("Enter")
        const all = bar.tagsMenu.getByRole("menuitemradio", { name: "All of these tags" })
        await bar.tagsMenu.getByRole("menuitemradio", { name: "Any of these tags" })
          .and(page.locator(":focus")).waitFor()
        await page.keyboard.press("ArrowDown")
        await bar.focusIsOn(all)
        await page.keyboard.press("Shift+Tab")
        await bar.focusIsOn(bar.tags)
        await page.keyboard.press("Tab")
        await bar.focusIsOn(all)
        await bar.tagsMenu.waitFor()
      },
    })),
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `Dropdown at 390 px, ${colorScheme}: a sheet whose items scroll passes axe, ` +
        `scrollable-region-focusable included`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const sheet = await openScrollingTagsSheet(page)
        await axeClean(page, `#demo-FilterBar [role="search"]`)
        return `${sheet.size.content} px of items in a ${sheet.size.box} px sheet`
      },
    })),
    {
      name: "Dropdown at 390 px, in a sheet that scrolls: the focused item is the one tab stop; " +
        "the arrow keys, Home and End move it, Shift+Tab reaches the trigger with the menu " +
        "open, Escape hands focus back and leaves no tab stop, and Tab leaves and closes the menu",
      pageId: "ui",
      run: async (page) => {
        const sheet = await openScrollingTagsSheet(page)
        const item = (role: "menuitem" | "menuitemradio" | "menuitemcheckbox", name: string) =>
          sheet.tagsMenu.getByRole(role, { name, exact: true })
        const stopIs = async (name: string) => {
          const stops = await sheet.tabStops()
          if (stops.length !== 1 || stops[0] !== name) {
            throw new Error(`tab stops ${JSON.stringify(stops)}, expected only "${name}"`)
          }
        }
        const any = item("menuitemradio", "Any of these tags")
        await sheet.focusIsOn(any)
        await stopIs("Any of these tags")
        await page.keyboard.press("ArrowDown")
        await sheet.focusIsOn(item("menuitemradio", "All of these tags"))
        await stopIs("All of these tags")
        await page.keyboard.press("End")
        const done = item("menuitem", "Done")
        await sheet.focusIsOn(done)
        await stopIs("Done")
        const scrolled = await sheet.tagsMenu.evaluate((menu) => menu.scrollTop)
        if (scrolled <= 0) throw new Error("End left the sheet scrolled to the top")
        await page.keyboard.press("Home")
        await sheet.focusIsOn(any)
        await stopIs("Any of these tags")

        await page.keyboard.press("Shift+Tab")
        await sheet.focusIsOn(sheet.tags)
        await sheet.tagsMenu.waitFor()
        // Back into the menu, so Escape has focus to hand back from an item.
        await page.keyboard.press("ArrowDown")
        await sheet.focusIsOn(any)
        await page.keyboard.press("Escape")
        await sheet.tagsMenu.waitFor({ state: "hidden" })
        await sheet.focusIsOn(sheet.tags)
        const closedStops = await sheet.tabStops()
        if (closedStops.length > 0) {
          throw new Error(`the closed menu kept tab stops ${JSON.stringify(closedStops)}`)
        }

        await page.keyboard.press("Enter")
        await sheet.focusIsOn(any)
        await page.keyboard.press("Tab")
        await sheet.tagsMenu.waitFor({ state: "hidden" })
        const outside = await page.evaluate(() => {
          const active = document.activeElement
          const menu = document.querySelector(`[role="menu"][aria-label="Tags"]`)
          return active !== null && active !== document.body &&
            !(menu?.parentElement?.contains(active) ?? true)
        })
        if (!outside) throw new Error("Tab left focus inside the dropdown")
        return `scrolled ${scrolled} px to reach Done`
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...dropdownSheetSpecs(),
  ...dangerItemContrastSpecs(),
  {
    name:
      "DropdownItem: the arrow keys reach an unchecked group of a switcher, Enter chooses it, " +
      "the check moves to it and the menu closes with focus on its trigger",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-DropdownItem")
      const trigger = card.locator(`[data-e2e="dropdown-checked-trigger"]`)
      const menu = card.getByRole("menu", { name: "Switch group", exact: true })
      const choice = (name: string, checked: boolean) =>
        menu.getByRole("menuitemradio", { name, exact: true, checked })
      const focused = page.locator(":focus")

      await trigger.click()
      await choice("Family", true).and(focused).waitFor()
      await choice("Work", false).waitFor()
      await page.keyboard.press("ArrowDown")
      await choice("Work", false).and(focused).waitFor()
      await page.keyboard.press("Enter")
      await card.locator(`[data-e2e="dropdown-checked-status"]`)
        .getByText("Group: Work", { exact: true }).waitFor()
      await trigger.and(page.locator(`[aria-expanded="false"]`)).and(focused).waitFor()

      await trigger.press("Enter")
      await choice("Work", true).waitFor()
      await choice("Family", false).waitFor()
      const marks = await menu.getByRole("menuitemradio").evaluateAll((items) =>
        items.map((item) => [
          item.textContent?.trim(),
          item.querySelector("svg") !== null,
          item.firstElementChild?.getBoundingClientRect().width,
        ])
      )
      const widths = new Set(marks.map(([, , width]) => width))
      const checks = marks.filter(([, hasCheck]) => hasCheck).map(([name]) => name)
      if (checks.join() !== "Work" || widths.size !== 1) {
        throw new Error(`items (name, check, slot width): ${JSON.stringify(marks)}`)
      }
      return `slot ${[...widths][0]} px on every item`
    },
  },
]
