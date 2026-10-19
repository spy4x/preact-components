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
]
