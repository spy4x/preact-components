import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/** The job set's words, in the order the `StatusMark` card draws them. */
const JOB_WORDS = [
  "Running",
  "Done",
  "Parked",
  "Blocked",
  "Waiting",
  "Failed",
  "Out of time",
  "Out of budget",
  "Out of turns",
  "Stopped",
  "Queued",
  "Claimed",
]

const JOBS = `#demo-StatusMark [data-e2e="status-mark-jobs"]`

/** Each job mark's word, its shape's markup and its shape's computed animation. */
async function jobMarks(page: Page) {
  return await page.locator(JOBS).evaluate((list) =>
    [...list.querySelectorAll(":scope > * > span")].map((mark) => {
      const shape = mark.querySelector(`[aria-hidden="true"]`)
      return {
        word: mark.textContent?.trim() ?? "",
        svg: shape?.innerHTML ?? "",
        animation: shape ? getComputedStyle(shape).animationName : "",
      }
    })
  )
}

/** The proof for one palette: words, shapes, the pulse with and without reduced motion, axe. */
async function proveJobMarks(page: Page): Promise<string> {
  await page.locator(JOBS).scrollIntoViewIfNeeded()
  const marks = await jobMarks(page)
  const words = marks.map((mark) => mark.word)
  if (JSON.stringify(words) !== JSON.stringify(JOB_WORDS)) {
    throw new Error(`the job marks read ${JSON.stringify(words)}`)
  }
  const shapes = new Set(marks.map((mark) => mark.svg))
  if (shapes.size !== JOB_WORDS.length || shapes.has("")) {
    throw new Error(`${shapes.size} distinct shapes for ${JOB_WORDS.length} job statuses`)
  }
  const pulsing = marks.filter((mark) => mark.animation !== "none").map((mark) => mark.word)
  if (JSON.stringify(pulsing) !== JSON.stringify(["Running"])) {
    throw new Error(`the shapes that animate are ${JSON.stringify(pulsing)}, not only Running`)
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  const still = (await jobMarks(page)).filter((mark) => mark.animation !== "none")
  if (still.length > 0) {
    throw new Error(`under reduced motion ${still.map((mark) => mark.word)} still animate`)
  }
  return await axePasses(page, [JOBS])
}

export const specs: readonly Spec[] = (["light", "dark"] as const).map((colorScheme) => ({
  name: `StatusMark job statuses (${colorScheme}): each of the twelve shows its word beside its ` +
    "own shape, only Running pulses and it holds still under reduced motion, and axe passes",
  pageId: "ui",
  colorScheme,
  run: proveJobMarks,
}))
