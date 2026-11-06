import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"

/** Where a coachmark spec pins the demo's target: CSS insets from the viewport's edges. */
interface CoachmarkCorner {
  name: string
  style: string
}

/** The least room, in pixels, a coachmark keeps from every edge of the viewport. */
const COACHMARK_MARGIN = 8

/** The `Coachmark` card's parts, in a window of the given size. */
async function coachmarkCard(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  const card = page.locator("#demo-Coachmark")
  const target = card.locator(`[data-e2e="coachmark-target"]`)
  const surface = card.locator("[data-coachmark-mode]")
  await card.scrollIntoViewIfNeeded()
  return {
    target,
    surface,
    toggle: card.locator(`[data-e2e="coachmark-toggle"]`),
    close: surface.getByRole("button", { name: "Close", exact: true }),
    /** Pins the target to the viewport with these insets. */
    pin: (style: string) =>
      target.evaluate(
        (element, insets) => element.setAttribute("style", `position: fixed; ${insets}`),
        style,
      ),
    /** Opens the coachmark on one side and waits until it is placed beside the target. */
    open: async (side: string) => {
      await card.locator(`[data-e2e="coachmark-placement"]`).selectOption(side)
      // Dispatched, not clicked: a pinned target may cover the button.
      await card.locator(`[data-e2e="coachmark-toggle"]`).dispatchEvent("click")
      await surface.and(page.locator(`:popover-open:not([data-coachmark-mode="sheet"])`)).waitFor()
    },
    /** Waits until the coachmark is closed. */
    closed: () => surface.and(page.locator(":popover-open")).waitFor({ state: "detached" }),
  }
}

/** Two boxes as text, for a failure message. */
async function describeBoxes(surface: Locator, target: Locator): Promise<string> {
  const text = (box: { x: number; y: number; width: number; height: number } | null) =>
    box === null ? "no box" : `x ${Math.round(box.x)} to ${Math.round(box.x + box.width)}, ` +
      `y ${Math.round(box.y)} to ${Math.round(box.y + box.height)}`
  return `coachmark ${text(await surface.boundingBox())}, target ${
    text(await target.boundingBox())
  }`
}

/**
 * A `Coachmark` beside a target pinned near an edge of the viewport, on each side in turn: the
 * whole surface is inside the viewport with a margin, it does not cover its target, and a real
 * click on × closes it. In every case here the asked side or the opposite one has room.
 *
 * @param width The viewport's width.
 * @param height The viewport's height.
 * @param corners Where the target is pinned, one case per corner and side.
 */
function coachmarkInViewportSpec(
  width: number,
  height: number,
  corners: readonly CoachmarkCorner[],
): Spec {
  return {
    name: `Coachmark: in a ${width}x${height} window, beside a target near the ` +
      `${corners.map((corner) => corner.name).join(", ")}, on every side, the whole coachmark ` +
      `is inside the window and off its target, and × can be clicked`,
    pageId: "ui",
    run: async (page) => {
      const { target, surface, close, pin, open, closed } = await coachmarkCard(page, width, height)
      const wrong: string[] = []
      const seen: string[] = []
      for (const corner of corners) {
        for (const side of ["right", "bottom", "left", "top"]) {
          const at = `${corner.name}, ${side}`
          await pin(corner.style)
          await open(side)
          // A trial click waits until the button has stopped moving and can take a click.
          const reachable = await close.click({ trial: true, timeout: 3000 }).then(
            () => true,
            () => false,
          )
          const box = await surface.boundingBox()
          const on = await target.boundingBox()
          if (box === null || on === null) throw new Error(`${at}: a box is missing`)
          const inside = box.x >= COACHMARK_MARGIN && box.y >= COACHMARK_MARGIN &&
            box.x + box.width <= width - COACHMARK_MARGIN &&
            box.y + box.height <= height - COACHMARK_MARGIN
          const covers = box.x < on.x + on.width && box.x + box.width > on.x &&
            box.y < on.y + on.height && box.y + box.height > on.y
          const where = `x ${Math.round(box.x)} to ${Math.round(box.x + box.width)}, ` +
            `y ${Math.round(box.y)} to ${Math.round(box.y + box.height)}`
          seen.push(`${at}: ${where}`)
          if (!inside) wrong.push(`${at}: outside the window, ${where}`)
          if (covers) wrong.push(`${at}: over its target, ${where}`)
          if (!reachable) wrong.push(`${at}: × cannot be clicked`)
          if (reachable) await close.click()
          else await page.keyboard.press("Escape")
          await closed()
        }
      }
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      return seen.join("; ")
    },
  }
}

/** What {@link coachmarkSpecs}' scroll trace counts, one sample per drawn frame. */
interface ScrollTrace {
  /** Frames with the coachmark below its target, above it, and drawn as a sheet. */
  below: number
  above: number
  sheet: number
  /** Frames with the coachmark outside the window, or over its target while a side had room. */
  wrong: string[]
}

/**
 * The `Tour` card's parts, in a 1280x900 window unless told otherwise, with the tour started by
 * Enter on Start.
 */
async function startedTour(page: Page, width = 1280, height = 900) {
  await page.setViewportSize({ width, height })
  const card = page.locator("#demo-Tour")
  const step = card.locator("[data-coachmark-mode]")
  const start = card.locator(`[data-e2e="tour-start"]`)
  await start.press("Enter")
  await step.and(page.locator(":popover-open")).getByRole("heading", { name: "Search everything" })
    .waitFor()
  return {
    step,
    search: card.locator(`[data-e2e="tour-search"]`),
    newProject: card.locator(`[data-e2e="tour-new"]`),
    help: card.locator(`[data-e2e="tour-help"]`),
    helpCompact: card.locator(`[data-e2e="tour-help-compact"]`),
    next: step.getByRole("button", { name: "Next", exact: true }),
    skip: step.getByRole("button", { name: "Skip tour", exact: true }),
  }
}

/** `Coachmark` and `Tour`: where the step is drawn while the page, its target or its text change. */
function coachmarkSpecs(): Spec[] {
  return [
    coachmarkInViewportSpec(1280, 900, [
      { name: "top left", style: "top: 12px; left: 12px" },
      { name: "top right", style: "top: 12px; right: 12px" },
      { name: "bottom left", style: "bottom: 12px; left: 12px" },
      { name: "bottom right", style: "bottom: 12px; right: 12px" },
    ]),
    coachmarkInViewportSpec(700, 900, [{ name: "right edge", style: "top: 120px; right: 12px" }]),
    {
      name: "Coachmark: while the page scrolls its target out through the top edge, back and out " +
        "through the bottom edge, no frame shows the coachmark outside the window, off the centre " +
        "of its target, or over its target while a side has room",
      pageId: "ui",
      run: async (page) => {
        const { target, open } = await coachmarkCard(page, 1280, 900)
        await target.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" })
        )
        await open("bottom")
        const trace = await page.evaluate((margin) =>
          new Promise<ScrollTrace>((resolve) => {
            const card = document.querySelector("#demo-Coachmark")!
            const surface = card.querySelector<HTMLElement>("[data-coachmark-mode]")!
            const target = card.querySelector(`[data-e2e="coachmark-target"]`)!
            // 30 px a frame: 900 px down, 1800 px up, 900 px down again.
            const steps = [...Array(30).fill(30), ...Array(60).fill(-30), ...Array(30).fill(30)]
            const trace: ScrollTrace = { below: 0, above: 0, sheet: 0, wrong: [] }
            let frame = 0
            const tick = () => {
              // A task after the frame's own callbacks: what this frame draws.
              setTimeout(() => {
                const box = surface.getBoundingClientRect()
                const on = target.getBoundingClientRect()
                const bottom = innerHeight - margin
                if (surface.dataset.coachmarkMode === "sheet") trace.sheet++
                else {
                  if (box.top >= on.bottom) trace.below++
                  if (box.bottom <= on.top) trace.above++
                  const outside = box.top < margin || box.bottom > bottom || box.left < margin ||
                    box.right > document.documentElement.clientWidth - margin
                  const room = on.top - margin - box.height >= margin ||
                    on.bottom + margin + box.height <= bottom
                  const covers = box.top < on.bottom && box.bottom > on.top
                  // The target is in the middle of the window, so nothing shifts the coachmark.
                  const aside = Math.abs(box.left + box.right - on.left - on.right) > 2
                  if (outside || aside || (covers && room)) {
                    const what = outside
                      ? "outside the window"
                      : aside
                      ? "off the centre of its target"
                      : "over its target"
                    trace.wrong.push(
                      `frame ${frame}: ${what}, coachmark x ${Math.round(box.left)} to ` +
                        `${Math.round(box.right)}, y ${Math.round(box.top)} to ` +
                        `${Math.round(box.bottom)}, target x ${Math.round(on.left)} to ` +
                        `${Math.round(on.right)}, y ${Math.round(on.top)} to ${
                          Math.round(on.bottom)
                        }`,
                    )
                  }
                }
                if (frame === steps.length) return resolve(trace)
                // Between frames, as a wheel does: the next frame is drawn after this scroll.
                scrollBy({ top: steps[frame++], behavior: "instant" })
                requestAnimationFrame(tick)
              }, 0)
            }
            requestAnimationFrame(tick)
          }), COACHMARK_MARGIN)
        await page.keyboard.press("Escape")
        const counts = `${trace.below} frames below the target, ${trace.above} above it, ` +
          `${trace.sheet} as a sheet`
        if (trace.wrong.length > 0) {
          throw new Error(`${trace.wrong.length} frames: ${trace.wrong.slice(0, 6).join("; ")}`)
        }
        if (trace.below === 0 || trace.above === 0 || trace.sheet === 0) {
          throw new Error(`the scroll did not show every case: ${counts}`)
        }
        return counts
      },
    },
    {
      name: "Coachmark: a target that moves from a corner to the middle of the window, with no " +
        "scroll and no resize, takes the coachmark with it",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, pin, open } = await coachmarkCard(page, 1280, 900)
        await pin("top: 12px; left: 12px")
        await open("bottom")
        await pin("top: 400px; left: 600px")
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Coachmark")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="coachmark-target"]`)!.getBoundingClientRect()
          return on.top === 400 && Math.abs(box.top - on.bottom - gap) <= 1 &&
            Math.abs(box.left + box.width / 2 - on.left - on.width / 2) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not below its target: ${await describeBoxes(surface, target)}`)
        })
        return describeBoxes(surface, target)
      },
    },
    {
      name: "Coachmark: a coachmark that grows by 200 px beside a target in the bottom left " +
        "corner stays inside the window",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, pin, open } = await coachmarkCard(page, 1280, 900)
        await pin("bottom: 12px; left: 12px")
        await open("right")
        const before = await surface.boundingBox()
        if (before === null) throw new Error("the coachmark has no box")
        await surface.locator(`[id$="-body"]`).evaluate((body) => {
          body.style.paddingBottom = "200px"
        })
        await page.waitForFunction(({ height, margin }) => {
          const box = document.querySelector("#demo-Coachmark [data-coachmark-mode]")!
            .getBoundingClientRect()
          return box.height >= height + 200 && box.top >= margin &&
            box.bottom <= innerHeight - margin
        }, { height: before.height, margin: COACHMARK_MARGIN }).catch(async () => {
          throw new Error(
            `${Math.round(before.height)} px tall before; after 200 px more: ` +
              await describeBoxes(surface, target),
          )
        })
        return describeBoxes(surface, target)
      },
    },
    {
      name: "Coachmark: a ref target gets the hint on its right; × closes it and focus goes " +
        "back to its opener",
      pageId: "ui",
      run: async (page) => {
        const { target, surface, toggle, close, closed } = await coachmarkCard(page, 1280, 800)
        await toggle.press("Enter")
        await surface.and(page.locator(`:popover-open:not([data-coachmark-mode="sheet"])`))
          .waitFor()
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Coachmark")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="coachmark-target"]`)!.getBoundingClientRect()
          return Math.abs(box.left - on.right - gap) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not on its right: ${await describeBoxes(surface, target)}`)
        })
        const where = await describeBoxes(surface, target)
        await close.press("Enter")
        await closed()
        await toggle.and(page.locator(":focus")).waitFor()
        return where
      },
    },
    {
      name: "Tour: Start opens the first step below its target, centred on it, with focus on " +
        "its heading",
      pageId: "ui",
      run: async (page) => {
        const { step, search, skip } = await startedTour(page)
        await step.and(page.locator(`:not([data-coachmark-mode="sheet"])`)).waitFor()
        await step.getByRole("heading", { name: "Search everything" }).and(page.locator(":focus"))
          .waitFor()
        await step.getByText("Step 1 of 4", { exact: true }).waitFor()
        await page.waitForFunction((gap) => {
          const card = document.querySelector("#demo-Tour")!
          const box = card.querySelector("[data-coachmark-mode]")!.getBoundingClientRect()
          const on = card.querySelector(`[data-e2e="tour-search"]`)!.getBoundingClientRect()
          return Math.abs(box.top - on.bottom - gap) <= 1 &&
            Math.abs(box.left + box.width / 2 - on.left - on.width / 2) <= 1
        }, COACHMARK_MARGIN).catch(async () => {
          throw new Error(`not below its target: ${await describeBoxes(step, search)}`)
        })
        const where = await describeBoxes(step, search)
        await skip.click()
        return where
      },
    },
    {
      name: "Tour: the step's target gets an outline and the step's text as a description " +
        "after the app's own, and keeps the app's anchor-name as it is",
      pageId: "ui",
      run: async (page) => {
        const { step, search, skip } = await startedTour(page)
        const bodyId = await step.locator(`[id$="-body"]`).getAttribute("id")
        const read = await search.evaluate((element) => ({
          describedBy: element.getAttribute("aria-describedby"),
          anchorName: element.style.getPropertyValue("anchor-name"),
          outline: `${getComputedStyle(element).outlineStyle} ${
            getComputedStyle(element).outlineWidth
          }`,
        }))
        const found = JSON.stringify(read)
        if (
          bodyId === null || read.describedBy !== `tour-search-hint ${bodyId}` ||
          read.anchorName !== "--demo-search" || read.outline !== "solid 2px"
        ) throw new Error(`${found}, the step's text is #${bodyId}`)
        await skip.click()
        return found
      },
    },
    {
      name: "Tour: on a scrolled page, Next from the first step draws the second step inside " +
        "the window, beside its target, and its Next takes a mouse click",
      pageId: "ui",
      run: async (page) => {
        const { step, newProject, next, skip } = await startedTour(page)
        const scrolled = await page.evaluate(() => Math.round(scrollY))
        if (scrolled < 900) throw new Error(`the page is scrolled by only ${scrolled} px`)
        await next.click()
        await step.getByRole("heading", { name: "Start a project" }).waitFor()
        const reachable = await next.click({ trial: true, timeout: 3000 }).then(
          () => true,
          () => false,
        )
        const where = `${await describeBoxes(step, newProject)}, page scrolled ${scrolled} px`
        const box = await step.boundingBox()
        const on = await newProject.boundingBox()
        if (box === null || on === null) throw new Error("a box is missing")
        const inside = box.x >= COACHMARK_MARGIN && box.y >= COACHMARK_MARGIN &&
          box.x + box.width <= 1280 - COACHMARK_MARGIN &&
          box.y + box.height <= 900 - COACHMARK_MARGIN
        const beside = box.x >= on.x + on.width || box.x + box.width <= on.x
        if (!inside || !beside || !reachable) {
          throw new Error(
            `inside the window ${inside}, beside its target ${beside}, Next can be clicked ` +
              `${reachable}: ${where}`,
          )
        }
        await next.click()
        await step.getByRole("heading", { name: "A step with no target" }).waitFor()
        await skip.click()
        return where
      },
    },
    ...[390, 700].map((width): Spec => ({
      name: `Tour: in a ${width} px wide window, a step whose selector matches a hidden and a ` +
        "visible control outlines the visible one and describes it",
      pageId: "ui",
      run: async (page) => {
        const { step, help, helpCompact, next, skip } = await startedTour(page, width, 800)
        for (const title of ["Start a project", "A step with no target", "Ask for help"]) {
          await next.click()
          await step.getByRole("heading", { name: title }).waitFor()
        }
        // The first match in the page is the wide screen's button, which is not drawn here.
        await help.waitFor({ state: "hidden" })
        const bodyId = await step.locator(`[id$="-body"]`).getAttribute("id")
        const outlined = page.locator(`[style*="outline"][aria-describedby="${bodyId}"]`)
        await helpCompact.and(outlined).waitFor().catch(async () => {
          const found = await page.locator("#demo-Tour [data-tour]").evaluateAll((elements) =>
            elements.map((element) =>
              `${element.getAttribute("data-e2e")}: outline "${
                (element as HTMLElement).style.outline
              }", described by ${element.getAttribute("aria-describedby")}`
            ).join("; ")
          )
          throw new Error(`the visible Help button is not the step's target: ${found}`)
        })
        // Below 640 px every step is a sheet; above it this one must sit beside its target.
        const mode = await step.getAttribute("data-coachmark-mode")
        if (width >= 640) {
          await step.and(page.locator(`:not([data-coachmark-mode="sheet"])`)).waitFor()
        }
        await step.getByRole("button", { name: "Go to Help", exact: true }).click()
        await helpCompact.and(page.locator(":focus")).waitFor()
        await skip.click()
        return `the step is drawn as ${mode}`
      },
    })),
    {
      name: "Tour: a step whose only shown match is under visibility: hidden outlines nothing, " +
        "offers no Go to and is a sheet",
      pageId: "ui",
      run: async (page) => {
        const { step, help, next, skip } = await startedTour(page)
        await help.evaluate((element) => element.style.visibility = "hidden")
        for (const title of ["Start a project", "A step with no target", "Ask for help"]) {
          await next.click()
          await step.getByRole("heading", { name: title }).waitFor()
        }
        await step.and(page.locator(`[data-coachmark-mode="sheet"]`)).waitFor()
        const read = await help.evaluate((element) => ({
          outline: element.style.outline,
          describedBy: element.getAttribute("aria-describedby"),
        }))
        const goTo = await step.getByRole("button", { name: /^Go to/ }).count()
        const found = `${JSON.stringify(read)}, Go to buttons ${goTo}`
        if (read.outline !== "" || read.describedBy !== null || goTo !== 0) throw new Error(found)
        await skip.click()
        return found
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...coachmarkSpecs(),
]
