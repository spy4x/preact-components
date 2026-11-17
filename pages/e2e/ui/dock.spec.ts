import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** The gap, in pixels, between the dock and the window's bottom and end edges from `md` up. */
const EDGE_GAP = 16

/**
 * Opens the `Dock` card at the given window size, shows the dock (it starts expanded) and returns
 * the parts a spec drives.
 */
async function showDock(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  const card = page.locator("#demo-Dock")
  await card.scrollIntoViewIfNeeded()
  await card.locator(`[data-e2e="dock-show"]`).click()
  const dock = page.locator(`[data-e2e="dock"]`)
  const toggle = dock.locator(`[data-e2e="dock-toggle"]`)
  await toggle.waitFor()
  return {
    card,
    dock,
    toggle,
    panel: dock.locator("> div"),
    region: page.getByRole("region", { name: "Decisions" }),
    last: card.locator(`[data-e2e="dock-last"]`),
    show: card.locator(`[data-e2e="dock-show"]`),
    arrive: card.locator(`[data-e2e="dock-arrive"]`),
    /** Waits until the toggle says the dock is expanded, or collapsed. */
    expanded: (open: boolean) => toggle.and(page.locator(`[aria-expanded="${open}"]`)).waitFor(),
    /** Waits for focus to be on one element. */
    focusIsOn: (target: Locator) => target.and(page.locator(":focus")).waitFor(),
  }
}

/** The element's box, or a thrown error naming `what`. */
async function boxOf(target: Locator, what: string) {
  const box = await target.boundingBox()
  if (box === null) throw new Error(`${what} has no box`)
  return box
}

/** Throws unless `actual` is within a pixel of `expected`. */
function near(actual: number, expected: number, what: string): void {
  if (Math.abs(actual - expected) > 1) throw new Error(`${what} is ${actual}px, not ${expected}px`)
}

/**
 * Puts focus on the dock's toggle and waits until the item's keys listen: the item draws its `1`
 * hint in the render focus causes, and Preact attaches the key listener after the next frame.
 */
async function focusInside(page: Page, toggle: Locator): Promise<void> {
  await toggle.focus()
  await page.locator(`[data-e2e="dock"] [aria-keyshortcuts="1"]`).waitFor()
  await page.evaluate(() =>
    new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  )
}

/** Leaves focus on nothing, so a key press lands on the page outside the dock. */
async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

export const specs: readonly Spec[] = [
  {
    name:
      "Dock: collapsed it is one toggle named Decisions: 3, expanded a region named Decisions; " +
      "Escape on a button or in an empty field collapses it and focuses the toggle, Escape in a " +
      "field with text does not; axe passes both ways",
    pageId: "ui",
    run: async (page) => {
      const { dock, toggle, region, expanded, focusIsOn } = await showDock(page)
      await page.getByRole("button", { name: "Decisions: 3" }).waitFor()
      await region.waitFor()
      const open = await axePasses(page, [`[data-e2e="dock"]`])

      await toggle.click()
      await expanded(false)
      await region.waitFor({ state: "detached" })
      near((await boxOf(toggle, "the collapsed toggle")).height, 44, "the collapsed bar's height")
      const closed = await axePasses(page, [`[data-e2e="dock"]`])

      await toggle.click()
      await expanded(true)
      await dock.getByRole("button", { name: "Add a note" }).click()
      const note = dock.locator("textarea")
      await note.fill("Ship after lunch")
      await page.keyboard.press("Escape")
      await expanded(true)
      await note.fill("")
      await page.keyboard.press("Escape")
      await expanded(false)
      await focusIsOn(toggle)

      await toggle.click()
      await expanded(true)
      await dock.getByRole("button", { name: /Release today/ }).focus()
      await page.keyboard.press("Escape")
      await expanded(false)
      await focusIsOn(toggle)
      return `expanded: ${open}; collapsed: ${closed}`
    },
  },
  {
    name:
      "Dock: with focus inside, the page's d and the Buttons card's n do nothing while the item's " +
      "own keys work; with focus outside, d opens and closes the dock and the item's keys do nothing",
    pageId: "ui",
    run: async (page) => {
      const { dock, toggle, last, expanded } = await showDock(page)
      const notes = page.locator(`[data-e2e="hotkey-count"]`)
      const notesBefore = await notes.textContent()

      await focusInside(page, toggle)
      await page.keyboard.press("d")
      await expanded(true)
      await page.keyboard.press("n")
      await dock.locator("textarea:focus").waitFor()
      if (await notes.textContent() !== notesBefore) {
        throw new Error(
          `the page's New note ran from inside the dock: ${await notes.textContent()}`,
        )
      }

      await blur(page)
      await page.keyboard.press("1")
      if (await last.textContent() !== "No answer yet.") {
        throw new Error(`1 outside the dock answered: ${await last.textContent()}`)
      }
      await page.keyboard.press("d")
      await expanded(false)
      await page.keyboard.press("d")
      await expanded(true)

      await focusInside(page, toggle)
      await page.keyboard.press("1")
      await last.filter({ hasText: "Last answer: Release today" }).waitFor()
      await page.getByRole("button", { name: "Decisions: 2" }).waitFor()
    },
  },
  {
    name: "Dock: a change of its content moves no focus, whether focus is outside it or inside",
    pageId: "ui",
    run: async (page) => {
      const { toggle, show, arrive } = await showDock(page)
      const checks = [["outside", show, 4], ["inside", toggle, 5]] as const
      for (const [where, holder, count] of checks) {
        await holder.focus()
        // A dispatched click, so the button that changes the content does not take focus itself.
        await arrive.dispatchEvent("click")
        await page.getByRole("button", { name: `Decisions: ${count}` }).waitFor()
        const kept = await holder.evaluate((element) => document.activeElement === element)
        if (!kept) {
          throw new Error(`focus left the element ${where} the dock when its content changed`)
        }
      }
    },
  },
  {
    name:
      "Dock: at 1440 px it sits 16 px from the bottom and end edges, 384 px wide, at the start in " +
      "right-to-left; at 390 px it spans the width at the bottom; a bottom toast stacks above it, " +
      "and pb-dock pads by the height it publishes",
    pageId: "ui",
    run: async (page) => {
      const { card, toggle, panel, expanded } = await showDock(page)
      const width = () => page.evaluate(() => document.documentElement.clientWidth)
      let box = await boxOf(panel, "the dock")
      near(box.width, 384, "the dock's width")
      near(box.x + box.width, await width() - EDGE_GAP, "the dock's end edge")
      near(box.y + box.height, 900 - EDGE_GAP, "the dock's bottom edge")

      await card.evaluate((element) => element.setAttribute("dir", "rtl"))
      box = await boxOf(panel, "the right-to-left dock")
      near(box.x, EDGE_GAP, "the right-to-left dock's start edge")
      await card.evaluate((element) => element.removeAttribute("dir"))

      const padded = await page.evaluate(() => {
        const probe = Object.assign(document.createElement("div"), { className: "pb-dock" })
        document.body.append(probe)
        const pad = getComputedStyle(probe).paddingBottom
        probe.remove()
        return [pad, document.querySelector(`[data-e2e="dock"]`)?.getBoundingClientRect().height]
      })
      if (padded[0] !== `${padded[1]}px`) {
        throw new Error(`pb-dock pads ${padded[0]}, the dock is ${padded[1]}px tall`)
      }

      const evidence: string[] = []
      for (const [viewport, height] of [[1440, 900], [390, 844]] as const) {
        await page.setViewportSize({ width: viewport, height })
        await expanded(true)
        const toastr = page.locator("#demo-Toastr")
        await toastr.locator(`input[name="guide-toastr-corner"][value="bottom-right"]`)
          .dispatchEvent("click")
        await toastr.locator(`[data-e2e="toast-info"]`).dispatchEvent("click")
        const toast = page.locator(`[data-e2e="guide-toastr"] [data-e2e="guide-toast-info"]`)
          .last()
        await toast.waitFor()
        await toast.evaluate((element) =>
          Promise.all(element.getAnimations().map((animation) => animation.finished))
        )
        const toastBox = await boxOf(toast, "the toast")
        const dockBox = await boxOf(panel, "the dock")
        if (toastBox.y + toastBox.height > dockBox.y) {
          throw new Error(
            `at ${viewport} px the toast ends at ${toastBox.y + toastBox.height}px, below the ` +
              `dock's top at ${dockBox.y}px`,
          )
        }
        if (viewport === 390) {
          near(dockBox.width, await width(), "the phone dock's width")
          near(dockBox.y + dockBox.height, height, "the phone dock's bottom edge")
          if (dockBox.height > height * 0.8 + 1) {
            throw new Error(`the phone sheet is ${dockBox.height}px tall, over 80% of ${height}px`)
          }
        }
        evidence.push(
          `${viewport}px: toast bottom ${toastBox.y + toastBox.height}, dock top ${dockBox.y}`,
        )
      }
      await toggle.waitFor()
      return evidence.join("; ")
    },
  },
]
