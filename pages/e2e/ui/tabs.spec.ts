import type { Spec } from "../runner.ts"

/**
 * `Tabs` in a row too narrow for its tabs that scrolls sideways, as an app makes it with
 * `listClass="flex-nowrap overflow-x-auto"`: selecting the last tab, out of sight at first, scrolls
 * the row until that tab is whole inside it, and leaves the page where it was. Once left to right
 * and once right to left, where the row starts at its right edge.
 */
function tabsRevealSpecs(): Spec[] {
  return (["ltr", "rtl"] as const).map((dir): Spec => ({
    name: `Tabs in a narrow row that scrolls sideways, ${
      dir === "ltr" ? "left to right" : "right to left"
    }: selecting the last tab shows it whole inside the row, and the page stays put`,
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Tabs")
      await card.evaluate((element, dir) => element.setAttribute("dir", dir), dir)
      await page.addStyleTag({
        content:
          `#demo-Tabs [role="tablist"] { flex-wrap: nowrap; overflow-x: auto; width: 160px; }`,
      })
      await card.getByRole("tablist").scrollIntoViewIfNeeded()
      const shown = () =>
        page.evaluate(() => {
          const list = document.querySelector<HTMLElement>(`#demo-Tabs [role="tablist"]`)!
          const tab = document.getElementById("guide-tab-activity-tab")!
          const start = list.getBoundingClientRect().left + list.clientLeft
          const { left, right } = tab.getBoundingClientRect()
          return left >= start - 1 && right <= start + list.clientWidth + 1
        })
      if (await shown()) throw new Error("Activity is whole in the row before it is selected")
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      const pageY = await page.evaluate(() => scrollY)
      await page.keyboard.press("4")
      await page.locator(`#guide-tab-activity-tab[aria-selected="true"]`).waitFor()
      if (!await shown()) throw new Error("Activity is selected but not whole inside the row")
      const movedY = await page.evaluate(() => scrollY)
      if (movedY !== pageY) throw new Error(`the page scrolled from ${pageY} to ${movedY}`)
      return `Activity whole in the row, page at ${movedY}`
    },
  }))
}

export const specs: readonly Spec[] = [
  ...tabsRevealSpecs(),
]
