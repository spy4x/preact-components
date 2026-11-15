import type { Spec } from "../runner.ts"
import { scrollRegionSpec } from "../scroll-region.ts"

export const specs: readonly Spec[] = [
  scrollRegionSpec({
    what: "CopyBlock with singleLine",
    pageId: "ui",
    selector: `#demo-CopyBlock code[aria-label]`,
    name: "Install command",
    key: "ArrowRight",
  }),
  {
    name: "CopyBlock with singleLine and text that fits: the text is no Tab stop and has no " +
      "role or name, until its box gets too narrow for it or its text gets too wide",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-CopyBlock")
      const text = card.locator(`[data-e2e="copy-block-fits"] code`)
      const plain = text.and(page.locator(":not([tabindex]):not([role]):not([aria-label])"))
      const scrolling = text.and(page.getByRole("group", { name: "Text to copy", exact: true }))
        .and(page.locator(`[tabindex="0"]`))
      // The server renders the Tab stop; it goes once the mounted block has measured its text.
      await plain.waitFor()

      // Back from the block's own copy button, the stop before it is not the text.
      const button = card.getByRole("button", { name: "Copy the short id" })
      await button.focus()
      await page.keyboard.press("Shift+Tab")
      await button.and(page.locator(":focus")).waitFor({ state: "hidden" })
      const stop = await page.locator(":focus").evaluate((node) => node.tagName)
      if (stop === "CODE") throw new Error("Shift+Tab from the copy button landed on the text")

      // A narrower box makes the same text overflow, and a wider one makes it fit again.
      await text.evaluate((node) => node.parentElement?.style.setProperty("width", "120px"))
      await scrolling.waitFor()
      await text.evaluate((node) => node.parentElement?.style.removeProperty("width"))
      await plain.waitFor()

      // Wider text in the same box overflows too: the text is watched, not only the box.
      const line = text.locator("span")
      await line.evaluate((node) => node.style.setProperty("letter-spacing", "3em"))
      await scrolling.waitFor()
      await line.evaluate((node) => node.style.removeProperty("letter-spacing"))
      await plain.waitFor()
      return `the stop before the copy button is a ${stop}`
    },
  },
]
