import type { Spec } from "../runner.ts"
import { scrollRegionSpec } from "../scroll-region.ts"
import { axePasses } from "./shared.ts"

/**
 * `Prose`'s table regions and heading anchors, `DocsNav`, `PrevNext`, `ChangeList` and
 * `SectionHeading`: the blocks of a docs site, a changelog and a feature page.
 */
function docsBlockSpecs(): Spec[] {
  const cards = [
    "#demo-Prose",
    "#demo-DocsNav",
    "#demo-PrevNext",
    "#demo-ChangeList",
    "#demo-SectionHeading",
  ] as const
  return [
    scrollRegionSpec({
      what: "Prose wide table",
      pageId: "ui",
      selector: `#demo-Prose [data-prose-table][aria-labelledby="guide-prose-runs"]`,
      name: "Runs per month",
      key: "ArrowRight",
      role: "region",
      width: 390,
    }),
    {
      // The page check below is a guard only: the guide's card clips, so no mutation made the
      // page itself scroll.
      name: "Prose at 390 px: a long code path in a table's first column wraps, so the text " +
        "column keeps at least 40% of the table's region",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        const region = page.locator(`#demo-Prose [data-prose-table]`)
          .and(page.getByRole("region", { name: "Files", exact: true }))
        await region.waitFor()
        const sizes = await region.evaluate((node) => ({
          region: node.clientWidth,
          text: node.querySelector("tbody td:last-child")?.getBoundingClientRect().width ?? 0,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }))
        const share = Math.round(sizes.text / sizes.region * 100)
        if (share < 40) {
          throw new Error(`the text column is ${share}% of the ${sizes.region}px region`)
        }
        if (sizes.page > 0) throw new Error(`the page scrolls ${sizes.page}px sideways`)
        return `the text column is ${share}% of the ${sizes.region}px region`
      },
    },
    {
      name:
        "Prose at 1440 px: a file path in a table cell stays on one line when the table has room",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        const region = page.locator(`#demo-Prose [data-prose-table]`)
          .and(page.getByRole("region", { name: "Files", exact: true }))
        await region.waitFor()
        const broken = await region.evaluate((node) =>
          [...node.querySelectorAll("td code")]
            .filter((code) => code.getClientRects().length > 1)
            .map((code) => code.textContent)
        )
        if (broken.length) throw new Error(`these paths break across lines: ${broken.join(", ")}`)
        return "every path in the Files table is on one line"
      },
    },
    {
      name: "Prose at 390 px: a short code name in a table cell is not broken between letters",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 900 })
        const regions = page.locator(`#demo-Prose [data-prose-table]`)
        await regions.first().waitFor()
        const codes = await regions.evaluateAll((nodes) =>
          nodes.flatMap((node) => [...node.querySelectorAll("td code")])
            .filter((code) => (code.textContent ?? "").length <= 12)
            .map((code) => ({ text: code.textContent, lines: code.getClientRects().length }))
        )
        if (!codes.length) throw new Error("no table in the Prose example holds a short code name")
        const broken = codes.filter(({ lines }) => lines > 1).map(({ text }) => text)
        if (broken.length) {
          throw new Error(`these names break between letters: ${broken.join(", ")}`)
        }
        return `kept whole: ${codes.map(({ text }) => text).join(", ")}`
      },
    },
    {
      name: "Prose: a heading's anchor is hidden until the keyboard focuses it, and links to it",
      pageId: "ui",
      run: async (page) => {
        const anchor = page.locator(`#demo-Prose a[data-prose-anchor][href="#guide-prose-why"]`)
          .and(page.getByRole("link", { name: "Link to this section", exact: true }))
        await anchor.waitFor({ state: "attached" })
        const opacity = () => anchor.evaluate((node) => getComputedStyle(node).opacity)
        if (await opacity() !== "0") throw new Error(`unfocused, its opacity is ${await opacity()}`)
        await page.locator("#demo-Prose").getByRole("link", { name: "a worked example" }).focus()
        await page.keyboard.press("Tab")
        await anchor.and(page.locator(":focus")).waitFor()
        if (await opacity() !== "1") throw new Error(`focused, its opacity is ${await opacity()}`)
        await page.keyboard.press("Enter")
        await page.waitForURL(/#guide-prose-why$/)
      },
    },
    {
      name: "ChangeList: the fixes stay folded until their count is clicked, then show",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ChangeList")
        const fix = card.getByText("The menu closes on Escape.")
        await card.waitFor()
        if (await fix.isVisible()) throw new Error("a fix shows before its details is opened")
        await card.locator("summary").filter({ hasText: "2 fixes" }).click()
        await fix.waitFor()
      },
    },
    {
      name:
        "SectionHeading: its anchor is hidden until the keyboard focuses it, and links to the " +
        "section",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-SectionHeading")
        const anchor = card.getByRole("link", { name: "Link to this section", exact: true })
        await anchor.waitFor({ state: "attached" })
        if (await anchor.getAttribute("href") !== "#guide-section-heading") {
          throw new Error(`the anchor links to ${await anchor.getAttribute("href")}`)
        }
        const opacity = () => anchor.evaluate((node) => getComputedStyle(node).opacity)
        if (await opacity() !== "0") throw new Error(`unfocused, its opacity is ${await opacity()}`)
        await card.getByRole("link", { name: "Compare plans" }).focus()
        await page.keyboard.press("Shift+Tab")
        await anchor.and(page.locator(":focus")).waitFor()
        if (await opacity() !== "1") throw new Error(`focused, its opacity is ${await opacity()}`)
        await page.keyboard.press("Enter")
        await page.waitForURL(/#guide-section-heading$/)
      },
    },
    {
      name:
        "SectionHeading: following its anchor leaves the heading in view below the sticky header",
      pageId: "ui",
      run: async (page) => {
        const anchor = page.locator("#demo-SectionHeading")
          .getByRole("link", { name: "Link to this section", exact: true })
        await anchor.focus()
        await page.keyboard.press("Enter")
        await page.waitForURL(/#guide-section-heading$/)
        // The scroll may be smooth: wait until it has brought the heading into the viewport.
        await page.waitForFunction(() => {
          const top = document.getElementById("guide-section-heading")?.getBoundingClientRect().top
          return top !== undefined && top >= 0 && top < innerHeight
        })
        const tops = await page.evaluate(() => ({
          heading: document.getElementById("guide-section-heading")!.getBoundingClientRect().top,
          header: document.querySelector("header.sticky")!.getBoundingClientRect().bottom,
        }))
        if (tops.heading < tops.header) {
          throw new Error(
            `the heading's top is at ${tops.heading} px, under the header's ` +
              `bottom at ${tops.header} px`,
          )
        }
        return `heading at ${tops.heading} px, header ends at ${tops.header} px`
      },
    },
    ...(["light", "dark"] as const).map((palette): Spec => ({
      name: `Prose, DocsNav, PrevNext, ChangeList and SectionHeading: axe finds no violation, ` +
        `their text's ` +
        `contrast included, ${palette}`,
      pageId: "ui",
      colorScheme: palette,
      run: async (page) => {
        await page.locator(cards[0]).waitFor()
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        return await axePasses(page, cards)
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...docsBlockSpecs(),
]
