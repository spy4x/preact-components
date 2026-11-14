import type { Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"
import { axePasses } from "./shared.ts"
import { TIMELINE_ANNOUNCE_MS } from "../../../ui/timeline.tsx"
import {
  LIVE_TIMELINE_KEEP,
  LIVE_TIMELINE_START,
  LIVE_TIMELINE_TICK_MS,
} from "../../../ui-guide/sections/timeline-live.tsx"

type Probe = typeof globalThis & {
  /** The `behavior` of every `scrollIntoView` call since `livePage` set the probe up. */
  e2eScrolls?: string[]
  /** What the live region said, in order. */
  e2eSpoken?: string[]
  /** The batching timers of `TIMELINE_ANNOUNCE_MS` that are still set. */
  e2eAnnounceTimers?: Set<unknown>
  /** The demo's step timers, held back: each call adds one step. */
  e2eSteps?: (() => void)[]
}

/**
 * The live timeline of the `Timeline` card. The demo's step timer is held back from the first
 * script on, so a step arrives only when the spec calls `step()`, and the page's clock is paused,
 * so the batching timer fires only when the spec moves it.
 *
 * The demo starts short enough that its end shows without scrolling. Unless `short` is set, steps
 * are added first until it holds {@link FILLED} entries, which overflow the box, and the probes
 * are set up after, so they see only the spec's own steps.
 */
async function livePage(page: Page, { short = false }: { short?: boolean } = {}) {
  // After the clock's own script, so this one wraps the paused clock's `setInterval`.
  await page.clock.install()
  await page.addInitScript((stepMs) => {
    const probe = globalThis as Probe
    const realInterval = globalThis.setInterval
    probe.e2eSteps = []
    globalThis.setInterval = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
      if (ms !== stepMs || typeof handler !== "function") return realInterval(handler, ms, ...rest)
      probe.e2eSteps?.push(() => handler(...rest))
      return -1
    }) as typeof globalThis.setInterval
  }, LIVE_TIMELINE_TICK_MS)
  await page.reload()
  await page.locator(`html[data-hydrated="true"]`).waitFor()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  const card = page.locator("#demo-Timeline")
  const box = card.locator(`[data-e2e="timeline-live-box"]`)
  const live = card.locator(`[data-e2e="timeline-live"]`)
  const announcer = live.locator("[data-timeline-announcer]")
  await box.scrollIntoViewIfNeeded()
  // The timeline sets its observer up in an effect, which may wait for the paused clock's next
  // frame; then the end, on screen at load, must be reported in view before the first step.
  await page.clock.runFor(100)
  await box.evaluate((element) =>
    new Promise<void>((resolve) => {
      const end = element.querySelector("[data-timeline-end]")
      if (!end) throw new Error("the live timeline has no end marker")
      new IntersectionObserver(([entry], observer) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        resolve()
      }).observe(end)
    })
  )
  /** The demo adds one step; the clock moves a frame or two, so the timeline's effects run. */
  const step = async () => {
    const held = await page.evaluate(() => {
      const steps = (globalThis as Probe).e2eSteps ?? []
      for (const step of steps) step()
      return steps.length
    })
    if (held !== 1) throw new Error(`held ${held} step timers, not 1`)
    await page.clock.runFor(100)
  }
  if (!short) {
    for (let count = LIVE_TIMELINE_START; count < FILLED; count++) await step()
    // The batching timer of these steps fires before the probes start listening.
    await page.clock.runFor(TIMELINE_ANNOUNCE_MS)
    // Following scrolled the box smoothly: let that scroll land, so it cannot undo the spec's.
    const deadline = Date.now() + 5_000
    while (!await box.evaluate(ENDS_IN_BOX)) {
      if (Date.now() > deadline) throw new Error("the filled demo never showed its end")
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    if (await box.evaluate((element) => element.scrollHeight <= element.clientHeight)) {
      throw new Error(`${FILLED} entries fit the box without scrolling`)
    }
  }
  await page.evaluate((announceMs) => {
    const probe = globalThis as Probe
    probe.e2eScrolls = []
    const realScroll = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
      // Only the live timeline's own scrolls; the guide scrolls for itself too.
      if (this.closest(`[data-e2e="timeline-live"]`)) {
        probe.e2eScrolls?.push(typeof options === "object" ? options.behavior ?? "" : "")
      }
      return realScroll.call(this, options)
    }
    const timers = new Set<unknown>()
    probe.e2eAnnounceTimers = timers
    const realSet = globalThis.setTimeout
    const realClear = globalThis.clearTimeout
    globalThis.setTimeout = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
      if (ms !== announceMs || typeof handler !== "function") return realSet(handler, ms, ...rest)
      const id = realSet(
        (...args: unknown[]) => {
          timers.delete(id)
          handler(...args)
        },
        ms,
        ...rest,
      )
      timers.add(id)
      return id
    }) as typeof globalThis.setTimeout
    globalThis.clearTimeout = ((id?: number) => {
      if (id !== undefined) timers.delete(id)
      realClear(id)
    }) as typeof globalThis.clearTimeout
    // Whether the end of the list is on screen, as the timeline's own observer sees it.
    const end = document.querySelector(`#demo-Timeline [data-timeline-end]`)
    if (!end) throw new Error("the live timeline has no end marker")
    new IntersectionObserver(([entry]) => {
      document.body.dataset.e2eEnd = entry.isIntersecting ? "in" : "out"
    }).observe(end)
    const region = document.querySelector(`#demo-Timeline [data-timeline-announcer]`)
    if (!region) throw new Error("the live timeline has no live region")
    probe.e2eSpoken = []
    new MutationObserver(() => {
      if (region.textContent) probe.e2eSpoken?.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  }, TIMELINE_ANNOUNCE_MS)
  const endIs = (state: "in" | "out") => page.locator(`body[data-e2e-end="${state}"]`).waitFor()
  const scrolls = () => page.evaluate(() => [...((globalThis as Probe).e2eScrolls ?? [])])
  return {
    live,
    box,
    announcer,
    toolbar: live.getByRole("button", { name: /^(Pause|Follow)$/ }),
    jump: live.locator("[data-timeline-jump]"),
    list: live.getByRole("list", { name: "Build run" }),
    endIs,
    scrolls,
    spoken: () => page.evaluate(() => [...((globalThis as Probe).e2eSpoken ?? [])]),
    announceTimers: () => page.evaluate(() => (globalThis as Probe).e2eAnnounceTimers?.size ?? -1),
    step,
    /** Moves the page's clock by `ms`. */
    wait: (ms: number) => page.clock.runFor(ms),
    /** Scrolls the box to its end, or its top, at once, and waits for the end to show or go. */
    scrollBox: async (to: "end" | "top") => {
      await box.evaluate((element, to) => {
        element.scrollTop = to === "end" ? element.scrollHeight : 0
      }, to)
      await endIs(to === "end" ? "in" : "out")
    },
    /** Throws unless the state reads `word`. */
    stateIs: (word: "Following" | "Paused") =>
      live.locator(`[data-timeline-state="${word.toLowerCase()}"]`, { hasText: word }).waitFor(),
  }
}

/** The entries `livePage` fills the demo to: more than its box shows at once. */
const FILLED = 4

/**
 * True when the timeline's end marker lies inside the box's visible area: the newest entry shows.
 * Run in the page, on the box.
 */
const ENDS_IN_BOX = (box: Element): boolean => {
  const end = box.querySelector("[data-timeline-end]")?.getBoundingClientRect()
  const area = box.getBoundingClientRect()
  return end !== undefined && end.top >= area.top && end.bottom <= area.bottom + 0.5
}

/** Throws unless `actual` equals `expected`, naming what was compared. */
function same(what: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, not ${JSON.stringify(expected)}`)
  }
}

/** The live `Timeline` with the "N new events" button showing passes axe in one palette. */
function liveAxe(colorScheme: "light" | "dark"): Spec {
  return {
    name: `Timeline live: axe finds no violation with the toolbar and the new events button, ` +
      colorScheme,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const tl = await livePage(page)
      await tl.scrollBox("top")
      await tl.step()
      await tl.jump.filter({ hasText: "1 new event" }).waitFor()
      // The jump button sticks to the bottom of the box: scan the box with it in place. axe waits
      // on timers of its own, so the clock runs again first.
      await page.clock.resume()
      // Contrast is measured on the toolbar and the button: entries the box clips, or the button
      // covers, are ones axe cannot measure, and the page's own scan covers the entries. Every
      // other rule runs on the whole box.
      return [
        await axeCleanIn(page, `#demo-Timeline [data-e2e="timeline-live"] > div:first-child`),
        await axeCleanIn(page, `#demo-Timeline [data-timeline-jump]`),
        await axePasses(page, [`#demo-Timeline [data-e2e="timeline-live-box"]`]),
      ].join("; ")
    },
  }
}

export const specs: readonly Spec[] = [
  {
    name: "Timeline live: following with the end on screen scrolls a new event into view " +
      "smoothly; scrolled up, nothing scrolls and the new events button counts new ids even as " +
      "the oldest drop, and pressing it shows the newest and focuses the list",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page)
      // Steps come only from `step()`; the clock runs, so a wait for the scroll to land can poll.
      await page.clock.resume()
      await tl.stateIs("Following")
      await tl.scrollBox("end")

      // At the end: the new step scrolls into view.
      await tl.step()
      await tl.list.locator("li").nth(4).waitFor()
      await page.waitForFunction(ENDS_IN_BOX, await tl.box.elementHandle())
      same("the scrolls after a step at the end", await tl.scrolls(), ["smooth"])

      // Scrolled up: four steps arrive, the last one dropping the oldest, and nothing scrolls.
      await tl.scrollBox("top")
      for (let step = 1; step <= 4; step++) {
        await tl.step()
        await tl.jump.filter({ hasText: `${step} new event${step === 1 ? "" : "s"}` }).waitFor()
      }
      same("the entries the demo keeps", await tl.list.locator("li").count(), LIVE_TIMELINE_KEEP)
      same("the scrolls while scrolled up", await tl.scrolls(), ["smooth"])

      // The button shows the newest, still following, and focus lands on the list.
      await tl.jump.click()
      await tl.endIs("in")
      await tl.jump.waitFor({ state: "detached" })
      await tl.list.and(page.locator(":focus")).waitFor()
      await tl.stateIs("Following")
      same("the scrolls after the button", await tl.scrolls(), ["smooth", "smooth"])
      return "followed one step, counted 4 with one dropped, jumped to the newest"
    },
  },
  {
    name: "Timeline live: when the whole list fits on screen, a new event while paused shows no " +
      "new events button, and none appears after Follow; a paused event that pushes the end off " +
      "screen is counted",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page, { short: true })
      await tl.endIs("in")
      await tl.toolbar.filter({ hasText: "Pause" }).click()
      await tl.stateIs("Paused")
      // A real pause after each step, so the observer has reported where the end is.
      const settle = () => new Promise((resolve) => setTimeout(resolve, 500))

      await tl.step()
      await tl.list.locator("li").nth(LIVE_TIMELINE_START).waitFor()
      await settle()
      same("the buttons after a step while paused", await tl.jump.count(), 0)

      await tl.toolbar.filter({ hasText: "Follow" }).click()
      await tl.stateIs("Following")
      await tl.wait(100)
      await settle()
      same("the buttons after Follow", await tl.jump.count(), 0)
      if (await tl.box.evaluate((element) => element.scrollHeight > element.clientHeight)) {
        throw new Error(`${LIVE_TIMELINE_START + 1} entries overflow the box: the list must fit`)
      }

      // Paused again with the end on screen, a step that overflows the box is unseen.
      await tl.toolbar.filter({ hasText: "Pause" }).click()
      await tl.stateIs("Paused")
      await tl.step()
      same("the entries after the second step", await tl.list.locator("li").count(), FILLED)
      await tl.endIs("out")
      await tl.jump.filter({ hasText: "1 new event" }).waitFor()
      same("the scrolls", await tl.scrolls(), ["smooth"])
      return "paused, a step, then Follow: no button; paused, an overflowing step: 1 new event"
    },
  },
  {
    name: "Timeline live: a pointer press while a scroll to the newest is still running lets " +
      "go, as when the person grabs the scrollbar: the next event counts instead of scrolling",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page)
      await tl.scrollBox("end")
      // Every scroll to the end stays in flight: it is recorded but never moves the box.
      await page.evaluate(() => {
        const recorded = Element.prototype.scrollIntoView
        Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
          if (!this.closest(`[data-e2e="timeline-live"]`)) recorded.call(this, options)
          else (globalThis as Probe).e2eScrolls?.push("held")
        }
      })
      await tl.step()
      await tl.endIs("out")
      same("the scrolls after a step at the end", await tl.scrolls(), ["held"])

      const area = await tl.box.boundingBox()
      if (!area) throw new Error("the live box has no box")
      await page.mouse.move(area.x + area.width - 4, area.y + area.height / 2)
      await page.mouse.down()
      await page.mouse.up()
      await tl.step()
      await tl.jump.filter({ hasText: "1 new event" }).waitFor()
      same("the scrolls after the press", await tl.scrolls(), ["held"])
      return "a press during the scroll to the newest let go; the next event counted"
    },
  },
  {
    name: "Timeline live: Pause stops the scrolling and counts new events, the new events button " +
      "shows the newest without resuming, and Follow resumes and jumps to the newest",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page)
      await tl.scrollBox("end")
      await tl.toolbar.filter({ hasText: "Pause" }).click()
      await tl.stateIs("Paused")
      await tl.toolbar.filter({ hasText: "Follow" }).waitFor()
      // The dot pulses only while following.
      same("dots while paused", await tl.live.locator(".motion-safe\\:animate-pulse").count(), 0)

      await tl.step()
      await tl.jump.filter({ hasText: "1 new event" }).waitFor()
      same("the scrolls while paused", await tl.scrolls(), [])

      await tl.jump.click()
      await tl.endIs("in")
      await tl.jump.waitFor({ state: "detached" })
      await tl.stateIs("Paused")

      await tl.scrollBox("top")
      await tl.toolbar.filter({ hasText: "Follow" }).click()
      // Following again jumps from an effect, which runs on the paused clock's next frame.
      await tl.wait(100)
      await tl.stateIs("Following")
      await tl.endIs("in")
      same("the scrolls after the button and Follow", await tl.scrolls(), ["smooth", "smooth"])
      return "paused, counted, jumped while paused, resumed with a jump"
    },
  },
  {
    name: "Timeline live: the live region says the events that arrive within the batching " +
      "window once, and stays silent before it ends",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page)
      await tl.scrollBox("end")
      // Two steps 2 s apart fall in one 3 s window; the third starts the next window.
      await tl.step()
      await tl.wait(LIVE_TIMELINE_TICK_MS)
      await tl.step()
      same("heard before the window ends", await tl.spoken(), [])
      await tl.wait(TIMELINE_ANNOUNCE_MS - LIVE_TIMELINE_TICK_MS)
      await tl.announcer.filter({ hasText: "2 new events" }).waitFor()
      await tl.step()
      same("heard before the second window ends", await tl.spoken(), ["2 new events"])
      await tl.wait(TIMELINE_ANNOUNCE_MS)
      await tl.announcer.filter({ hasText: "1 new event" }).waitFor()
      same("heard", await tl.spoken(), ["2 new events", "1 new event"])
      return "heard: 2 new events, then 1 new event"
    },
  },
  {
    name: "Timeline live: under reduced motion a new event scrolls into view at once and the " +
      "Following dot holds still",
    pageId: "ui",
    run: async (page) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      const tl = await livePage(page)
      await tl.scrollBox("end")
      const dot = tl.live.locator(`[data-timeline-state] > span[aria-hidden="true"]`)
      same(
        "the dot's animation",
        await dot.evaluate((element) => getComputedStyle(element).animationName),
        "none",
      )
      await tl.step()
      // Read at once, not waited for: an instant scroll has landed by the time the step returns,
      // while a smooth one would still be under way.
      same("the scrolls under reduced motion", await tl.scrolls(), ["auto"])
      same("the end shown right after the step", await tl.box.evaluate(ENDS_IN_BOX), true)
      return "scrolled with auto, the dot still"
    },
  },
  {
    name: "Timeline live: the dot pulses when motion is allowed, and leaving the page clears a " +
      "pending announcement's timer",
    pageId: "ui",
    run: async (page) => {
      const tl = await livePage(page)
      const dot = tl.live.locator(`[data-timeline-state] > span[aria-hidden="true"]`)
      same(
        "the dot's animation",
        await dot.evaluate((element) => getComputedStyle(element).animationName),
        "pulse",
      )
      await tl.step()
      same("batching timers while a step waits", await tl.announceTimers(), 1)
      await page.evaluate(() => location.hash = "#/icons")
      await tl.live.waitFor({ state: "detached" })
      same("batching timers after leaving", await tl.announceTimers(), 0)
      return "pulse; 1 timer, then 0"
    },
  },
  liveAxe("light"),
  liveAxe("dark"),
]
