import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "Notice with onDismiss: at 390 px the close button is a named 44 px target in the " +
      "top corner, passes axe, and pressing it calls the caller, which hides the notice",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 800 })
      const notice = page.locator(`[data-e2e="notice-dismissible"]`)
      const close = notice.getByRole("button", { name: "Hide this message", exact: true })
      await close.scrollIntoViewIfNeeded()
      const box = await close.boundingBox()
      const root = await notice.boundingBox()
      if (box === null || root === null) {
        throw new Error("the notice or its close button is not drawn")
      }
      if (box.width < 44 || box.height < 44) {
        throw new Error(`the close button is ${box.width}x${box.height} px, under 44 px`)
      }
      if (box.y - root.y > 8) throw new Error(`the close button sits ${box.y - root.y} px down`)
      const { violations } = await new AxeBuilder({ page })
        .include(`[data-e2e="notice-dismissible"]`).analyze()
      if (violations.length > 0) {
        throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("; "))
      }
      await close.click()
      await notice.waitFor({ state: "detached" })
      await page.locator(`[data-e2e="notice-show-again"]`).click()
      await notice.waitFor()
    },
  },
]
