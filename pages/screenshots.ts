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
 * The browser is closed and its profile removed on every exit path, including a thrown error.
 */

import { join } from "@std/path"
import { connect, debuggingPort, type Devtools, poll } from "./checks/harness.ts"
import { shutdownChromium } from "./launch.ts"
import { serveDist } from "./serve.ts"
import { DEFAULT_BASE, normalizeBase } from "./src/site.ts"

const PAGES_DIRECTORY = new URL(".", import.meta.url).pathname
const DIST_DIRECTORY = join(PAGES_DIRECTORY, "dist")
const OUT_DIRECTORY = join(PAGES_DIRECTORY, "..", "docs", "screenshots")
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

/** Put the page in one palette: the `.dark` class, and `data-theme="ink"` for ink. */
async function applyPalette(devtools: Devtools, palette: Palette): Promise<void> {
  const dark = palette !== Palette.LIGHT
  await devtools.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }],
  })
  await devtools.evaluate<null>(`(() => {
    const root = document.documentElement
    root.classList.toggle("dark", ${dark})
    if (${palette === Palette.INK}) root.dataset.theme = "ink"
    else delete root.dataset.theme
    return null
  })()`)
}

/** Open one route, wait for the page to settle, and write the PNG. */
async function take(devtools: Devtools, url: string, shot: Shot): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: shot.scale,
    mobile: false,
  })
  await devtools.send("Page.navigate", { url: `${url}${shot.hash}` })
  const hydrated = await poll(
    () => devtools.evaluate<boolean>("document.documentElement.dataset.hydrated === 'true'"),
    15_000,
  )
  if (!hydrated) throw new Error(`${shot.hash} did not hydrate within 15s`)
  await applyPalette(devtools, shot.palette)
  await devtools.evaluate<null>(`(async () => {
    await document.fonts.ready
    globalThis.scrollTo({ top: 0, behavior: "instant" })
    await new Promise((resolve) => setTimeout(resolve, 500))
    return null
  })()`)
  const { data } = await devtools.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
  await Deno.writeFile(join(OUT_DIRECTORY, shot.file), bytes)
  console.log(`wrote docs/screenshots/${shot.file} (${bytes.length} bytes)`)
}

async function main(): Promise<void> {
  const chromium = await findChromium()
  await Deno.mkdir(OUT_DIRECTORY, { recursive: true })
  const server = await serveDist(DIST_DIRECTORY, BASE, 0)
  const profile = await Deno.makeTempDir({ prefix: "pages-screenshots-" })
  const process = new Deno.Command(chromium, {
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
  let devtools: Devtools | undefined
  const teardown = async () => {
    await shutdownChromium(process, profile, devtools)
    await server.close()
  }
  const onSignal = () => teardown().finally(() => Deno.exit(130))
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    Deno.addSignalListener(signal, onSignal)
  }

  try {
    devtools = await connect(await debuggingPort(profile))
    await devtools.send("Page.enable", {})
    for (const shot of SHOTS) await take(devtools, server.url, shot)
  } finally {
    await teardown()
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      Deno.removeSignalListener(signal, onSignal)
    }
  }
}

if (import.meta.main) await main()
