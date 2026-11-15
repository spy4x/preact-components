import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** The bubble's horizontal edges and the viewport's width, for a `Tooltip` inside `selector`. */
function bubbleEdges(page: Page, selector: string) {
  return page.locator(`${selector} [role="tooltip"] > span`).evaluate((bubble) => {
    const box = bubble.getBoundingClientRect()
    return { left: box.left, right: box.right, width: document.documentElement.clientWidth }
  })
}

/**
 * `Tooltip`, `Progress`, `ZoomableImages` and `ErrorBoundary` give the feedback they promise
 * (#854): a hint stays on screen, a hint and a bar have their names, every image container zooms,
 * and the error screen goes away after a reload port that does not reload. The `focusable={false}`
 * spec replaces `groupTriggerNameCheck` from `pages/checks/ui.ts`, which read the hint off the
 * group.
 */
function feedbackComponentSpecs(): Spec[] {
  return [
    {
      name: "Tooltip: a long hint on a trigger at the left edge of a 390 px screen stays inside it",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        const live = `#demo-Tooltip [data-e2e="tooltip-live"]`
        const trigger = page.locator(`${live} button`)
        // Pinned to the left edge of the screen, as a trigger in an app's first column would be.
        await trigger.evaluate((element) =>
          element.setAttribute("style", "position: fixed; left: 0; top: 200px")
        )
        const before = await bubbleEdges(page, live)
        await trigger.focus()
        try {
          await page.waitForFunction(
            (selector) => {
              const bubble = document.querySelector(`${selector} [role="tooltip"] > span`)
              const box = bubble?.getBoundingClientRect()
              const width = document.documentElement.clientWidth
              return box !== undefined && box.left >= 0 && box.right <= width
            },
            live,
            { timeout: 3_000 },
          )
        } catch {
          const after = await bubbleEdges(page, live)
          throw new Error(
            `the bubble spans ${after.left}…${after.right} px in a ${after.width} px viewport`,
          )
        }
        const after = await bubbleEdges(page, live)
        if (before.left >= 0) {
          throw new Error(`the pinned hint starts at ${before.left} px, so nothing needed clamping`)
        }
        return `bubble ${Math.round(before.left)}…${Math.round(before.right)} px moved to ` +
          `${Math.round(after.left)}…${Math.round(after.right)} px of ${after.width}`
      },
    },
    {
      name: "Tooltip: with focusable={false}, the focused control is described by the hint",
      pageId: "ui",
      run: async (page) => {
        const control = page.locator(`#demo-Tooltip [data-e2e="tooltip-group-control"]`)
        await control.focus()
        await control.and(page.locator(":focus")).waitFor()
        await control.and(page.locator("[aria-describedby]")).waitFor()
        const cdp = await page.context().newCDPSession(page)
        try {
          const { root } = await cdp.send("DOM.getDocument", { depth: 0 })
          const { nodeId } = await cdp.send("DOM.querySelector", {
            nodeId: root.nodeId,
            selector: `#demo-Tooltip [data-e2e="tooltip-group-control"]`,
          })
          const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
            nodeId,
            fetchRelatives: false,
          })
          const description = nodes[0]?.description?.value
          if (description !== "Keeps its own tab stop") {
            throw new Error(`the focused button's description is ${JSON.stringify(description)}`)
          }
          // The group around it keeps the name and adds no tab stop of its own.
          const group = await control.evaluate((button) => {
            const wrapper = button.closest('[role="group"]')
            return {
              name: wrapper?.getAttribute("aria-label") ?? null,
              tabindex: wrapper?.hasAttribute("tabindex") ?? true,
              buttons: wrapper?.querySelectorAll("button").length ?? 0,
            }
          })
          if (group.name !== "Archive the invoice" || group.tabindex || group.buttons !== 1) {
            throw new Error(`the group around the control: ${JSON.stringify(group)}`)
          }
          return `description "${description}", inside a group named "${group.name}"`
        } finally {
          await cdp.detach()
        }
      },
    },
    {
      name: "Progress: a bar with ariaLabel and no caption passes axe's aria-progressbar-name",
      pageId: "ui",
      run: async (page) => {
        // The one bar in the card with no caption to point at.
        const selector = `#demo-Progress [role="progressbar"]:not([aria-labelledby])`
        await page.locator(selector).waitFor()
        const { violations, passes } = await new AxeBuilder({ page })
          .include(selector)
          .withRules(["aria-progressbar-name"])
          .analyze()
        if (violations.length > 0) {
          throw new Error(violations.map(({ id, nodes }) => `${id} on ${nodes.length}`).join(", "))
        }
        if (passes.flatMap(({ nodes }) => nodes).length !== 1) {
          throw new Error("axe did not check the uncaptioned bar")
        }
      },
    },
    {
      name: "ZoomableImages: a second [data-lightbox] container zooms, and a parent re-render " +
        "leaves the focused image focused and its marks untouched",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ZoomableImages")
        const image = card.locator(`[data-e2e="lightbox-second-image"]`)
        const moves = card.locator(`[data-e2e="lightbox-focus-moves"]`)
        await image.and(page.locator(`[role="button"][tabindex="0"]`)).waitFor()
        await image.evaluate((element) => {
          const seen: string[] = []
          ;(globalThis as { __imageMutations?: string[] }).__imageMutations = seen
          new MutationObserver((records) => {
            for (const record of records) seen.push(record.attributeName ?? "")
          }).observe(element, {
            attributes: true,
            attributeFilter: ["role", "tabindex", "aria-label", "data-lightbox-zoom"],
          })
        })
        const movesBefore = Number(await moves.textContent())
        await image.focus()
        await moves.filter({ hasText: String(movesBefore + 1) }).waitFor()
        // The re-render's effects run after a frame; give them two before reading.
        await page.evaluate(() =>
          new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        )
        const after = await image.evaluate((element) => ({
          focused: document.activeElement === element,
          mutations: (globalThis as { __imageMutations?: string[] }).__imageMutations ?? [],
        }))
        if (!after.focused || after.mutations.length > 0) {
          throw new Error(
            `focused ${after.focused}; attributes rewritten: [${after.mutations.join(", ")}]`,
          )
        }

        await page.keyboard.press("Enter")
        const dialog = page.locator("dialog:modal")
        await dialog.getByText("A placeholder image in the second container").first().waitFor()
        await card.locator(`[data-e2e="lightbox-opened"]`).filter({ hasText: "1" }).waitFor()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        await image.and(page.locator(":focus")).waitFor()
      },
    },
    {
      name: "ErrorBoundary: an onReload that does not reload brings the children back",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-ErrorBoundary")
        const view = card.locator(`[data-e2e="error-boundary-break"]`)
        const alert = card.getByRole("alert")
        await view.click()
        await alert.waitFor()
        await alert.getByRole("button", { name: "Reload the page" }).click()
        await view.waitFor()
        await alert.waitFor({ state: "detached" })
        await card.locator(`[data-e2e="error-boundary-reloads"]`).filter({ hasText: "1" }).waitFor()
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...feedbackComponentSpecs(),
]
