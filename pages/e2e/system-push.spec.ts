/**
 * Playwright specs for `PushSettings` (`system/`) drawn from `usePushSubscription` (`signals/`), on
 * the `PushSettings` card of the guide's System page.
 *
 * The card runs on a stand-in browser and server (`ui-guide/sections/push-settings.tsx`), because
 * Playwright cannot receive a real push: these specs prove what the page does around the
 * permission, the subscription and the server call, not that a notification arrives.
 */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"

const CARD = "#demo-PushSettings"

/** The parts of one case of the card: `allow` or `deny`, by what its browser answers. */
function pushCase(page: Page, name: "allow" | "deny") {
  const selector = `${CARD} [data-e2e="push-${name}"]`
  const root = page.locator(selector)
  const block = root.getByRole("group", { name: "Notifications" })
  const announcement = block.getByRole("status")
  return {
    root,
    block,
    turnOn: block.getByRole("button", { name: "Turn on notifications" }),
    turnOff: block.getByRole("button", { name: "Turn off notifications" }),
    test: block.getByRole("button", { name: "Send a test notification" }),
    failNext: root.locator(`[data-e2e="push-fail-next"]`),
    blockAway: root.locator(`[data-e2e="push-block-away"]`),
    /** Waits for the block to show one state. */
    statusIs: (status: string) =>
      block.and(page.locator(`[data-push-status="${status}"]`)).waitFor(),
    /** Waits for the line under the block: what the browser and the server hold. */
    holds: (prompts: number, subscribed: "yes" | "no", stored: number) =>
      root.locator(`[data-e2e="push-state"]`).getByText(
        `prompts shown: ${prompts}, browser subscribed: ${subscribed}, server has: ${stored}`,
        { exact: true },
      ).waitFor(),
    /** Waits for the live region to hold exactly this text. */
    announces: (text: string) => announcement.getByText(text, { exact: true }).waitFor(),
    /** What the live region holds now. */
    announced: () => announcement.evaluate((element) => element.textContent ?? ""),
    /** Waits for the focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
    /** Fails when axe finds a violation inside the block. */
    axe: async (state: string) => {
      const { violations } = await new AxeBuilder({ page }).include(
        `${selector} [data-push-status]`,
      ).analyze()
      if (violations.length > 0) {
        throw new Error(`axe on the ${state} block: ${violations.map(({ id }) => id).join(", ")}`)
      }
    },
  }
}

export const specs: readonly Spec[] = [
  {
    name:
      "PushSettings: no permission prompt and no announcement before the press; Turn on prompts once, stores the subscription and becomes Turn off under the same focus; a test and Turn off are announced too",
    pageId: "system",
    run: async (page) => {
      const push = pushCase(page, "allow")

      await push.statusIs("off")
      await push.holds(0, "no", 0)
      const early = await push.announced()
      if (early !== "") throw new Error(`the block announced "${early}" on page load`)
      await push.axe("off")

      await push.turnOn.click()
      await push.statusIs("on")
      await push.holds(1, "yes", 1)
      await push.focusIsOn(push.turnOff)
      await push.announces("Notifications turned on.")
      await push.axe("on")

      await push.test.click()
      await push.announces("Test notification sent. It should arrive in a moment.")
      await push.focusIsOn(push.test)

      await push.turnOff.click()
      await push.statusIs("off")
      await push.holds(1, "no", 0)
      await push.focusIsOn(push.turnOn)
      await push.announces("Notifications turned off.")
    },
  },
  {
    name:
      "PushSettings: when the server refuses the subscription, the browser unsubscribes again, the block stays off, and the failure is shown, announced and tied to the button",
    pageId: "system",
    run: async (page) => {
      const push = pushCase(page, "allow")
      const failure = "Notifications could not be turned on. Try again."

      await push.statusIs("off")
      await push.failNext.click()
      await push.turnOn.click()

      await push.block.locator(`[data-push-message="enable"]`).getByText(failure).waitFor()
      await push.announces(failure)
      await push.statusIs("off")
      await push.holds(1, "no", 0)
      await push.focusIsOn(push.turnOn)
      await push.block.getByRole("button", { name: "Turn on notifications", description: failure })
        .waitFor()

      // The next press works, and takes the failure away.
      await push.turnOn.click()
      await push.statusIs("on")
      await push.holds(1, "yes", 1)
      await push.block.locator("[data-push-message]").waitFor({ state: "detached" })
    },
  },
  {
    name:
      "PushSettings: when the person blocks the prompt, the block explains how to allow notifications, has no button left, and the focus moves to the explanation, which is not announced a second time",
    pageId: "system",
    run: async (page) => {
      const push = pushCase(page, "deny")
      const explanation = push.block.getByText("Notifications are blocked for this app")

      await push.statusIs("off")
      await push.turnOn.click()

      await push.statusIs("blocked")
      await push.holds(1, "no", 0)
      await push.block.getByRole("button").first().waitFor({ state: "detached" })
      await push.focusIsOn(explanation)
      // The focused explanation is read out; the live region saying it too would say it twice.
      const announced = await push.announced()
      if (announced !== "") throw new Error(`the block also announced "${announced}"`)
      await push.axe("blocked")
    },
  },
  {
    name:
      "PushSettings: notifications blocked in the browser's settings while the page was away show as blocked, and are announced, when the page comes back",
    pageId: "system",
    run: async (page) => {
      const push = pushCase(page, "allow")

      await push.turnOn.click()
      await push.statusIs("on")
      await push.blockAway.click()

      await push.statusIs("blocked")
      await push.announces(
        "Notifications are blocked for this app. To allow them, open your browser's settings for this site, or your device's notification settings for this app, set Notifications to Allow, then come back here.",
      )
    },
  },
  {
    name:
      "usePushSubscription: a key that arrives after the first render moves the block from checking to off, and taking the block off the page removes its listener",
    pageId: "system",
    run: async (page) => {
      const root = page.locator(`${CARD} [data-e2e="push-late"]`)
      const block = root.getByRole("group", { name: "Notifications" })
      const statusIs = (status: string) =>
        block.and(page.locator(`[data-push-status="${status}"]`)).waitFor()
      /** Draws the count again, then waits for it to read this. */
      const listeners = async (count: number) => {
        await root.locator(`[data-e2e="push-count"]`).click()
        await root.locator(`[data-e2e="push-listeners"]`).getByText(
          `visibility listeners: ${count}`,
          { exact: true },
        ).waitFor()
      }

      await statusIs("checking")
      await block.getByText("Checking this device…").waitFor()
      await root.locator(`[data-e2e="push-give-key"]`).click()
      await statusIs("off")
      await block.getByRole("button", { name: "Turn on notifications" }).waitFor()
      await listeners(1)

      await root.locator(`[data-e2e="push-unmount"]`).click()
      await block.waitFor({ state: "detached" })
      await listeners(0)
    },
  },
  {
    name:
      "PushSettings: at 375 px wide, both buttons of the on state stay inside the block, each name on one line",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const push = pushCase(page, "allow")

      await push.turnOn.click()
      await push.statusIs("on")
      const frame = await push.block.boundingBox()
      if (!frame || frame.x < 0 || frame.x + frame.width > 375) {
        throw new Error(`the block is not inside a 375 px page: ${JSON.stringify(frame)}`)
      }
      for (const button of [push.turnOff, push.test]) {
        const box = await button.boundingBox()
        if (!box || box.x < frame.x || box.x + box.width > frame.x + frame.width + 0.5) {
          throw new Error(
            `a button leaves the block: ${JSON.stringify(box)} in ${JSON.stringify(frame)}`,
          )
        }
        // Two buttons squeezed onto one row break their names over two lines.
        const lines = await button.evaluate((element) => {
          const range = element.ownerDocument.createRange()
          range.selectNodeContents(element)
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
        })
        if (lines !== 1) throw new Error(`a button's name takes ${lines} lines`)
      }
    },
  },
]
