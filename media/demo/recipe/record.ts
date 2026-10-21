/**
 * Records the raw take of the demo video: a tour of the live UI guide (the overview, the Orbit
 * dashboard, light and dark, the accent colours, keyboard search, a component's tabs and its code,
 * and the install line).
 *
 * Every step starts at a fixed second of the take (`STEPS`), so `../captions.vtt` stays in sync
 * with any new take. A step that runs past the start of the next one is printed as late; move the
 * schedule and the captions together when that happens.
 *
 * Frames come from the DevTools screencast, which sends a frame each time the page paints and
 * stamps it with the compositor's clock, so a loaded machine paints fewer frames but never shifts
 * their timing. The take is `<out>/frames/*.jpg` plus `<out>/frames.txt`, an ffmpeg concat list
 * with each frame's real duration, and `<out>/poster.png`, the opening screen without the pointer.
 */
import { chromium } from "npm:playwright-core@1.64.0"
import type { Locator, Page } from "npm:playwright-core@1.64.0"
import { clickLike, moveLike, parkLike, type Point } from "./human-mouse.ts"

/**
 * The guide is laid out at 640x400 CSS pixels and painted at twice that, so the clip is 1280x800
 * with everything twice its usual size: sites play the clip about 528 px wide, and the guide's
 * text stays readable there. At this width the guide shows its phone layout (navigation behind
 * the Menu button), which is what fits.
 */
const W = 640
const H = 400
const SCALE = 2
/** Where the pointer rests between steps: right edge, above the caption band. */
const REST: Point = { x: 600, y: 300 }

/** Seconds of the take at which each step starts; `../captions.vtt` adds the 2 s title card. */
export const STEPS = {
  overview: 0,
  dashboard: 4.5,
  filter: 11.5,
  theme: 18,
  accent: 24.5,
  search: 29.5,
  tabs: 35,
  code: 40.5,
  install: 48,
  end: 55.5,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Records the take of the guide at `url` into `out`. */
export async function record(url: string, out: string): Promise<void> {
  const here = new URL(".", import.meta.url).pathname
  const browser = await chromium.launch({ executablePath: Deno.env.get("CHROME_PATH") })
  try {
    const context = await browser.newContext({
      viewport: { width: W, height: H },
      deviceScaleFactor: SCALE,
      colorScheme: "dark",
      locale: "en-GB",
      timezoneId: "UTC",
      permissions: ["clipboard-read", "clipboard-write"],
    })
    const pointer: Point = { ...REST }
    // The click mark is 36 CSS pixels, 72 in the clip: the page is painted at twice its size.
    await context.addInitScript(
      `window.__demoPointerOptions = ${JSON.stringify({ ...pointer, mark: 36 })}`,
    )
    await context.addInitScript({ path: here + "pointer.js" })
    await context.addInitScript({ path: here + "keys.js" })
    const page = await context.newPage()
    try {
      // Other work on this machine can change its network interfaces, which Chromium reports as
      // ERR_NETWORK_CHANGED: three tries, then give up.
      for (let attempt = 1;; attempt++) {
        try {
          await page.goto(url, { waitUntil: "networkidle" })
          break
        } catch (error) {
          if (attempt === 3) throw error
          await sleep(2000)
        }
      }
      await page.evaluate(() => document.fonts.ready)
      await page.mouse.move(pointer.x, pointer.y)
      await sleep(500)
      await page.evaluate(`__demoPointerVisible(false)`)
      await page.screenshot({ path: `${out}/poster.png` })
      await page.evaluate(`__demoPointerVisible(true)`)
      await sleep(300)
      await tour(page, pointer, out)
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

/** Runs the steps on the screencast and writes the concat list. */
async function tour(page: Page, pointer: Point, out: string): Promise<void> {
  await Deno.mkdir(`${out}/frames`, { recursive: true })
  const frames: { file: string; at: number }[] = []
  /**
   * A cut: frames painted between `cut.start()` and `cut.end()` are dropped and the time between
   * them is taken out of the take, so the video goes straight from the frame before to the one
   * after.
   */
  let cutStart = 0
  let cutSeconds = 0
  const cut = {
    start: () => cutStart = Date.now() / 1000,
    end: () => {
      cutSeconds += Date.now() / 1000 - cutStart
      cutStart = 0
    },
  }
  const cdp = await page.context().newCDPSession(page)
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
    if (cutStart) return
    const file = `frames/${String(frames.length).padStart(5, "0")}.jpg`
    Deno.writeFileSync(`${out}/${file}`, Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))
    frames.push({ file, at: (metadata.timestamp ?? Date.now() / 1000) - cutSeconds })
  })
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    maxWidth: W * SCALE,
    maxHeight: H * SCALE,
    everyNthFrame: 1,
  })
  const t0 = Date.now()
  const late: string[] = []
  /** Waits until the take reaches `step`'s start; notes a step that starts late. */
  let previous = 0
  const at = async (step: keyof typeof STEPS) => {
    const now = (Date.now() - t0) / 1000 - cutSeconds
    const wait = STEPS[step] - now
    if (wait > 0) await sleep(wait * 1000)
    else if (wait < -0.3) late.push(`${step} started ${(-wait).toFixed(1)} s late`)
    console.log(
      `${step}: planned at ${STEPS[step]} s; the step before took ${(now - previous).toFixed(1)} s`,
    )
    previous = Math.max(now, STEPS[step])
  }
  const glideTo = async (y: number, ms = 1200) => {
    await page.evaluate((top) => globalThis.scrollTo({ top, behavior: "smooth" }), y)
    await sleep(ms)
  }
  /** The element's top in page pixels, so it can be scrolled to. */
  const pageTop = (locator: Locator) =>
    locator.first().evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY))
  const box = async (locator: Locator) => {
    const found = await locator.first().boundingBox()
    if (!found) throw new Error(`no box for ${locator}`)
    return found
  }

  /** Glides the page so `locator` sits `y` CSS pixels below the top of the viewport. */
  const show = async (locator: Locator, y: number, ms = 1100) =>
    await glideTo((await pageTop(locator)) - y, ms)

  // 1. The overview: the claim and Browse components.
  await at("overview")
  await moveLike(page, pointer, { x: 330, y: 250 })
  await sleep(1200)
  await parkLike(page, pointer, REST)

  // 2. The Orbit dashboard: its filters and KPIs, then the chart and its tooltip.
  await at("dashboard")
  const failing = page.getByRole("button", { name: /^Failing/ })
  await show(failing, 120, 1400)
  await sleep(1500)
  const chart = page.locator("[aria-label^='Builds this week']").first()
  await show(chart, 70, 1200)
  const cb = await box(chart)
  await moveLike(page, pointer, { x: cb.x + cb.width * 0.3, y: cb.y + cb.height * 0.4 })
  await sleep(700)
  await moveLike(page, pointer, { x: cb.x + cb.width * 0.53, y: cb.y + cb.height * 0.35 })

  // 3. The Failing filter: the table keeps only the failing project.
  await at("filter")
  await show(failing, 150, 1000)
  await clickLike(page, pointer, failing, { scroll: false })
  await sleep(900)
  await parkLike(page, pointer, REST)
  const builds = page.getByRole("button", { name: "Builds", exact: true })
  await show(builds, 200, 1200)

  // 4. Light, then dark again: the whole guide repaints.
  await at("theme")
  const theme = page.getByRole("button", { name: /Switch to (light|dark) mode/ })
  await clickLike(page, pointer, theme, { scroll: false })
  await sleep(2000)
  await clickLike(page, pointer, theme, { scroll: false })
  await sleep(500)
  await show(failing, 150, 1000)

  // 5. Accent colours, by keyboard on the select (headless Chromium draws no native popup, so the
  // pointer rests under it instead).
  await at("accent")
  const accent = page.getByLabel("Accent colour")
  const ab = await box(accent)
  await moveLike(page, pointer, { x: ab.x + ab.width * 0.4, y: ab.y + ab.height + 14 })
  await accent.focus()
  for (let i = 0; i < 3; i++) {
    await sleep(250)
    await page.keyboard.press("ArrowDown")
    await sleep(900)
  }

  // 6. Keyboard search: / opens it, "tabs", ↓, Enter. The select keeps focus and would take the
  // "/", so it lets go first.
  await at("search")
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await parkLike(page, pointer, REST)
  await page.keyboard.press("/")
  await sleep(700)
  await page.keyboard.type("tabs", { delay: 140 })
  await sleep(900)
  await page.keyboard.press("ArrowDown")
  await sleep(700)
  await page.keyboard.press("Enter")
  await sleep(600)
  // The guide jumps to the card while the cards above it still load and push it down: the take
  // cuts from the search to the settled card instead of showing the page scroll past.
  cut.start()
  const card = page.locator("article#demo-Tabs")
  const firstTab = card.getByRole("tab", { name: /^Overview/ })
  await firstTab.waitFor()
  await sleep(1500)
  await show(firstTab, 220, 300)
  await page.evaluate(() => globalThis.scrollTo({ top: globalThis.scrollY }))
  cut.end()
  // A paint right after the cut, so the frame before it does not stay on screen.
  await moveLike(page, pointer, { x: REST.x - 20, y: REST.y + 10 })

  // 7. The Tabs component: arrow keys move between its tabs.
  await at("tabs")
  await show(firstTab, 220, 300)
  await clickLike(page, pointer, firstTab, { scroll: false })
  await parkLike(page, pointer, REST)
  for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft"]) {
    await sleep(350)
    await page.keyboard.press(key)
    await sleep(500)
  }

  // 8. The component's code, opened and copied.
  await at("code")
  const usage = card.locator("[data-e2e=usage] summary")
  await show(usage, 120, 1100)
  await clickLike(page, pointer, usage, { scroll: false })
  await sleep(600)
  await show(usage, 60, 900)
  const copy = card.getByRole("button", { name: /^Copy the <Tabs/ })
  await clickLike(page, pointer, copy, { scroll: false })
  await sleep(500)
  await parkLike(page, pointer, REST)

  // 9. Back to the overview through the menu; the install line, copied.
  await at("install")
  await clickLike(page, pointer, page.getByRole("button", { name: "Menu" }).first(), {
    scroll: false,
  })
  await sleep(700)
  await clickLike(
    page,
    pointer,
    page.getByRole("dialog").getByRole("link", { name: "Overview", exact: true }),
    { scroll: false },
  )
  await page.evaluate(() => globalThis.scrollTo({ top: 0 }))
  await sleep(600)
  const install = page.getByRole("button", { name: "Copy the install command" })
  await show(install, 220, 900)
  await clickLike(page, pointer, install, { scroll: false })
  await parkLike(page, pointer, REST)

  await at("end")
  await cdp.send("Page.stopScreencast")
  const end = Date.now() / 1000 - cutSeconds
  // The screencast can hand two frames over out of order.
  frames.sort((a, b) => a.at - b.at)
  const start = frames[0]?.at
  if (start === undefined) throw new Error("the screencast sent no frames")
  // The concat demuxer needs the last file twice for its duration to count.
  const lines = frames.flatMap((f, i) => [
    `file '${f.file}'`,
    `duration ${((frames[i + 1]?.at ?? end) - f.at).toFixed(4)}`,
  ])
  lines.push(`file '${frames.at(-1)?.file}'`)
  await Deno.writeTextFile(`${out}/frames.txt`, lines.join("\n") + "\n")
  const gaps = frames.slice(1).map((f, i) => f.at - frames[i].at)
  console.log(
    `${frames.length} frames over ${(end - start).toFixed(1)} s, ` +
      `longest gap ${(Math.max(...gaps) * 1000).toFixed(0)} ms`,
  )
  for (const line of late) console.warn(`late: ${line}`)
}
