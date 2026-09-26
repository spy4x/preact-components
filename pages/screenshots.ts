/**
 * Takes the README's screenshots of the UI guide from a local build, with the browser the checks use.
 *
 * Serves `pages/dist` the way `verify.ts` does, launches headless Chromium once, and writes PNGs to
 * `docs/screenshots/`: the guide at 1280×800 CSS pixels and a device pixel ratio of 2 (2560×1600,
 * 16:10) in the light, dark and ink palettes, and the 1280×640 social preview GitHub asks for.
 * Build first — this script, like `verify`, serves whatever `dist/` holds:
 *
 * ```bash
 * deno task --cwd pages build && timeout 300 deno task --cwd pages screenshots
 * ```
 *
 * `--review --out=<directory>` takes a design review's set instead, into that directory: the
 * overview and one package page (`--page=<id>`, `charts` by default) in the light and dark palettes
 * at 1440, 1024 and 375 CSS pixels wide, each the full length of the page, plus the phone
 * navigation drawer open. The files are named `<page>-<width>-<palette>.png` and
 * `drawer-375-<palette>.png`.
 *
 * The browser is closed and its profile removed on every exit path, including a thrown error.
 */

import { join } from "@std/path"
import { connect, debuggingPort, type Devtools, poll } from "./checks/harness.ts"
import { shutdownChromium } from "./launch.ts"
import { serveDist } from "./serve.ts"
import { DEFAULT_BASE, normalizeBase } from "./src/site.ts"

const PAGES_DIRECTORY = new URL(".", import.meta.url).pathname
const DIST_DIRECTORY = join(PAGES_DIRECTORY, "dist")
/** The value of `--<name>=<value>` on the command line, or `undefined`. */
function flag(name: string): string | undefined {
  const prefix = `--${name}=`
  return Deno.args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}
const ARGS = { review: Deno.args.includes("--review"), out: flag("out"), page: flag("page") }
const OUT_DIRECTORY = ARGS.out ?? join(PAGES_DIRECTORY, "..", "docs", "screenshots")
const BASE = normalizeBase(Deno.env.get("PAGES_BASE") ?? DEFAULT_BASE)

/** The palettes the guide can show: light, the default dark, and the opt-in ink dark palette. */
enum Palette {
  LIGHT = 1,
  DARK = 2,
  INK = 3,
}

/** One image to take. */
interface Shot {
  file: string
  /** Guide route, e.g. `#/` or `#/charts`. */
  hash: string
  palette: Palette
  width: number
  height: number
  scale: number
  /** Capture the whole length of the page rather than the viewport. */
  fullPage?: boolean
  /** Open the phone navigation drawer before the capture. */
  drawer?: boolean
}

const SHOTS: Shot[] = [
  { file: "guide-overview-light.png", hash: "#/", palette: Palette.LIGHT, ...wide() },
  { file: "guide-overview-dark.png", hash: "#/", palette: Palette.DARK, ...wide() },
  { file: "guide-ui-ink.png", hash: "#/ui", palette: Palette.INK, ...wide() },
  { file: "guide-charts-light.png", hash: "#/charts", palette: Palette.LIGHT, ...wide() },
  {
    file: "social-preview.png",
    hash: "#/",
    palette: Palette.INK,
    width: 1280,
    height: 640,
    scale: 1,
  },
]

/**
 * A design review's set: the overview and one package page, light and dark, at a desktop, a small
 * laptop and a phone width, plus the phone drawer open.
 *
 * @param page The package page to take beside the overview.
 */
function reviewShots(page: string): Shot[] {
  const palettes = [["light", Palette.LIGHT], ["dark", Palette.DARK]] as const
  const widths = [[1440, 900, 1], [1024, 768, 1], [375, 812, 2]] as const
  const shots: Shot[] = []
  for (const [id, hash] of [["overview", "#/"], [page, `#/${page}`]]) {
    for (const [width, height, scale] of widths) {
      for (const [name, palette] of palettes) {
        shots.push({
          file: `${id}-${width}-${name}.png`,
          hash,
          palette,
          width,
          height,
          scale,
          fullPage: true,
        })
      }
    }
  }
  for (const [name, palette] of palettes) {
    shots.push({
      file: `drawer-375-${name}.png`,
      hash: `#/${page}`,
      palette,
      width: 375,
      height: 812,
      scale: 2,
      drawer: true,
    })
  }
  return shots
}

/** 1280×800 CSS pixels at 2×: 2560×1600, 16:10. */
function wide(): Pick<Shot, "width" | "height" | "scale"> {
  return { width: 1280, height: 800, scale: 2 }
}

/** The first Chromium that answers `--version`, from the same candidates `verify.ts` tries. */
async function findChromium(): Promise<string> {
  const configured = Deno.env.get("CHROME_PATH")
  const candidates = configured ? [configured] : ["chromium-browser", "chromium"]
  for (const candidate of candidates) {
    try {
      const { success } = await new Deno.Command(candidate, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      }).output()
      if (success) return candidate
    } catch {
      // Not installed under this name.
    }
  }
  throw new Error(`no Chromium found; tried ${candidates.join(", ")}`)
}

/**
 * Load one route in one palette, the way a visitor who chose it would see it.
 *
 * The colour scheme goes through the page's own mechanism: the stored `pc-theme` preference, which
 * the pre-paint script in `src/document.tsx` reads before the first paint and the theme button
 * reads when it mounts. So the page is loaded, the preference stored, and the page reloaded; setting
 * the `.dark` class after the fact would leave the button reading "Dark" on a dark page. Ink is not
 * a stored preference in the demo site, so it is added to the reloaded page as `data-theme="ink"`.
 */
async function open(devtools: Devtools, url: string, shot: Shot): Promise<void> {
  const dark = shot.palette !== Palette.LIGHT
  await devtools.send("Page.navigate", { url: `${url}${shot.hash}` })
  await waitForHydration(devtools, shot)
  await devtools.evaluate<null>(
    `(localStorage.setItem("pc-theme", "${dark ? "dark" : "light"}"), null)`,
  )
  const loaded = devtools.next("Page.loadEventFired")
  await devtools.send("Page.reload", {})
  await loaded
  await waitForHydration(devtools, shot)
  const scheme = await devtools.evaluate<boolean>(
    `document.documentElement.classList.contains("dark")`,
  )
  if (scheme !== dark) throw new Error(`${shot.file}: the page did not load in the stored scheme`)
  if (shot.palette === Palette.INK) {
    await devtools.evaluate<null>(`(document.documentElement.dataset.theme = "ink", null)`)
  }
}

/** Wait until the island has hydrated, or fail naming the shot. */
async function waitForHydration(devtools: Devtools, shot: Shot): Promise<void> {
  const hydrated = await poll(
    () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
    15_000,
  )
  if (!hydrated) throw new Error(`${shot.file}: ${shot.hash} did not hydrate within 15s`)
}

/** Open one route, wait for the page to settle, and write the PNG. */
async function take(devtools: Devtools, url: string, shot: Shot): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: shot.scale,
    mobile: false,
  })
  await open(devtools, url, shot)
  // A lazy card (the d3 charts, the map) draws after its module arrives; the longer wait of a full
  // page is for those.
  const length = await devtools.evaluate<number>(`(async () => {
    await document.fonts.ready
    globalThis.scrollTo({ top: 0, behavior: "instant" })
    await new Promise((resolve) => setTimeout(resolve, ${shot.fullPage ? 2000 : 500}))
    ${
    shot.drawer
      ? `document.querySelector("[data-e2e=ui-guide-nav-open]")?.click()
    await new Promise((resolve) => setTimeout(resolve, 500))`
      : ""
  }
    return document.documentElement.scrollHeight
  })()`)
  const { data } = await devtools.send<{ data: string }>(
    "Page.captureScreenshot",
    shot.fullPage
      ? {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: shot.width, height: length, scale: 1 },
      }
      : { format: "png" },
  )
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
  await Deno.writeFile(join(OUT_DIRECTORY, shot.file), bytes)
  console.log(`wrote ${join(OUT_DIRECTORY, shot.file)} (${bytes.length} bytes)`)
}

async function main(): Promise<void> {
  const chromium = await findChromium()
  await Deno.mkdir(OUT_DIRECTORY, { recursive: true })
  const server = await serveDist(DIST_DIRECTORY, BASE, 0)
  const profile = await Deno.makeTempDir({ prefix: "pages-screenshots-" })
  let process: Deno.ChildProcess | undefined
  let devtools: Devtools | undefined
  // `shutdownChromium` removes the profile even when no browser ever started, so a failed spawn
  // leaves no folder behind.
  const teardown = async () => {
    await shutdownChromium(process, profile, devtools)
    await server.close()
  }
  const onSignal = () => teardown().finally(() => Deno.exit(130))
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    Deno.addSignalListener(signal, onSignal)
  }

  try {
    process = new Deno.Command(chromium, {
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--hide-scrollbars",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      stdout: "null",
      stderr: "null",
    }).spawn()
    devtools = await connect(await debuggingPort(profile))
    await devtools.send("Page.enable", {})
    if (ARGS.review && !ARGS.out) throw new Error("--review needs --out=<directory>")
    const shots = ARGS.review ? reviewShots(ARGS.page ?? "charts") : SHOTS
    for (const shot of shots) await take(devtools, server.url, shot)
  } finally {
    await teardown()
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      Deno.removeSignalListener(signal, onSignal)
    }
  }
}

if (import.meta.main) await main()
