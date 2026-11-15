import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

type Tracked = typeof globalThis & { e2eSecondTimers?: Set<number> }

/**
 * Records every one-second `setInterval` the page starts from now on, and forgets it when it is
 * cleared, so a spec can count the timers still running.
 */
async function trackSecondTimers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = new Set<number>()
    const realSet = globalThis.setInterval
    const realClear = globalThis.clearInterval
    globalThis.setInterval = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
      const id = realSet(handler, ms, ...rest)
      if (ms === 1000) active.add(id)
      return id
    }) as typeof globalThis.setInterval
    globalThis.clearInterval = ((id?: number) => {
      if (id !== undefined) active.delete(id)
      realClear(id)
    }) as typeof globalThis.clearInterval
    ;(globalThis as Tracked).e2eSecondTimers = active
  })
}

/** Waits until exactly `count` one-second timers run. */
async function secondTimersAre(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    (count) => (globalThis as Tracked).e2eSecondTimers?.size === count,
    count,
  )
}

export const specs: readonly Spec[] = [
  {
    name: "Elapsed: ended jobs show fixed times with an ISO datetime, Start makes the queued job " +
      "tick once a second, Stop clears its timer, unmounting a running one clears it too, and " +
      "axe passes",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-Elapsed")
      const jobs = card.locator(`[data-e2e="elapsed-jobs"] > li`)
      const step = card.locator(`[data-e2e="elapsed-step"]`)
      await card.scrollIntoViewIfNeeded()
      await jobs.nth(1).locator(`time[datetime="PT1H2M3S"]`, { hasText: "1:02:03" }).waitFor()
      await jobs.nth(2).locator(`time[datetime="PT20M"]`, { hasText: "20:00" }).waitFor()
      const first = jobs.nth(0)
      await first.getByText("Not started", { exact: true }).waitFor()
      await first.getByText("Queued", { exact: true }).waitFor()

      await trackSecondTimers(page)
      await step.click()
      await first.getByText("Running", { exact: true }).waitFor()
      await first.locator(`time[datetime="PT1S"]`, { hasText: "00:01" }).waitFor()
      await first.locator(`time[datetime="PT2S"]`, { hasText: "00:02" }).waitFor()
      await secondTimersAre(page, 1)
      const axe = await axePasses(page, ["#demo-Elapsed"])

      await step.click()
      await first.getByText("Stopped", { exact: true }).waitFor()
      await secondTimersAre(page, 0)
      const frozen = await first.locator("time").textContent()

      // Reset, Start again, then open another page, which unmounts the card while it ticks.
      await step.click()
      await step.click()
      await first.getByText("Running", { exact: true }).waitFor()
      await secondTimersAre(page, 1)
      await page.evaluate(() => location.hash = "#/icons")
      await card.waitFor({ state: "detached" })
      await secondTimersAre(page, 0)
      return `stopped at ${frozen}; ${axe}`
    },
  },
]
