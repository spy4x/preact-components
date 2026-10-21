/** Playwright specs for `icons/`, on the guide's icon gallery. */
import type { Spec } from "./runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "IconSpinner spins, and stops under reduced motion",
    pageId: "icons",
    run: async (page) => {
      const spinners = page.locator("svg.animate-spin")
      await spinners.first().waitFor()
      const names = () =>
        spinners.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName))

      const moving = await names()
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await names()

      if (moving.length < 1 || moving.some((found) => found !== "spin")) {
        throw new Error(`without reduced motion: animations [${moving}], expected one spinning`)
      }
      if (reduced.some((found) => found !== "none")) {
        throw new Error(`under reduced motion still runs [${reduced}]`)
      }
      return `stopped ${reduced.length} spinning icons`
    },
  },
  {
    // Replaces the "clicking an icon copies its JSX" check in `pages/checks/icons.ts`, which passed
    // whether or not the copy worked.
    name: "IconGallery copies an icon's JSX and announces it only when the clipboard took it",
    pageId: "icons",
    run: async (page) => {
      const gallery = page.locator("#icons")
      const status = gallery.locator("p[aria-live]")
      const cell = gallery.locator(`button[data-icon="IconSearch"]`)
      await cell.waitFor()
      // The guide's port is `copyToClipboard`: the Async Clipboard API, then `execCommand`. Both
      // are replaced, so the spec decides whether a copy works and counts the attempts.
      await page.evaluate(() => {
        const state = globalThis as {
          __copyWorks?: boolean
          __copyTries?: number
          __copied?: string
        }
        state.__copyWorks = true
        state.__copyTries = 0
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: (text: string) => {
              state.__copyTries = (state.__copyTries ?? 0) + 1
              state.__copied = text
              return state.__copyWorks ? Promise.resolve() : Promise.reject(new Error("denied"))
            },
          },
        })
        document.execCommand = () => false
      })

      await cell.click()
      await status.filter({ hasText: "copied <IconSearch />" }).waitFor()
      const copied = await page.evaluate(() => (globalThis as { __copied?: string }).__copied)
      if (copied !== "<IconSearch />") {
        throw new Error(`the clipboard got ${JSON.stringify(copied)}`)
      }

      await page.evaluate(() => (globalThis as { __copyWorks?: boolean }).__copyWorks = false)
      await cell.click()
      await page.waitForFunction(() => (globalThis as { __copyTries?: number }).__copyTries === 2)
      // The rejection settles in microtasks after the attempt; one frame covers them and the
      // render that follows.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
      const text = await status.textContent()
      if (text?.includes("copied")) {
        throw new Error(`after a failed copy the status reads "${text}"`)
      }
      return `status "${text}"`
    },
  },
]
