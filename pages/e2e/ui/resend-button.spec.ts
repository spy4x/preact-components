import { AxeBuilder } from "@axe-core/playwright"
import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "ResendButton: a 44 px button sends by keyboard, keeps focus while busy, hands focus " +
      "to the sent line, then the countdown ticks in a sentence no live region announces until " +
      "the button comes back",
    pageId: "ui",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 800 })
      const card = page.locator(`[data-e2e="resend-button-demo"]`)
      const send = card.getByRole("button", { name: "Send a new link", exact: true })
      await send.scrollIntoViewIfNeeded()
      const box = await send.boundingBox()
      if (box === null || box.height < 44) throw new Error(`the button is ${box?.height} px tall`)
      const { violations } = await new AxeBuilder({ page })
        .include(`[data-e2e="resend-button-demo"]`).analyze()
      if (violations.length > 0) {
        throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("; "))
      }

      await send.focus()
      await page.keyboard.press("Enter")
      await card.locator(`[aria-busy="true"]:focus`).filter({ hasText: "Sending…" }).waitFor()
      const sent = card.locator(`[data-e2e="resend-button-sent"]:focus`)
      await sent.filter({ hasText: "A new link is on its way." }).waitFor()

      const waiting = card.locator(`[data-e2e="resend-button-waiting"]`)
      const first = await waiting.textContent()
      await waiting.filter({ hasNotText: first ?? "" }).filter({ hasText: "seconds" }).waitFor()
      const live = await waiting.evaluate((element) =>
        element.getAttribute("aria-live") === "off" &&
        element.parentElement?.closest("[aria-live], [role=status], [role=alert]") === null
      )
      if (!live) throw new Error("the countdown is not kept out of every live region")
      if (await card.getByRole("button").count() > 0) {
        throw new Error("a button is drawn while the cooldown runs")
      }
      await send.waitFor()
      await card.locator(`[data-e2e="resend-button-demo-count"]`).filter({ hasText: "1" })
        .waitFor()
    },
  },
]
