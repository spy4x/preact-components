import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { axePasses } from "./shared.ts"

/**
 * Ctrl-click and Shift-click on a video's play link open its `href` in a new tab or window, the
 * browser's way, and leave the card's poster in place (`player` stays absent and the page stays
 * put); a plain click afterwards still plays in place, which `played` waits for.
 */
async function modifiedClicksOpenTheLink(
  page: Page,
  link: Locator,
  player: Locator,
  href: RegExp,
  played: () => Promise<unknown>,
) {
  const before = page.url()
  for (const modifier of ["Control", "Shift"] as const) {
    const [opened] = await Promise.all([
      page.context().waitForEvent("page"),
      link.click({ modifiers: [modifier] }),
    ])
    // The tab's address is what the click decides; its load event is the stub page's own business
    // and, on a loaded host, can come long after.
    await opened.waitForURL(href, { waitUntil: "commit" })
    await opened.close()
    if (await player.count() > 0) throw new Error(`${modifier}-click also played in place`)
    if (page.url() !== before) throw new Error(`${modifier}-click navigated to ${page.url()}`)
  }
  await link.click()
  await played()
  if (page.url() !== before) throw new Error(`the plain click navigated to ${page.url()}`)
}

/** The parts of the `DemoVideo` card a spec drives, with its poster scrolled into view and loaded. */
async function demoVideoCard(page: Page) {
  const card = page.locator("#demo-DemoVideo")
  const link = card.getByRole("link", { name: "Play video: A test pattern", exact: true })
  await link.scrollIntoViewIfNeeded()
  await link.locator("img").evaluate((image) =>
    new Promise<void>((resolve, reject) => {
      const poster = image as HTMLImageElement
      if (poster.complete && poster.naturalWidth > 0) return resolve()
      poster.addEventListener("load", () => resolve(), { once: true })
      poster.addEventListener("error", () => reject(new Error("the poster did not load")), {
        once: true,
      })
    })
  )
  return {
    card,
    link,
    video: card.locator("video"),
    /** Every request for one of the clip's files that this page made, by resource timing. */
    clipRequests: () =>
      page.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name)
          .filter((name) => /\/video-demo\/clip\./.test(name))
      ),
    /**
     * Waits until the video has started playing on its own, or throws after ten seconds with what
     * it is doing instead.
     */
    playing: () =>
      card.locator("video").evaluate((element) =>
        new Promise<void>((resolve, reject) => {
          const video = element as HTMLVideoElement
          const timer = setTimeout(() =>
            reject(
              new Error(
                `not playing: paused ${video.paused}, readyState ${video.readyState}, ` +
                  `currentTime ${video.currentTime}, hidden ${document.hidden}`,
              ),
            ), 10_000)
          const done = () => {
            if (video.paused) return
            clearTimeout(timer)
            resolve()
          }
          video.addEventListener("play", done)
          done()
        })
      ),
  }
}

/**
 * The `DemoVideo` card: nothing of the clip loads before the press; a click or a key plays it in
 * the poster's box, with sound and controls, showing the whole frame; focus moves to it; reduced
 * motion stops the loop; and with JavaScript off the link opens the clip file.
 */
function demoVideoSpecs(): Spec[] {
  return [
    {
      name: "DemoVideo: no video element and no request for the clip before the press; a click " +
        "plays it inline, with sound and controls, the whole frame shown, in the poster's box",
      pageId: "ui",
      run: async (page) => {
        const requested: string[] = []
        page.on("request", (request) => {
          if (/\/video-demo\/clip\./.test(request.url())) requested.push(request.url())
        })
        const { card, link, video, clipRequests, playing } = await demoVideoCard(page)
        if (await card.locator("video, video source").count() > 0) {
          throw new Error("a video element exists before the press")
        }
        const early = [...requested, ...await clipRequests()]
        if (early.length > 0) throw new Error(`requested before the press: ${early.join(", ")}`)
        const before = await link.boundingBox()

        await link.click()
        await video.and(page.locator("[controls][autoplay][playsinline]")).waitFor()
        await playing()
        const state = await video.evaluate((element) => {
          const played = element as HTMLVideoElement
          return {
            muted: played.muted,
            fit: getComputedStyle(played).objectFit,
            src: played.currentSrc,
          }
        })
        if (state.muted) throw new Error("the clip plays muted")
        if (state.fit !== "contain") {
          throw new Error(`the clip is object-fit ${state.fit}, not contain`)
        }
        if (!/\/video-demo\/clip\.webm$/.test(state.src)) {
          throw new Error(`the clip plays ${state.src}, not the first source`)
        }
        if (!page.url().includes("#/")) throw new Error(`the click navigated to ${page.url()}`)
        const after = await video.locator("..").boundingBox()
        if (
          before === null || after === null ||
          Math.abs(before.width - after.width) > 0.5 || Math.abs(before.height - after.height) > 0.5
        ) {
          throw new Error(
            `the box moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
          )
        }
        return `${requested.length} clip request(s) after the press`
      },
    },
    {
      name:
        "DemoVideo: Tab reaches the play link, Enter starts the clip and focus lands on the video",
      pageId: "ui",
      run: async (page) => {
        const { link, video, playing } = await demoVideoCard(page)
        await link.focus()
        await page.keyboard.press("Shift+Tab")
        if (await link.evaluate((element) => element === document.activeElement)) {
          throw new Error("Shift+Tab left focus on the play link")
        }
        await page.keyboard.press("Tab")
        await link.and(page.locator(":focus")).waitFor()
        await page.keyboard.press("Enter")
        await video.and(page.locator(":focus")).waitFor()
        await playing()
      },
    },
    {
      name: "DemoVideo: keyboard focus on the play link draws a ring over the poster's edge",
      pageId: "ui",
      run: async (page) => {
        const { link } = await demoVideoCard(page)
        await page.mouse.move(0, 0)
        await link.focus()
        await page.keyboard.press("Shift+Tab")
        // A strip across the left edge, inside the box, where an inset ring is drawn. Scrolled to and
        // measured before each shot, since Shift+Tab and Tab may scroll the page.
        const edge = async () => {
          await link.scrollIntoViewIfNeeded()
          const box = await link.boundingBox()
          if (box === null) throw new Error("the play link has no box")
          return page.screenshot({
            animations: "disabled",
            clip: { x: box.x, y: box.y + box.height / 2 - 8, width: 4, height: 16 },
          })
        }
        const rest = await edge()
        await page.keyboard.press("Tab")
        await link.and(page.locator(":focus-visible")).waitFor()
        const focused = await edge()
        if (rest.equals(focused)) {
          throw new Error("the poster's edge looks the same focused and at rest")
        }
      },
    },
    {
      name: "DemoVideo: Space on the play link starts the clip without scrolling the page",
      pageId: "ui",
      run: async (page) => {
        const { link, video, playing } = await demoVideoCard(page)
        await link.focus()
        const scrolled = () => page.evaluate(() => globalThis.scrollY)
        const before = await scrolled()
        await page.keyboard.press(" ")
        await video.and(page.locator(":focus")).waitFor()
        await playing()
        const after = await scrolled()
        if (Math.abs(after - before) > 1) throw new Error(`the page scrolled ${after - before}px`)
      },
    },
    ...([false, true] as const).map((reduced): Spec => ({
      name: reduced
        ? "DemoVideo: under reduced motion the clip still plays on press, but does not loop"
        : "DemoVideo: with motion allowed the card's looping clip loops",
      pageId: "ui",
      run: async (page) => {
        if (reduced) await page.emulateMedia({ reducedMotion: "reduce" })
        const { link, video, playing } = await demoVideoCard(page)
        await link.click()
        await playing()
        const loops = await video.evaluate((element) => (element as HTMLVideoElement).loop)
        if (loops === reduced) throw new Error(`loop is ${loops}`)
      },
    })),
    {
      name: "DemoVideo: a clip whose file is missing shows the error and a link to the file in " +
        "the poster's box, with focus moved to the link",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-DemoVideo")
        const link = card.getByRole("link", { name: "Play video: A missing clip", exact: true })
        await link.scrollIntoViewIfNeeded()
        const before = await link.boundingBox()
        await link.focus()
        await page.keyboard.press("Enter")
        const status = card.getByRole("status").filter({ hasText: "The video didn't load." })
        const file = status.getByRole("link", { name: "Open the video file", exact: true })
        await file.and(page.locator(":focus")).waitFor()
        const href = await file.getAttribute("href")
        if (href !== "video-demo/missing.webm") throw new Error(`the file link goes to ${href}`)
        if (await card.locator("video").count() > 0) {
          throw new Error("the failed video is still shown")
        }
        const after = await status.locator("..").boundingBox()
        if (
          before === null || after === null ||
          Math.abs(before.width - after.width) > 0.5 || Math.abs(before.height - after.height) > 0.5
        ) {
          throw new Error(
            `the box moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
          )
        }
        const { violations } = await new AxeBuilder({ page }).include("#demo-DemoVideo").analyze()
        if (violations.length > 0) throw new Error(violations.map(({ id }) => id).join(", "))
      },
    },
    {
      name: "DemoVideo: starting a second clip pauses the first where it was, and starting the " +
        "first from its own controls pauses the second",
      pageId: "ui",
      run: async (page) => {
        const { card, link } = await demoVideoCard(page)
        const second = card.getByRole("link", {
          name: "Play video: A second test pattern",
          exact: true,
        })
        const firstVideo = card.locator("video[aria-label='A test pattern']")
        const secondVideo = card.locator("video[aria-label='A second test pattern']")
        /** Waits until the video has played past `after` seconds and is still playing. */
        const playedPast = (video: typeof firstVideo, after: number) =>
          video.evaluate((element, seconds) =>
            new Promise<void>((resolve, reject) => {
              const played = element as HTMLVideoElement
              const timer = setTimeout(() =>
                reject(
                  new Error(
                    `not past ${seconds}s: paused ${played.paused}, at ${played.currentTime}s`,
                  ),
                ), 10_000)
              const check = () => {
                if (played.paused || played.currentTime <= seconds) return
                clearTimeout(timer)
                played.removeEventListener("timeupdate", check)
                resolve()
              }
              played.addEventListener("timeupdate", check)
              check()
            }), after)
        const state = (video: typeof firstVideo) =>
          video.evaluate((element) => {
            const played = element as HTMLVideoElement
            return { paused: played.paused, time: played.currentTime }
          })

        await link.click()
        await firstVideo.waitFor()
        await playedPast(firstVideo, 0.5)
        await second.scrollIntoViewIfNeeded()
        await second.click()
        await secondVideo.waitFor()
        await playedPast(secondVideo, 0)
        const first = await state(firstVideo)
        if (!first.paused) throw new Error("the first clip still plays beside the second")
        if (first.time < 0.5) throw new Error(`the first clip went back to ${first.time}s`)

        // The video's own play, as its native controls start it, not the poster's press.
        await firstVideo.evaluate((element) => (element as HTMLVideoElement).play())
        await playedPast(firstVideo, first.time)
        if (!(await state(secondVideo)).paused) {
          throw new Error("the second clip still plays after the first started again")
        }
      },
    },
    {
      name: "DemoVideo: Ctrl-click and Shift-click open the clip file in a new tab and leave " +
        "the poster; a plain click still plays in place",
      pageId: "ui",
      run: async (page) => {
        const { link, video, playing } = await demoVideoCard(page)
        await modifiedClicksOpenTheLink(page, link, video, /\/video-demo\/clip\.webm$/, playing)
      },
    },
    {
      name: "DemoVideo: with JavaScript off, the play link opens the clip file",
      pageId: "ui",
      run: async (page) => {
        const session = await page.context().newCDPSession(page)
        await session.send("Emulation.setScriptExecutionDisabled", { value: true })
        await page.reload()
        const link = page.locator("#demo-DemoVideo a[aria-label='Play video: A test pattern']")
        await link.scrollIntoViewIfNeeded()
        await Promise.all([page.waitForURL(/\/video-demo\/clip\.webm$/), link.click()])
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `DemoVideo in the ${colorScheme} palette: axe finds nothing on the card, before and ` +
        "after the press",
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const { link, video } = await demoVideoCard(page)
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const scan = async (state: string) => {
          const { violations } = await new AxeBuilder({ page }).include("#demo-DemoVideo")
            .analyze()
          if (violations.length > 0) {
            throw new Error(`${state}: ${violations.map(({ id }) => id).join(", ")}`)
          }
        }
        await scan("before the press")
        await link.click()
        await video.waitFor()
        await scan("after the press")
      },
    })),
  ]
}

/**
 * The `YouTubeVideo` card, with every request to a YouTube host answered by a blank local page, so
 * the specs need no network and can count what the page asked YouTube for.
 */
async function youTubeVideoCard(page: Page) {
  const youTube: string[] = []
  await page.route(
    /^https:\/\/([a-z0-9-]+\.)*(youtube|youtube-nocookie|ytimg|googlevideo)\.com\//,
    (route) => {
      youTube.push(route.request().url())
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html lang='en'><title>Player</title><main><h1>Player</h1></main>",
      })
    },
  )
  const card = page.locator("#demo-YouTubeVideo")
  const link = card.getByRole("link", {
    name: "Play video: Big Buck Bunny",
    exact: true,
  })
  await link.scrollIntoViewIfNeeded()
  return { card, link, youTube, player: card.locator("iframe") }
}

/**
 * Waits until the card's player holds focus. Read from `document.activeElement`: an `<iframe>` that
 * holds focus does not always match `:focus` in a headless page.
 */
async function focusInPlayer(page: Page) {
  await page.waitForFunction(() =>
    document.activeElement !== null &&
    document.activeElement === document.querySelector("#demo-YouTubeVideo iframe")
  )
}

/**
 * Serves the loop's files with byte ranges, as GitHub Pages and every CDN do. The preview server
 * answers a range request with the whole file and a 200, and Chromium cannot seek in such a
 * response, so without this no spec could see the clip keep its time.
 */
async function serveLoopsWithRanges(page: Page): Promise<void> {
  await page.route(/\/video-demo\/loop-(light|dark)\.(webm|mp4)$/, async (route) => {
    const response = await route.fetch()
    const body = await response.body()
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()["range"] ?? "")
    if (range === null) return route.fulfill({ response, body })
    const start = Number(range[1])
    const end = range[2] === "" ? body.length - 1 : Math.min(Number(range[2]), body.length - 1)
    await route.fulfill({
      status: 206,
      headers: {
        "content-type": response.headers()["content-type"] ?? "video/webm",
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${body.length}`,
      },
      body: body.subarray(start, end + 1),
    })
  })
}

/** The working loop of the `LoopVideo` card, its button and what its clip is doing. */
function loopVideoCard(page: Page) {
  const card = page.locator("#demo-LoopVideo")
  const frame = card.locator("figure").filter({ hasText: "A six-second test loop" })
  /** The clip's state, read off the element. */
  const state = () =>
    frame.locator("video").evaluate((element) => {
      const clip = element as HTMLVideoElement
      return {
        paused: clip.paused,
        loop: clip.loop,
        time: clip.currentTime,
        src: clip.currentSrc,
        label: clip.getAttribute("aria-label"),
      }
    })
  return {
    frame,
    state,
    /** The pause/play button, under either of its names. */
    button: (label: "Pause animation" | "Play animation") =>
      frame.getByRole("button", { name: `${label}: Test loop`, exact: true }),
    /** Every request this page made for one of the loop's files, by resource timing. */
    loopRequests: () =>
      page.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name)
          .filter((name) => /\/video-demo\/loop-(light|dark)\.(webm|mp4)$/.test(name))
      ),
    /** Waits until the clip is playing and has moved past its first frame. */
    playing: () =>
      frame.locator("video").evaluate((element) =>
        new Promise<void>((resolve, reject) => {
          const clip = element as HTMLVideoElement
          const timer = setTimeout(() =>
            reject(
              new Error(
                `not playing: paused ${clip.paused}, readyState ${clip.readyState}, ` +
                  `currentTime ${clip.currentTime}`,
              ),
            ), 10_000)
          const done = () => {
            if (clip.paused || clip.currentTime === 0) return
            clearTimeout(timer)
            clip.removeEventListener("timeupdate", done)
            resolve()
          }
          clip.addEventListener("timeupdate", done)
          done()
        })
      ),
    /** Waits until the clip is paused, for at most five seconds. */
    paused: () =>
      frame.locator("video").evaluate((element) =>
        new Promise<void>((resolve, reject) => {
          const clip = element as HTMLVideoElement
          const timer = setTimeout(() => reject(new Error("the clip did not pause")), 5_000)
          const done = () => {
            if (!clip.paused) return
            clearTimeout(timer)
            resolve()
          }
          clip.addEventListener("pause", done)
          done()
        })
      ),
    /** Scrolls the page until the clip is wholly out of the viewport, above it. */
    scrollAway: () =>
      frame.evaluate((element) => {
        const box = element.getBoundingClientRect()
        globalThis.scrollBy(0, box.bottom + 40)
      }),
  }
}

/**
 * The `LoopVideo` card: nothing loads before the clip is in view; in view it plays, out of view it
 * pauses; the button pauses it by keyboard and that pause holds; dark pages play the dark files and
 * a theme change keeps the time; reduced motion never autoplays; a missing file keeps the still.
 */
function loopVideoSpecs(): Spec[] {
  return [
    {
      name: "LoopVideo: no request for the loop before it is in view; in view it plays the light " +
        "files in a loop, and scrolled out of view it pauses",
      pageId: "ui",
      run: async (page) => {
        const { frame, state, loopRequests, playing, paused, scrollAway } = loopVideoCard(page)
        await frame.locator("video").waitFor({ state: "attached" })
        const box = await frame.boundingBox()
        const viewport = page.viewportSize()
        if (box === null || viewport === null || box.y < viewport.height) {
          throw new Error(`the loop starts in view at ${box?.y}, so the spec proves nothing`)
        }
        const early = await loopRequests()
        if (early.length > 0) {
          throw new Error(`requested before it was in view: ${early.join(", ")}`)
        }
        if (!(await state()).paused) throw new Error("the clip plays out of view")

        await frame.scrollIntoViewIfNeeded()
        await playing()
        const shown = await state()
        if (!shown.loop) throw new Error("the clip does not loop")
        if (!/\/video-demo\/loop-light\.webm$/.test(shown.src)) {
          throw new Error(`the clip plays ${shown.src}, not the light WebM`)
        }
        await scrollAway()
        await paused()
        return `${(await loopRequests()).length} loop request(s) once in view`
      },
    },
    {
      name: "LoopVideo: Tab reaches the 44 px button, Enter pauses the clip and renames the " +
        "button, the pause holds when the clip scrolls out and back in, Escape hides the hint, " +
        "and Space plays it again",
      pageId: "ui",
      run: async (page) => {
        const { frame, button, state, playing, paused, scrollAway } = loopVideoCard(page)
        await frame.scrollIntoViewIfNeeded()
        await playing()
        const pause = button("Pause animation")
        await pause.focus()
        await page.keyboard.press("Shift+Tab")
        await page.keyboard.press("Tab")
        await pause.and(page.locator(":focus-visible")).waitFor()
        const size = await pause.boundingBox()
        if (size === null || size.width < 44 || size.height < 44) {
          throw new Error(`the button is ${size?.width}x${size?.height} px`)
        }
        const hint = frame.locator(`[aria-hidden="true"]`).filter({
          hasText: "Pause animation: Test loop",
        })
        await hint.waitFor({ state: "visible" })
        await page.keyboard.press("Escape")
        await hint.waitFor({ state: "hidden" })

        await page.keyboard.press("Enter")
        await paused()
        const play = button("Play animation")
        await play.and(page.locator(":focus")).waitFor()
        const held = (await state()).time
        await scrollAway()
        await frame.scrollIntoViewIfNeeded()
        // The observer has had time to call for play if it were going to.
        await page.waitForTimeout(1_000)
        const after = await state()
        if (!after.paused || after.time !== held) {
          throw new Error(`the pause did not hold: paused ${after.paused}, ${held} → ${after.time}`)
        }
        await play.focus()
        await page.keyboard.press(" ")
        await playing()
        await button("Pause animation").waitFor()
      },
    },
    {
      name:
        "LoopVideo on a dark page: the dark files play, and a switch to light loads the light " +
        "files at the same time and keeps playing",
      pageId: "ui",
      colorScheme: "dark",
      run: async (page) => {
        await serveLoopsWithRanges(page)
        const { frame, state, playing } = loopVideoCard(page)
        await frame.scrollIntoViewIfNeeded()
        await playing()
        const dark = await state()
        if (!/\/video-demo\/loop-dark\.webm$/.test(dark.src)) {
          throw new Error(`a dark page plays ${dark.src}`)
        }
        type Seek = { atLoad: number; time: number; duration: number; paused: boolean }
        type Watched = typeof globalThis & { e2eLightSeek?: Seek }
        // The kept position is the clip's time when the component calls `load()` for the light
        // files, not a time read before the theme changes: a slow render can delay that call for
        // seconds, long enough for the six-second loop to wrap, and the clip rightly resumes from
        // where it is then. The light files' seek to it is read in its own `seeked` callback,
        // before playback moves the time on. Both listeners go in before the switch, and the
        // switch waits until the clip is a second in, so the position to keep is not the start.
        await frame.locator("video").evaluate((element) =>
          new Promise<void>((resolve) => {
            const clip = element as HTMLVideoElement
            const load = clip.load.bind(clip)
            let atLoad: number | undefined
            clip.load = () => {
              atLoad = clip.currentTime
              load()
            }
            clip.addEventListener("seeked", function seeked() {
              if (atLoad === undefined || !/loop-light\.webm$/.test(clip.currentSrc)) return
              clip.removeEventListener("seeked", seeked)
              const { currentTime: time, duration, paused } = clip
              const seek = { atLoad, time, duration, paused }
              ;(globalThis as Watched).e2eLightSeek = seek
            })
            const secondIn = () => {
              if (clip.currentTime < 1) return
              clip.removeEventListener("timeupdate", secondIn)
              resolve()
            }
            clip.addEventListener("timeupdate", secondIn)
            secondIn()
          })
        )
        await page.emulateMedia({ colorScheme: "light" })
        const light = await (await page.waitForFunction(() => (globalThis as Watched).e2eLightSeek))
          .jsonValue() as Seek
        if (light.paused) throw new Error("the clip stopped on the theme change")
        // Forward along the loop: a clip that was at its very end resumes from the start. Playback
        // can begin before the seek ends, so the light files may land a little past the kept time;
        // a lost position starts them over, most of a loop away.
        const ahead = (light.time - light.atLoad + light.duration) % light.duration
        if (ahead > 1) {
          throw new Error(`the clip went back from ${light.atLoad}s to ${light.time}s`)
        }
      },
    },
    {
      name:
        "LoopVideo under reduced motion: in view it does not start; the button plays it once, " +
        "without a loop",
      pageId: "ui",
      run: async (page) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        await page.reload()
        await page.locator(`html[data-hydrated="true"]`).waitFor()
        const { frame, button, state, loopRequests, playing } = loopVideoCard(page)
        await frame.scrollIntoViewIfNeeded()
        const play = button("Play animation")
        await play.waitFor()
        await page.waitForTimeout(1_000)
        if (!(await state()).paused) throw new Error("the clip started by itself")
        const early = await loopRequests()
        if (early.length > 0) throw new Error(`requested before the press: ${early.join(", ")}`)
        await play.click()
        await playing()
        if ((await state()).loop) throw new Error("the clip loops under reduced motion")
      },
    },
    {
      name: "LoopVideo: a loop no browser can play keeps its still, named by the title, and " +
        "draws no button",
      pageId: "ui",
      run: async (page) => {
        const frame = page.locator("#demo-LoopVideo figure").filter({
          hasText: "no browser can play",
        })
        await frame.scrollIntoViewIfNeeded()
        await frame.getByRole("img", { name: "A loop that cannot play.", exact: true }).waitFor()
        await frame.locator("video").waitFor({ state: "detached" })
        if (await frame.getByRole("button").count() > 0) {
          throw new Error("the failed loop still draws its button")
        }
      },
    },
    ...(["light", "dark"] as const).map((colorScheme): Spec => ({
      name: `LoopVideo: axe finds no violation on the playing and the failed loop, ${colorScheme}`,
      pageId: "ui",
      colorScheme,
      run: async (page) => {
        const { frame, playing } = loopVideoCard(page)
        await frame.scrollIntoViewIfNeeded()
        await playing()
        await page.locator("#demo-LoopVideo figure").filter({ hasText: "no browser can play" })
          .locator("video").waitFor({ state: "detached" })
        return await axePasses(page, ["#demo-LoopVideo"])
      },
    })),
  ]
}

/**
 * The `YouTubeVideo` card: nothing goes to YouTube before the press; a click, Enter or Space puts
 * the nocookie player in the poster's box with focus inside it, and the page does not scroll.
 */
function youTubeVideoSpecs(): Spec[] {
  const embed = "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1"
  return [
    {
      name: "YouTubeVideo: no request to YouTube and no iframe before the press; a click puts " +
        "the titled nocookie player in the poster's box and moves focus into it",
      pageId: "ui",
      run: async (page) => {
        const { card, link, youTube, player } = await youTubeVideoCard(page)
        if (await card.locator("iframe").count() > 0) throw new Error("an iframe exists early")
        if (youTube.length > 0) throw new Error(`requested early: ${youTube.join(", ")}`)
        const href = await link.getAttribute("href")
        if (href !== "https://www.youtube.com/watch?v=aqz-KE-bpKQ") {
          throw new Error(`the link goes to ${href}`)
        }
        const before = await link.boundingBox()
        await link.click()
        await focusInPlayer(page)
        const src = await player.getAttribute("src")
        if (src !== embed) throw new Error(`the player loads ${src}`)
        const title = await player.getAttribute("title")
        if (title !== "Big Buck Bunny") {
          throw new Error(`the player is titled ${title}`)
        }
        if (!page.url().includes("#/")) throw new Error(`the click navigated to ${page.url()}`)
        const after = await player.boundingBox()
        if (
          before === null || after === null ||
          Math.abs(before.width - after.width) > 0.5 || Math.abs(before.height - after.height) > 0.5
        ) {
          throw new Error(
            `the box moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
          )
        }
        const { violations } = await new AxeBuilder({ page }).include("#demo-YouTubeVideo")
          .analyze()
        if (violations.length > 0) throw new Error(violations.map(({ id }) => id).join(", "))
      },
    },
    {
      name: "YouTubeVideo: Ctrl-click and Shift-click open the watch page in a new tab and " +
        "leave the poster; a plain click still starts the player in place",
      pageId: "ui",
      run: async (page) => {
        await page.context().route(/^https:\/\/www\.youtube\.com\/watch/, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><html lang='en'><title>Watch</title><main><h1>Watch</h1></main>",
          }))
        const { link, player } = await youTubeVideoCard(page)
        await modifiedClicksOpenTheLink(
          page,
          link,
          player,
          /^https:\/\/www\.youtube\.com\/watch\?v=aqz-KE-bpKQ$/,
          () => focusInPlayer(page),
        )
      },
    },
    ...(["Enter", " "] as const).map((key): Spec => ({
      name: `YouTubeVideo: ${key === " " ? "Space" : "Enter"} on the focused play link starts ` +
        "the player, with focus inside it and the page not scrolled",
      pageId: "ui",
      run: async (page) => {
        const { link } = await youTubeVideoCard(page)
        await link.focus()
        const scrolled = () => page.evaluate(() => globalThis.scrollY)
        const before = await scrolled()
        await page.keyboard.press(key)
        await focusInPlayer(page)
        const after = await scrolled()
        if (Math.abs(after - before) > 1) throw new Error(`the page scrolled ${after - before}px`)
      },
    })),
  ]
}

export const specs: readonly Spec[] = [
  ...demoVideoSpecs(),
  ...loopVideoSpecs(),
  ...youTubeVideoSpecs(),
]
