import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"
import { scrollRegionSpec } from "../scroll-region.ts"
import { axePasses } from "./shared.ts"

/**
 * `BrandMark`, `PageHero`, `FaqList`, `FeatureCard`, `Steps` and `WindowFrame`: the blocks of a
 * public page, which need no JavaScript.
 */
function marketingBlockSpecs(): Spec[] {
  const cards = [
    "#demo-BrandMark",
    "#demo-PageHero",
    "#demo-FaqList",
    "#demo-FeatureCard",
    "#demo-Steps",
    "#demo-WindowFrame",
  ] as const
  return [
    {
      name:
        "FaqList: a click on a question opens it, and opening another closes it, as one named group",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-FaqList")
        const first = card.locator("details").nth(0)
        const second = card.locator("details").nth(1)
        await first.locator("summary").click()
        await first.and(page.locator("details[open]")).waitFor()
        await second.locator("summary").click()
        await second.and(page.locator("details[open]")).waitFor()
        await first.and(page.locator("details:not([open])")).waitFor()
      },
    },
    {
      name: "WindowFrame: the terminal is dark on a light page",
      pageId: "ui",
      colorScheme: "light",
      run: async (page) => {
        const terminal = page.locator(`#demo-WindowFrame figure:has([role="group"]) > div`).first()
        await terminal.waitFor()
        const luminance = await terminal.evaluate((node) => {
          const canvas = document.createElement("canvas")
          canvas.width = canvas.height = 1
          const context = canvas.getContext("2d")!
          context.fillStyle = getComputedStyle(node).backgroundColor
          context.fillRect(0, 0, 1, 1)
          const [r, g, b] = context.getImageData(0, 0, 1, 1).data
          const channel = (value: number) => {
            const c = value / 255
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        })
        if (luminance > 0.05) throw new Error(`terminal background luminance ${luminance}`)
      },
    },
    scrollRegionSpec({
      what: "WindowFrame terminal",
      pageId: "ui",
      selector: `#demo-WindowFrame div[role="group"][tabindex="0"]`,
      name: "Install",
      key: "ArrowRight",
    }),
    ...(["light", "dark", "ink"] as const).map((palette): Spec => ({
      name: `BrandMark, PageHero, FaqList, FeatureCard, Steps and WindowFrame: axe finds no ` +
        `violation, their text's contrast included, ${palette}`,
      pageId: "ui",
      colorScheme: palette === "light" ? "light" : "dark",
      run: async (page) => {
        await page.locator(cards[0]).waitFor()
        if (palette === "ink") {
          // The guide bundles ink.css; it paints once `data-theme="ink"` joins `.dark` on <html>.
          await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
          await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
        }
        // The guide's dotted stage is a gradient, over which axe leaves every text's contrast
        // unmeasured. Flat, it measures the blocks' own text against the surface under them.
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const mark = await new AxeBuilder({ page }).include(`[data-e2e="brand-mark"]`)
          .withRules(["color-contrast"]).analyze()
        if (mark.passes.length === 0 && mark.violations.length === 0) {
          throw new Error("axe did not measure the BrandMark's contrast")
        }
        return await axePasses(page, cards)
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...marketingBlockSpecs(),
]
