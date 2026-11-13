/** Playwright specs for `icons/`, on the guide's icon gallery. */
import type { Page } from "playwright-core"
import type { Spec } from "./runner.ts"

/** The glyphs that point along the reading direction (#876); `icons/+index.test.ts` holds both lists. */
const MIRRORED = [
  "IconArrowLeft",
  "IconArrowRight",
  "IconArrowUpRight",
  "IconArrowUturnLeft",
  "IconArrowUturnRight",
  "IconChevronLeft",
  "IconChevronRight",
  "IconExternal",
  "IconExternalLink",
  "IconList",
  "IconLogout",
].join()

/**
 * The gallery glyphs whose drawing points the other way once the browser has resolved every class:
 * a computed `transform` with a negative determinant. A spinner's rotation keeps it positive.
 */
function flippedGlyphs(page: Page): Promise<string[]> {
  return page.locator("#icons button[data-icon]").evaluateAll((cells) =>
    cells.filter((cell) => {
      const transform = getComputedStyle(cell.querySelector("svg")!).transform
      if (transform === "none") return false
      const { a, b, c, d } = new DOMMatrix(transform)
      return a * d - b * c < 0
    }).map((cell) => cell.getAttribute("data-icon")!).sort()
  )
}

export const specs: readonly Spec[] = [
  {
    name: "IconSpinner and IconLoading spin, and stop under reduced motion",
    pageId: "icons",
    run: async (page) => {
      const spinners = page.locator("svg.animate-spin")
      await spinners.first().waitFor()
      const names = () =>
        spinners.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName))

      const moving = await names()
      await page.emulateMedia({ reducedMotion: "reduce" })
      const reduced = await names()

      if (moving.length < 2 || moving.some((found) => found !== "spin")) {
        throw new Error(`without reduced motion: animations [${moving}], expected two spinning`)
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
  {
    name: "Only the glyphs that point along the line flip, and only on a right-to-left page",
    pageId: "icons",
    run: async (page) => {
      const grid = page.locator("#icons button[data-icon]").first()
      await grid.waitFor()
      const ltr = await flippedGlyphs(page)
      if (ltr.length > 0) throw new Error(`left to right, flipped: ${ltr}`)

      await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"))
      // The gallery's glyphs carry `transition-transform`, so the flip runs for 300 ms.
      await page.waitForFunction(() =>
        [...document.querySelectorAll("#icons button[data-icon] svg")].every((svg) =>
          svg.getAnimations().every((animation) => !(animation instanceof CSSTransition))
        )
      )
      const rtl = await flippedGlyphs(page)
      if (rtl.join() !== MIRRORED) throw new Error(`right to left, flipped [${rtl}]`)

      // The direction sample's `dir="ltr"` row sits inside the right-to-left page: the nearest
      // `dir` decides, so none of its glyphs flips, while the `dir="rtl"` row flips its five.
      const flips = (dir: string) =>
        page.locator(`[data-direction-sample] [data-dir="${dir}"] svg`).evaluateAll((svgs) =>
          svgs.filter((svg) => {
            const transform = getComputedStyle(svg).transform
            if (transform === "none") return false
            const { a, b, c, d } = new DOMMatrix(transform)
            return a * d - b * c < 0
          }).length
        )
      const nested = { ltr: await flips("ltr"), rtl: await flips("rtl") }
      if (nested.ltr !== 0 || nested.rtl !== 5) {
        throw new Error(`direction sample flipped ${nested.ltr} left to right, ${nested.rtl} of 5`)
      }

      return `${rtl.length} of ${await page.locator("#icons button[data-icon]").count()} flipped`
    },
  },
  {
    name: "An open code row's chevron points down on a right-to-left page too",
    pageId: "icons",
    run: async (page) => {
      const details = page.locator(`#icons [data-e2e="usage"] details`)
      await details.waitFor()
      await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"))
      await details.locator("summary").click()
      // Where the chevron's tip ends up: its own `transform` (the flip) first, then `rotate`. The
      // rotation transitions, so the check waits for it to settle pointing down.
      const chevron = details.locator("summary svg")
      await page.waitForFunction(
        (svg) => {
          const style = getComputedStyle(svg!)
          const flip = style.transform === "none" ? new DOMMatrix() : new DOMMatrix(style.transform)
          const turn = new DOMMatrix().rotate(
            style.rotate === "none" ? 0 : parseFloat(style.rotate),
          )
          const tip = turn.multiply(flip).transformPoint({ x: 1, y: 0 })
          return Math.round(tip.x) === 0 && Math.round(tip.y) === 1
        },
        await chevron.elementHandle(),
        { timeout: 2000 },
      ).catch(async () => {
        const style = await chevron.evaluate((svg) => {
          const { rotate, transform } = getComputedStyle(svg)
          return `rotate ${rotate}, transform ${transform}`
        })
        throw new Error(`the open chevron does not point down: ${style}`)
      })
      return "points down"
    },
  },
]
