import type { Spec } from "../runner.ts"
import { axeClean, filterBarCard } from "./shared.ts"

/** FilterBar: each control's onChange, the menus' keys, the chips' focus, the phone layout, axe. */
function filterBarSpecs(): Spec[] {
  const axeSpec = (colorScheme: "light" | "dark"): Spec => ({
    name: `FilterBar: the bar and its open Tags menu pass axe, ${colorScheme}`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      const bar = filterBarCard(page)
      await bar.tags.click()
      await bar.tagsMenu.waitFor()
      await axeClean(page, `#demo-FilterBar [role="search"]`)
    },
  })
  return [
    {
      name: "FilterBar at 390 px, dark: the sheet passes axe with its Done item focused",
      pageId: "ui",
      colorScheme: "dark",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const bar = filterBarCard(page)
        await bar.search.scrollIntoViewIfNeeded()
        await bar.tags.click()
        await bar.tagsMenu.waitFor()
        await bar.tagsMenu.getByRole("menuitem", { name: "Done" }).focus()
        await axeClean(page, `#demo-FilterBar [role="search"]`)
      },
    },
    {
      name: "FilterBar: search, the Tags menu's boxes (checked and unchecked), a toggle and the " +
        "sort each reach their onChange, and a box leaves the menu open",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.search.fill("plan")
        await bar.stateHas("q: plan ·")

        await bar.tags.click()
        const plans = bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" })
        await plans.click()
        await bar.stateHas("tags: design, plans (any)")
        await plans.and(page.locator(`[aria-checked="true"]`)).waitFor()
        await bar.tagsMenu.waitFor()
        await bar.tags.and(page.locator(`[aria-label="Tags: 2"]`)).waitFor()
        // Unchecking a box takes its value out and leaves the others.
        const design = bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Design" })
        await design.click()
        await bar.stateHas("tags: plans (any)")
        await design.and(page.locator(`[aria-checked="false"]`)).waitFor()
        await page.keyboard.press("Escape")
        await bar.tagsMenu.waitFor({ state: "hidden" })
        await bar.tags.and(page.locator(`[aria-label="Tags: Plans"]`)).waitFor()

        await bar.card.getByRole("button", { name: "Created by me" }).click()
        await bar.stateHas("mine: on")

        // An order and its direction in one visit: the menu stays open between the two picks.
        await bar.sort.click()
        const sortMenu = page.getByRole("menu", { name: "Sort by" })
        await sortMenu.getByRole("menuitemradio", { name: "Title" }).click()
        await bar.stateHas("sort: title asc")
        await sortMenu.waitFor()
        await sortMenu.getByRole("group", { name: "Order" })
          .getByRole("menuitemradio", { name: "Z–A" }).click()
        await bar.stateHas("sort: title desc")
        await bar.sort.filter({ hasText: "Z–A" }).waitFor()
        await page.keyboard.press("Escape")
        await sortMenu.waitFor({ state: "hidden" })
      },
    },
    {
      name: "FilterBar: the arrow keys reach the mode switch and the boxes, Space checks a box " +
        "with the menu left open, End skips the phone-only Done item, and Escape hands focus " +
        "back to the trigger",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.tags.focus()
        await page.keyboard.press("Enter")
        const any = bar.tagsMenu.getByRole("menuitemradio", { name: "Any of these tags" })
        await bar.focusIsOn(any)
        await page.keyboard.press("ArrowDown")
        const all = bar.tagsMenu.getByRole("menuitemradio", { name: "All of these tags" })
        await bar.focusIsOn(all)
        await page.keyboard.press("Enter")
        await bar.stateHas("(all)")
        await bar.focusIsOn(all)
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("ArrowDown")
        const plans = bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" })
        await bar.focusIsOn(plans)
        await page.keyboard.press(" ")
        await bar.stateHas("tags: design, plans (all)")
        await bar.focusIsOn(plans)
        await page.keyboard.press("End")
        await bar.focusIsOn(bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Hiring" }))
        await page.keyboard.press("Escape")
        await bar.focusIsOn(bar.tags)
      },
    },
    {
      name: "FilterBar: a chip's remove button takes one filter away and focuses the next chip; " +
        "Clear filters clears the rest and focuses the search field",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.author.click()
        await page.getByRole("menuitemradio", { name: "Maya Chen" }).click()
        await bar.stateHas("author: maya")

        await bar.card.getByRole("button", { name: "Remove the Design filter" }).click()
        await bar.stateHas("tags: (none)")
        await bar.stateHas("author: maya")
        await bar.focusIsOn(bar.card.getByRole("button", { name: "Remove the Maya Chen filter" }))

        await bar.search.fill("kept")
        await bar.card.getByRole("button", { name: "Clear filters" }).click()
        await bar.stateHas("author: (anyone)")
        await bar.stateHas("q: kept ·")
        await bar.focusIsOn(bar.search)
        const chips = await bar.card.getByRole("list", { name: "Active filters" }).count()
        if (chips !== 0) throw new Error("the chips row is still drawn after Clear filters")
      },
    },
    {
      name: "FilterBar: Clear search empties the field and hands it focus",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.search.fill("welcome")
        await bar.stateHas("q: welcome ·")
        await bar.card.getByRole("button", { name: "Clear search" }).click()
        await bar.stateHas("q: (empty) ·")
        await bar.focusIsOn(bar.search)
      },
    },
    {
      name: "FilterBar at 390 px: nothing overflows the page, the controls row scrolls on its " +
        "own, and a menu opens as a sheet along the bottom of the screen, every item 44 px tall, " +
        "closed by its Done item",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const bar = filterBarCard(page)
        await bar.search.scrollIntoViewIfNeeded()
        const row = bar.card.locator("[data-filter-controls]")
        const widths = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }))
        if (widths.page > widths.viewport) {
          throw new Error(`the page is ${widths.page} px wide in a ${widths.viewport} px viewport`)
        }
        const scrolls = await row.evaluate((el) => el.scrollWidth > el.clientWidth)
        if (!scrolls) throw new Error("the controls row does not overflow on its own at 390 px")

        await bar.tags.click()
        await bar.tagsMenu.waitFor()
        const box = await bar.tagsMenu.boundingBox()
        const height = await page.evaluate(() => globalThis.innerHeight)
        const flush = box !== null && box.x === 0 && box.width === widths.viewport &&
          Math.round(box.y + box.height) === height
        if (!flush) {
          throw new Error(`the menu is not a bottom sheet: ${JSON.stringify(box)}`)
        }
        const short = await bar.tagsMenu.locator(`[role^="menuitem"]`).evaluateAll((items) =>
          items.map((item) => [item.textContent, item.getBoundingClientRect().height] as const)
            .filter(([, height]) => height < 44)
        )
        if (short.length > 0) throw new Error(`items under 44 px: ${JSON.stringify(short)}`)
        await bar.tagsMenu.getByRole("menuitem", { name: "Done" }).click()
        await bar.tagsMenu.waitFor({ state: "hidden" })
      },
    },
    {
      name: "FilterBar at 768 px with the controls wrapping: the search field sits on the first " +
        "line, level with the first control",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 768, height: 900 })
        const bar = filterBarCard(page)
        await bar.tags.click()
        await bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" }).click()
        await page.keyboard.press("Escape")
        await bar.author.click()
        await page.getByRole("menuitemradio", { name: "Maya Chen" }).click()
        await bar.card.getByRole("button", { name: "Created by me", exact: true }).click()
        await bar.stateHas("mine: on")
        const [search, tags, sort] = await Promise.all(
          [bar.search, bar.tags, bar.sort].map((control) => control.boundingBox()),
        )
        if (!search || !tags || !sort) throw new Error("a control is not drawn")
        if (Math.abs(search.y - tags.y) > 1) {
          throw new Error(`the search field is at y ${search.y}, the Tags menu at y ${tags.y}`)
        }
        if (sort.y <= tags.y) {
          throw new Error("the controls do not wrap at 768 px, so this proves nothing")
        }
      },
    },
    {
      name:
        "FilterBar at 1440 px with two filters on: each active trigger keeps its label with a " +
        "count, names the choice, takes no accent fill, and Sort stays on the trigger row's line",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        const bar = filterBarCard(page)
        await bar.tags.click()
        await bar.tagsMenu.getByRole("menuitemcheckbox", { name: "Plans" }).click()
        await page.keyboard.press("Escape")
        await bar.author.click()
        await page.getByRole("menuitemradio", { name: "Maya Chen" }).click()
        await bar.stateHas("tags: design, plans (any) · author: maya")
        await bar.card.getByRole("button", { name: "Tags: 2", exact: true }).waitFor()
        await bar.card.getByRole("button", { name: "Author: Maya Chen", exact: true }).waitFor()
        await bar.tags.filter({ hasText: /^Tags$/ }).locator(`[data-count="2"]`).waitFor()
        const digit = await bar.tags.locator("[data-count]").evaluate((badge) =>
          getComputedStyle(badge, "::after").content
        )
        if (digit !== `"2"`) throw new Error(`the count badge draws ${digit}, not "2"`)

        const [tags, sort] = await Promise.all([bar.tags, bar.sort].map((c) => c.boundingBox()))
        if (!tags || !sort) throw new Error("a control is not drawn")
        if (Math.abs(sort.y - tags.y) > 1) {
          throw new Error(`Sort wrapped: the Tags menu is at y ${tags.y}, Sort at y ${sort.y}`)
        }
        // The accent fill, read from a probe with the class, against every trigger's background.
        const filled = await bar.card.evaluate((card) => {
          const probe = document.createElement("span")
          probe.className = "bg-selected"
          card.append(probe)
          const accent = getComputedStyle(probe).backgroundColor
          probe.remove()
          return Array.from(card.querySelectorAll<HTMLElement>(`[data-e2e^="filter-"]`))
            .filter((el) => el.tagName === "BUTTON")
            .filter((el) => getComputedStyle(el).backgroundColor === accent)
            .map((el) => el.dataset.e2e)
        })
        if (filled.length > 0) throw new Error(`triggers with the accent fill: ${filled}`)
      },
    },
    {
      name: "FilterBar at 390 px with five filters on: the chips sit on one line that scrolls, " +
        "the hidden edge fades, focusing a hidden chip scrolls it into view, and the controls " +
        "row drops its fade while a menu's sheet is open",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        const bar = filterBarCard(page)
        await bar.tags.click()
        for (const tag of ["Plans", "Launch"]) {
          await bar.tagsMenu.getByRole("menuitemcheckbox", { name: tag }).click()
        }
        await page.keyboard.press("Escape")
        await bar.author.click()
        await page.getByRole("menuitemradio", { name: "Maya Chen" }).click()
        await bar.card.getByRole("button", { name: "Created by me", exact: true }).click()
        await bar.stateHas("mine: on")

        await page.setViewportSize({ width: 390, height: 844 })
        const list = bar.card.locator("[data-filter-chips]")
        await list.scrollIntoViewIfNeeded()
        const tops = await list.locator("li").evaluateAll((items) =>
          items.map((item) => (item as HTMLElement).offsetTop)
        )
        if (tops.length !== 5 || new Set(tops).size !== 1) {
          throw new Error(`the chips are not on one line: offsetTop ${tops}`)
        }
        const scrolls = await list.evaluate((el) => el.scrollWidth > el.clientWidth)
        if (!scrolls) throw new Error("the chips row does not overflow, so this proves nothing")
        await list.and(page.locator(`[data-fade="right"]`)).waitFor()
        const mask = await list.evaluate((el) => getComputedStyle(el).maskImage)
        if (!mask.includes("gradient")) throw new Error(`the chips row draws no fade: ${mask}`)
        await bar.card.locator(`[data-filter-controls][data-fade="right"]`).waitFor()

        const last = bar.card.getByRole("button", { name: "Remove the Created by me filter" })
        await last.focus()
        await bar.focusIsOn(last)
        await list.and(page.locator(`[data-fade="left"]`)).waitFor()
        const shown = await last.evaluate((button) => {
          const row = button.closest("ul")!.getBoundingClientRect()
          const box = button.getBoundingClientRect()
          return box.left >= row.left && box.right <= row.right + 1
        })
        if (!shown) throw new Error("the focused chip is still scrolled out of the row")

        // A mask paints over the fixed sheet too, so the controls row drops its fade while open.
        const controls = bar.card.locator("[data-filter-controls]")
        await bar.tags.click()
        await bar.tagsMenu.waitFor()
        const open = await controls.evaluate((el) => getComputedStyle(el).maskImage)
        if (open !== "none") throw new Error(`the open sheet sits under the row's fade: ${open}`)
      },
    },
    axeSpec("light"),
    axeSpec("dark"),
  ]
}

export const specs: readonly Spec[] = [
  ...filterBarSpecs(),
]
