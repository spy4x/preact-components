/** Playwright specs for the `theme/` classes, on the guide's theme page. */
import { AxeBuilder } from "@axe-core/playwright"
import { THEME_AUTO_ATTRIBUTE } from "@spy4x/preact-signals/theme"
import type { Page } from "playwright-core"
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

/** The outline a form control draws, and the colour `--color-ring` resolves to beside it. */
interface Outline {
  style: string
  width: string
  offset: string
  color: string
  ringToken: string
}

/**
 * A theme form control reached with Tab draws the components' focus ring, 2px solid in
 * `--color-ring` at a 2px offset, and no outline before.
 *
 * @param what The control, as the spec's name says it.
 * @param selector The control on the theme page; the first match is the one tabbed to.
 */
function focusRingSpec(what: string, selector: string): Spec {
  return {
    name: `${what} reached with Tab draws the components' focus ring, and no outline before`,
    pageId: "theme",
    run: async (page) => {
      const box = page.locator(selector).first()
      const outline = () =>
        box.evaluate((element): Outline => {
          const probe = document.createElement("span")
          probe.style.color = "var(--color-ring)"
          element.after(probe)
          const ringToken = getComputedStyle(probe).color
          probe.remove()
          const style = getComputedStyle(element)
          return {
            style: style.outlineStyle,
            width: style.outlineWidth,
            offset: style.outlineOffset,
            color: style.outlineColor,
            ringToken,
          }
        })

      const before = await outline()
      if (before.style !== "none") {
        throw new Error(`${what} draws a ${before.style} outline before it is focused`)
      }

      // Away and back with real key presses, so the focus arrives the way a keyboard user's does.
      await box.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await box.and(page.locator(":focus-visible")).waitFor()

      const focused = await outline()
      const drawn = `${focused.width} ${focused.style} ${focused.color}, offset ${focused.offset}`
      if (
        focused.style !== "solid" || focused.width !== "2px" || focused.offset !== "2px" ||
        focused.color !== focused.ringToken
      ) {
        throw new Error(
          `${what}, focused, draws ${drawn}; wanted 2px solid ${focused.ringToken}, offset 2px`,
        )
      }
      return `${drawn} (--color-ring), none before`
    },
  }
}

/** What a page paints with the dark palette or without it: the canvas, the scheme, a `dark:` class. */
interface Painted {
  canvas: string
  scheme: string
  variant: string
}

/** A span the guide's stylesheet colours only under the `dark` variant. */
const VARIANT_PROBE = `<span data-e2e="variant-probe" class="dark:text-accent-400">probe</span>`

/** Read what `page` paints: the body's background, the root's `color-scheme`, the probe's colour. */
function readPainted(page: Page): Promise<Painted> {
  return page.locator(`[data-e2e="variant-probe"]`).evaluate((probe): Painted => ({
    canvas: getComputedStyle(document.body).backgroundColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
    variant: getComputedStyle(probe).color,
  }))
}

/**
 * Open the guide's own page in a context with JavaScript off and the system dark, with the root's
 * attributes rewritten in the served HTML as a server would render them, and read what it paints.
 *
 * @param page The spec's page, whose URL and browser are reused.
 * @param rootAttributes Attributes added to `<html>`, such as the auto-dark marker.
 */
function paintedWithoutScripts(page: Page, rootAttributes: string): Promise<Painted> {
  return withoutScripts(page, rootAttributes, VARIANT_PROBE, readPainted)
}

/**
 * Open the guide's own page in a context with JavaScript off and the system dark, with the root's
 * attributes and `probeHtml` at the start of `<body>` written into the served HTML, and `read` it.
 *
 * @param page The spec's page, whose URL and browser are reused.
 * @param rootAttributes Attributes added to `<html>`, such as the auto-dark marker.
 * @param probeHtml Markup the spec reads, put first in `<body>`.
 * @param read Reads the page; the context closes after it.
 */
async function withoutScripts<T>(
  page: Page,
  rootAttributes: string,
  probeHtml: string,
  read: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = page.context().browser()
  if (browser === null) throw new Error("the spec's page has no browser to open a context in")
  const context = await browser.newContext({ colorScheme: "dark", javaScriptEnabled: false })
  try {
    const noScript = await context.newPage()
    await noScript.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return await route.continue()
      const response = await route.fetch()
      const html = await response.text()
      if (!html.includes("<html") || !html.includes("<body")) {
        throw new Error("the guide's HTML has no <html> or <body> to rewrite")
      }
      const body = html.replace("<html", `<html ${rootAttributes}`)
        .replace(/<body[^>]*>/, (tag) => `${tag}${probeHtml}`)
      await route.fulfill({ response, body })
    })
    await noScript.goto(page.url())
    return await read(noScript)
  } finally {
    await context.close()
  }
}

/** The same reading in the spec's own page, with JavaScript on, under `.dark` or without it. */
function paintedWithScripts(page: Page, dark: boolean, ink: boolean): Promise<Painted> {
  return page.evaluate(([dark, ink, probeHtml]) => {
    const root = document.documentElement
    if (document.querySelector(`[data-e2e="variant-probe"]`) === null) {
      document.body.insertAdjacentHTML("afterbegin", probeHtml)
    }
    root.classList.toggle("dark", dark)
    // As the bootstrap script leaves it under `.dark`; no inline scheme otherwise, as a page
    // without scripts has none.
    root.style.colorScheme = dark ? "dark" : ""
    if (ink) root.setAttribute("data-theme", "ink")
    else root.removeAttribute("data-theme")
    const probe = document.querySelector(`[data-e2e="variant-probe"]`) as HTMLElement
    return {
      canvas: getComputedStyle(document.body).backgroundColor,
      scheme: getComputedStyle(root).colorScheme,
      variant: getComputedStyle(probe).color,
    }
  }, [dark, ink, VARIANT_PROBE] as const)
}

/** Markup the no-script dark spec reads: a plain `.btn`, a bare table and a bare `select`. */
const DARK_CHROME_PROBE = `<div data-e2e="dark-chrome-probe">` +
  `<button type="button" class="btn">Probe</button>` +
  `<table><tbody><tr><td>Cell</td></tr></tbody></table>` +
  `<select aria-label="Probe"><option>One</option></select></div>`

/** What the dark chrome paints, each beside the token it should read. */
interface DarkChrome {
  ring: string
  ringToken: string
  table: string
  cellBorder: string
  select: string
  surface: string
  borderControl: string
}

/** Tab to the probe's `.btn` and read the dark chrome, resolving each token in the same page. */
async function readDarkChrome(page: Page): Promise<DarkChrome> {
  const button = page.locator(`[data-e2e="dark-chrome-probe"] .btn`)
  // Away and back with real key presses, so the focus arrives the way a keyboard user's does.
  await button.focus()
  await page.keyboard.press("Shift+Tab")
  await page.keyboard.press("Tab")
  await button.and(page.locator(":focus-visible")).waitFor()
  // `.btn` transitions every property for 75 ms, its outline colour included, so a reading taken
  // as focus arrives can be a colour on the way to the ring's.
  await button.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})))
  )
  return await button.evaluate((element): DarkChrome => {
    const resolve = (value: string) => {
      const probe = document.createElement("span")
      probe.style.color = value
      element.after(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    const probe = element.parentElement!
    return {
      ring: getComputedStyle(element).outlineColor,
      ringToken: resolve(
        "var(--color-focus-ring, var(--color-primary-muted, oklch(0.714 0.203 305.504)))",
      ),
      table: getComputedStyle(probe.querySelector("table")!).backgroundColor,
      cellBorder: getComputedStyle(probe.querySelector("td")!).borderTopColor,
      select: getComputedStyle(probe.querySelector("select")!).backgroundColor,
      surface: resolve("var(--color-surface)"),
      borderControl: resolve("var(--color-border-control)"),
    }
  })
}

/** The colours an invalid `.pc-input` draws, and the danger token beside it. */
interface InvalidField {
  border: string
  outline: string
  outlineStyle: string
  outlineWidth: string
  danger: string
}

/** Read the invalid field's border and outline, and resolve `--color-danger` next to it. */
function readInvalidField(page: Page, selector: string): Promise<InvalidField> {
  return page.locator(selector).first().evaluate((element): InvalidField => {
    const probe = document.createElement("span")
    probe.style.color = "var(--color-danger)"
    element.after(probe)
    const danger = getComputedStyle(probe).color
    probe.remove()
    const style = getComputedStyle(element)
    return {
      border: style.borderTopColor,
      outline: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      danger,
    }
  })
}

/**
 * A field marked `aria-invalid="true"` draws its border in `--color-danger`, and keeps it, with a
 * danger outline, once focused.
 *
 * @param what The field, as the spec's name says it.
 * @param selector The field on the theme page.
 * @param colorScheme The palette.
 */
function invalidFieldSpec(what: string, selector: string, colorScheme: "light" | "dark"): Spec {
  return {
    name: `${colorScheme}: ${what} marked aria-invalid draws a danger border, and a danger ` +
      `outline once focused`,
    pageId: "theme",
    colorScheme,
    run: async (page) => {
      const field = page.locator(selector).first()
      const valid = await readInvalidField(page, selector)
      if (valid.border === valid.danger) {
        throw new Error(`${what} draws the danger border ${valid.border} before it is invalid`)
      }
      await field.evaluate((element) => element.setAttribute("aria-invalid", "true"))
      const resting = await readInvalidField(page, selector)
      await field.focus()
      await field.and(page.locator(":focus")).waitFor()
      const focused = await readInvalidField(page, selector)
      const wrong = [
        resting.border !== resting.danger && `at rest its border is ${resting.border}`,
        focused.border !== focused.danger && `focused its border is ${focused.border}`,
        (focused.outlineStyle !== "solid" || focused.outline !== focused.danger) &&
        `focused its outline is ${focused.outlineStyle} ${focused.outline}`,
        focused.outlineWidth !== "2px" &&
        `focused its outline is ${focused.outlineWidth} wide, so focus looks like rest`,
      ].filter(Boolean)
      if (wrong.length > 0) {
        throw new Error(
          `${what}, invalid: ${wrong.join("; ")}; --color-danger is ${resting.danger}`,
        )
      }
      return `border and focus outline ${resting.danger} (--color-danger)`
    },
  }
}

/** What a type page's elements draw with, and whether the page loaded the Arabic face. */
interface TypeProbe {
  /** `FontFace.status` of every face named "Noto Sans Arabic" on the page. */
  arabicFace: string[]
  /** Whether the browser fetched the face's file, by the page's resource timing. */
  fetched: boolean
  headingTracking: string
  bodyLineHeight: string
  emphasisStyle: string
  slantedStyle: string
}

/**
 * Open a type page (`pages/src/type-page.ts`) and read it once every font it asked for is in.
 *
 * @param page The spec's page, on the guide.
 * @param path `type-demo/` or `type-demo/latin.html`.
 */
async function probeTypePage(page: Page, path: string): Promise<TypeProbe> {
  await page.goto(new URL(path, page.url()).href)
  return await page.evaluate(async () => {
    await document.fonts.ready
    const style = (e2e: string) =>
      getComputedStyle(document.querySelector(`[data-e2e="${e2e}"]`) as Element)
    return {
      arabicFace: [...document.fonts].filter((face) => face.family.includes("Noto Sans Arabic"))
        .map((face) => face.status),
      fetched: performance.getEntriesByType("resource")
        .some((entry) => entry.name.includes("noto-sans-arabic")),
      headingTracking: style("type-heading").letterSpacing,
      bodyLineHeight: style("type-body").lineHeight,
      emphasisStyle: style("type-emphasis").fontStyle,
      slantedStyle: style("type-slanted").fontStyle,
    }
  })
}

export const specs: readonly Spec[] = [
  scrollRegionSpec({
    what: "the `.pc-scrollbar` card's row of months",
    pageId: "theme",
    selector: `#demo-class-scrollbar [data-e2e="scrollbar"]`,
    name: "Months",
    key: "ArrowRight",
  }),
  focusRingSpec("a square `.pc-checkbox`", "#demo-class-checkbox input.pc-checkbox"),
  focusRingSpec("a `.pc-radio`", "#demo-class-radio input.pc-radio"),
  invalidFieldSpec("a `.pc-input`", "#demo-class-input input.pc-input", "light"),
  invalidFieldSpec("a `.pc-input`", "#demo-class-input input.pc-input", "dark"),
  invalidFieldSpec("a `.pc-select`", "#demo-class-select select.pc-select", "dark"),
  {
    name: `without JavaScript on a dark system, a page that renders ${THEME_AUTO_ATTRIBUTE} ` +
      `paints the dark palette, ink with data-theme="ink", and one without it stays light`,
    pageId: "theme",
    colorScheme: "dark",
    run: async (page) => {
      const dark = await paintedWithScripts(page, true, false)
      const ink = await paintedWithScripts(page, true, true)
      const light = await paintedWithScripts(page, false, false)
      if (dark.canvas === light.canvas || dark.variant === light.variant) {
        throw new Error(`the dark and light palettes paint alike: ${JSON.stringify(dark)}`)
      }
      const seen = {
        marker: await paintedWithoutScripts(page, THEME_AUTO_ATTRIBUTE),
        markerInk: await paintedWithoutScripts(page, `${THEME_AUTO_ATTRIBUTE} data-theme="ink"`),
        none: await paintedWithoutScripts(page, ""),
      }
      const wanted = { marker: dark, markerInk: ink, none: light }
      const wrong = (Object.keys(wanted) as (keyof typeof wanted)[]).filter((key) =>
        JSON.stringify(seen[key]) !== JSON.stringify(wanted[key])
      ).map((key) => `${key}: ${JSON.stringify(seen[key])}, wanted ${JSON.stringify(wanted[key])}`)
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      return `marker ${seen.marker.canvas}, ink ${seen.markerInk.canvas}, none ${seen.none.canvas}`
    },
  },
  {
    name: `without JavaScript on a dark system, under ${THEME_AUTO_ATTRIBUTE} a focused .btn ` +
      `draws the preset's focus ring, and a bare table and select paint the dark chrome`,
    pageId: "theme",
    colorScheme: "dark",
    run: async (page) => {
      const seen = await withoutScripts(
        page,
        THEME_AUTO_ATTRIBUTE,
        DARK_CHROME_PROBE,
        readDarkChrome,
      )
      const wrong = [
        seen.ring !== seen.ringToken && `the focus ring is ${seen.ring}, not ${seen.ringToken}`,
        seen.table !== seen.surface && `the table is ${seen.table}, not ${seen.surface}`,
        seen.cellBorder !== seen.borderControl &&
        `a cell's border is ${seen.cellBorder}, not ${seen.borderControl}`,
        seen.select !== seen.surface && `the select is ${seen.select}, not ${seen.surface}`,
      ].filter(Boolean)
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      return `ring ${seen.ring}, table and select ${seen.surface}, cell border ${seen.borderControl}`
    },
  },
  {
    name: `ink: an app that sets --color-primary and --color-accent on :root keeps its colour ` +
      `under .dark and data-theme="ink", and links take the accent's step 400`,
    pageId: "theme",
    colorScheme: "dark",
    run: async (page) => {
      const read = await page.evaluate(() => {
        const root = document.documentElement
        const wasDark = root.classList.contains("dark")
        const wasTheme = root.getAttribute("data-theme")
        // An app's own brand colour, unlayered on :root, as the theme README tells an app to set it.
        const brand = document.createElement("style")
        brand.textContent =
          ":root { --color-primary: oklch(0.5 0.15 150); --color-accent: oklch(0.5 0.15 150); }"
        document.head.append(brand)
        root.classList.add("dark")
        root.setAttribute("data-theme", "ink")

        const resolve = (value: string) => {
          const probe = document.createElement("span")
          probe.style.color = value
          document.body.append(probe)
          const color = getComputedStyle(probe).color
          probe.remove()
          return color
        }
        const result = {
          brand: resolve("oklch(0.5 0.15 150)"),
          primary: resolve("var(--color-primary)"),
          accent: resolve("var(--color-accent)"),
          muted: resolve("var(--color-primary-muted)"),
          step400: resolve("var(--color-accent-400)"),
          canvas: getComputedStyle(document.body).backgroundColor,
        }

        brand.remove()
        root.classList.toggle("dark", wasDark)
        if (wasTheme === null) root.removeAttribute("data-theme")
        else root.setAttribute("data-theme", wasTheme)
        return result
      })
      const wrong = [
        read.primary !== read.brand && `--color-primary is ${read.primary}`,
        read.accent !== read.brand && `--color-accent is ${read.accent}`,
        read.muted !== read.step400 &&
        `--color-primary-muted is ${read.muted}, not ${read.step400}`,
      ].filter(Boolean)
      if (wrong.length > 0) {
        throw new Error(`with the brand ${read.brand} on :root, ${wrong.join("; ")}`)
      }
      return `primary and accent ${read.brand}, links ${read.muted}, canvas ${read.canvas}`
    },
  },
  {
    name: `ink: muted text on a hovered row's fill passes axe's colour contrast`,
    pageId: "theme",
    colorScheme: "dark",
    run: async (page) => {
      await page.evaluate(() => {
        const root = document.documentElement
        root.classList.add("dark")
        root.setAttribute("data-theme", "ink")
        // The fill a hovered table row, menu item or option paints, with the muted text a row holds.
        const row = document.createElement("div")
        row.setAttribute("data-e2e", "ink-hover-probe")
        row.className = "bg-hover p-4"
        row.innerHTML = `<span class="text-sm text-muted">Updated 3 days ago</span>`
        document.body.prepend(row)
      })
      await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
      const probe = `[data-e2e="ink-hover-probe"]`
      const { violations, passes } = await new AxeBuilder({ page }).include(probe)
        .withRules(["color-contrast"]).analyze()
      if (violations.length > 0) {
        throw new Error(
          violations.map((rule) => rule.nodes.map((n) => n.failureSummary)).join("; "),
        )
      }
      if (!passes.some((rule) => rule.id === "color-contrast")) {
        throw new Error("axe did not measure the hovered row's colour contrast")
      }
      return await page.locator(probe).evaluate((row) => getComputedStyle(row).backgroundColor)
    },
  },
  inputIconHoverSpec(),
  {
    name: "an Arabic page draws in the Arabic face, with no tracking, a taller line and no italic",
    pageId: "theme",
    run: async (page) => {
      const seen = await probeTypePage(page, "type-demo/")
      const wrong = [
        !seen.arabicFace.includes("loaded") && `the Arabic face is ${seen.arabicFace.join(", ")}`,
        !seen.fetched && "the Arabic face's file was not fetched",
        !["normal", "0px"].includes(seen.headingTracking) &&
        `a tracking-tight heading is spaced ${seen.headingTracking}`,
        seen.bodyLineHeight !== "28px" && `a text-base line is ${seen.bodyLineHeight}, not 28px`,
        seen.emphasisStyle !== "normal" && `em is ${seen.emphasisStyle}`,
        seen.slantedStyle !== "normal" && `the italic class is ${seen.slantedStyle}`,
      ].filter(Boolean)
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      const axe = await new AxeBuilder({ page }).analyze()
      if (axe.violations.length > 0) {
        throw new Error(
          `axe: ${axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`,
        )
      }
      return `face ${seen.arabicFace.join(", ")}, line ${seen.bodyLineHeight}, tracking ` +
        `${seen.headingTracking}, axe clean`
    },
  },
  {
    name: "a page with no Arabic letter never downloads the Arabic face, and keeps its tracking",
    pageId: "theme",
    run: async (page) => {
      const seen = await probeTypePage(page, "type-demo/latin.html")
      const wrong = [
        seen.arabicFace.length === 0 && "the page declares no Arabic face to leave unloaded",
        seen.arabicFace.some((status) => status !== "unloaded") &&
        `the Arabic face is ${seen.arabicFace.join(", ")}`,
        seen.fetched && "the Arabic face's file was fetched",
        ["normal", "0px"].includes(seen.headingTracking) &&
        "a tracking-tight heading lost its tracking outside Arabic",
        seen.emphasisStyle !== "italic" && `em is ${seen.emphasisStyle} outside Arabic`,
      ].filter(Boolean)
      if (wrong.length > 0) throw new Error(wrong.join("; "))
      return `face ${seen.arabicFace.join(", ")}, tracking ${seen.headingTracking}`
    },
  },
  ...primaryMutedSpecs(),
]

/** How a spec draws the root: the light palette, `.dark`, ink, or the auto-dark marker. */
type Mode = "light" | "dark" | "ink" | "auto"

/** A colour to read: a CSS colour expression, or a class and the property its element paints. */
type Probe = string | [className: string, property: "color" | "background-color"]

/** An app's accent on `:root`, unlayered, as the theme README tells an app to set it. */
const brandOnRoot = (colour: string) =>
  `:root { --color-primary: ${colour}; --color-accent: ${colour}; }`

/** Purple-600 and purple-400: the default light and dark link tones. */
const PURPLE_600 = "oklch(0.558 0.288 302.321)"
const PURPLE_400 = "oklch(0.714 0.203 305.504)"

/**
 * Each probe's colour as sRGB bytes, painted on a canvas, with `css` added to the page and the
 * root drawn in `mode`. Everything is put back before it returns.
 */
function coloursIn(
  page: Page,
  mode: Mode,
  css: string,
  probes: Record<string, Probe>,
): Promise<Record<string, number[]>> {
  return page.evaluate(({ mode, css, probes, auto }) => {
    const root = document.documentElement
    const saved = { dark: root.classList.contains("dark"), theme: root.getAttribute("data-theme") }
    const style = document.createElement("style")
    style.textContent = css
    document.head.append(style)
    root.classList.toggle("dark", mode === "dark" || mode === "ink")
    if (mode === "ink") root.setAttribute("data-theme", "ink")
    else root.removeAttribute("data-theme")
    if (mode === "auto") root.setAttribute(auto, "")

    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("no 2D canvas to resolve colours with")
    const result: Record<string, number[]> = {}
    for (const [name, probe] of Object.entries(probes)) {
      const element = document.createElement("a")
      if (typeof probe === "string") element.style.color = probe
      else element.className = probe[0]
      document.body.append(element)
      const colour = getComputedStyle(element)
        .getPropertyValue(typeof probe === "string" ? "color" : probe[1])
      element.remove()
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = colour
      context.fillRect(0, 0, 1, 1)
      result[name] = [...context.getImageData(0, 0, 1, 1).data]
    }

    style.remove()
    root.removeAttribute(auto)
    root.classList.toggle("dark", saved.dark)
    if (saved.theme === null) root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", saved.theme)
    return result
  }, { mode, css, probes, auto: THEME_AUTO_ATTRIBUTE })
}

/** The WCAG contrast of sRGB bytes against white. */
function contrastOnWhite([r, g, b]: number[]): number {
  const linear = (byte: number) => {
    const v = byte / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 1.05 / (0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) + 0.05)
}

/** The OKLCH hue, in degrees, of sRGB bytes (Björn Ottosson's OKLab matrices). */
function hueOf([r, g, b]: number[]): number {
  const linear = [r, g, b].map((byte) => {
    const v = byte / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const [l, m, s] = [
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
  ].map((row) => Math.cbrt(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]))
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360
}

/** How far apart two hues are, in degrees, the short way round. */
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** `rgb(…)` of sRGB bytes, for a message. */
const rgb = (bytes: number[]) => `rgb(${bytes.slice(0, 3).join(" ")})`

/**
 * `--color-primary-muted`, the link and form-ring tone, follows the app's accent in every palette
 * (#752): one spec per state, each reading the computed colour in Chromium.
 */
function primaryMutedSpecs(): Spec[] {
  const muted = "var(--color-primary-muted)"
  const equal = (a: number[], b: number[]) => a.join() === b.join()
  return [
    {
      name: "primary-muted: with no accent set, the light link tone is purple-600",
      pageId: "theme",
      run: async (page) => {
        const seen = await coloursIn(page, "light", "", { muted, want: PURPLE_600 })
        if (!equal(seen.muted, seen.want)) {
          throw new Error(`the link tone is ${rgb(seen.muted)}, not ${rgb(seen.want)}`)
        }
        return rgb(seen.muted)
      },
    },
    {
      name: "primary-muted: a green accent on :root gives a green light link tone, 4.5:1 on white",
      pageId: "theme",
      run: async (page) => {
        const green = "oklch(0.5 0.15 150)"
        const seen = await coloursIn(page, "light", brandOnRoot(green), { muted, accent: green })
        const gap = hueGap(hueOf(seen.muted), hueOf(seen.accent))
        const contrast = contrastOnWhite(seen.muted)
        const wrong = [
          gap > 10 && `its hue is ${gap.toFixed(1)} degrees off the accent's`,
          contrast < 4.5 && `it reads ${contrast.toFixed(2)}:1 on white`,
        ].filter(Boolean)
        if (wrong.length > 0) {
          throw new Error(`the link tone ${rgb(seen.muted)}: ${wrong.join("; ")}`)
        }
        return `${rgb(seen.muted)}, ${contrast.toFixed(2)}:1, hue ${gap.toFixed(1)} degrees off`
      },
    },
    {
      name: "primary-muted: a light yellow accent on :root still gives a light link tone that " +
        "reads 4.5:1 on white",
      pageId: "theme",
      run: async (page) => {
        const yellow = "oklch(0.9 0.18 100)"
        const seen = await coloursIn(page, "light", brandOnRoot(yellow), { muted, accent: yellow })
        const contrast = contrastOnWhite(seen.muted)
        const gap = hueGap(hueOf(seen.muted), hueOf(seen.accent))
        const wrong = [
          contrast < 4.5 && `it reads ${contrast.toFixed(2)}:1 on white`,
          gap > 15 && `its hue is ${gap.toFixed(1)} degrees off the accent's`,
        ].filter(Boolean)
        if (wrong.length > 0) {
          throw new Error(`the link tone ${rgb(seen.muted)}: ${wrong.join("; ")}`)
        }
        return `${rgb(seen.muted)}, ${contrast.toFixed(2)}:1, hue ${gap.toFixed(1)} degrees off`
      },
    },
    {
      name: "primary-muted: an app's own unlayered --color-primary-muted on :root wins over the " +
        "derived one",
      pageId: "theme",
      run: async (page) => {
        const own = "oklch(0.5 0.2 30)"
        const css = `${brandOnRoot("oklch(0.5 0.15 150)")} :root { --color-primary-muted: ${own}; }`
        const seen = await coloursIn(page, "light", css, { muted, own })
        if (!equal(seen.muted, seen.own)) {
          throw new Error(`the link tone is ${rgb(seen.muted)}, not the app's ${rgb(seen.own)}`)
        }
        return rgb(seen.muted)
      },
    },
    {
      name: "primary-muted: with no accent set, the .dark link tone is purple-400",
      pageId: "theme",
      colorScheme: "dark",
      run: async (page) => {
        const seen = await coloursIn(page, "dark", "", { muted, want: PURPLE_400 })
        if (!equal(seen.muted, seen.want)) {
          throw new Error(`the link tone is ${rgb(seen.muted)}, not ${rgb(seen.want)}`)
        }
        return rgb(seen.muted)
      },
    },
    {
      name:
        "primary-muted: a green accent on :root gives a .dark link tone of the accent's step 400",
      pageId: "theme",
      colorScheme: "dark",
      run: async (page) => {
        const green = "oklch(0.5 0.15 150)"
        const seen = await coloursIn(page, "dark", brandOnRoot(green), {
          muted,
          step400: "var(--color-accent-400)",
          purple: PURPLE_400,
        })
        if (!equal(seen.muted, seen.step400) || equal(seen.muted, seen.purple)) {
          throw new Error(`the link tone is ${rgb(seen.muted)}, not ${rgb(seen.step400)}`)
        }
        return rgb(seen.muted)
      },
    },
    {
      name: `primary-muted: under .dark and data-theme="ink" with a purple accent, a .btn-link ` +
        `and a .btn-primary render in the same hue`,
      pageId: "theme",
      colorScheme: "dark",
      run: async (page) => {
        const purple = "oklch(0.381 0.176 304.987)"
        const seen = await coloursIn(page, "ink", brandOnRoot(purple), {
          link: ["btn-link", "color"],
          button: ["btn-primary", "background-color"],
          muted,
          primary: "var(--color-primary)",
        })
        // The elements must be styled by the classes, or the hues compare unstyled defaults.
        if (!equal(seen.link, seen.muted) || !equal(seen.button, seen.primary)) {
          throw new Error(`the classes are not styled: ${JSON.stringify(seen)}`)
        }
        const gap = hueGap(hueOf(seen.link), hueOf(seen.button))
        if (gap > 5) {
          throw new Error(
            `the link ${rgb(seen.link)} is ${gap.toFixed(1)} degrees of hue off the button ` +
              rgb(seen.button),
          )
        }
        return `link ${rgb(seen.link)}, button ${rgb(seen.button)}, ${gap.toFixed(1)} degrees apart`
      },
    },
    {
      name: `primary-muted: under ${THEME_AUTO_ATTRIBUTE} on a dark system, a green accent on ` +
        `:root gives a link tone of the accent's step 400`,
      pageId: "theme",
      colorScheme: "dark",
      run: async (page) => {
        const green = "oklch(0.5 0.15 150)"
        const seen = await coloursIn(page, "auto", brandOnRoot(green), {
          muted,
          step400: "var(--color-accent-400)",
          light: "var(--accent-link-tone)",
        })
        if (!equal(seen.muted, seen.step400) || equal(seen.muted, seen.light)) {
          throw new Error(`the link tone is ${rgb(seen.muted)}, not ${rgb(seen.step400)}`)
        }
        return rgb(seen.muted)
      },
    },
  ]
}

/**
 * `.btn-input-icon`, the icon button inside an input, paints the `--color-hover` fill under the
 * pointer and keeps its `--color-foreground` text, and has no fill before. Its transition is
 * switched off on the probe, so the colours read are the end state.
 */
function inputIconHoverSpec(): Spec {
  return {
    name: "theme: .btn-input-icon paints the hover fill under the pointer, and none before",
    pageId: "theme",
    run: async (page) => {
      await page.evaluate(() => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "btn-input-icon"
        button.setAttribute("data-e2e", "input-icon-probe")
        // Above the page, clear of the sticky header, so the pointer reaches it.
        button.style.cssText = "transition: none; position: fixed; left: 50%; top: 50%; z-index: 99"
        button.textContent = "x"
        document.body.prepend(button)
      })
      const probe = page.locator(`[data-e2e="input-icon-probe"]`)
      const colours = () =>
        probe.evaluate((button) => {
          const token = (name: string) => {
            const span = document.createElement("span")
            span.style.backgroundColor = `var(${name})`
            button.after(span)
            const colour = getComputedStyle(span).backgroundColor
            span.remove()
            return colour
          }
          const style = getComputedStyle(button)
          return {
            background: style.backgroundColor,
            color: style.color,
            hover: token("--color-hover"),
            foreground: token("--color-foreground"),
          }
        })
      const before = await colours()
      if (before.background === before.hover) {
        throw new Error(
          `the fill is drawn before the pointer is over it: ${JSON.stringify(before)}`,
        )
      }
      await probe.hover()
      await page.locator(`[data-e2e="input-icon-probe"]:hover`).waitFor()
      const after = await colours()
      if (after.background !== after.hover || after.color !== after.foreground) {
        throw new Error(`hovered colours are not the tokens: ${JSON.stringify(after)}`)
      }
    },
  }
}
