import { check, type Devtools, PAGE_UNTIL, pointerToCorner } from "./harness.ts"

/**
 * Every glyph's caption fits its cell on a phone: a long name wraps between its words rather than
 * running past the cell or ending in an ellipsis. Measured at 375 px, the narrowest width the guide
 * designs for, where the gallery puts three glyphs in a row; with every glyph shown.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function captionFitCheck(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    const fit = await devtools.evaluate<{ total: number; cut: string[]; perRow: number }>(
      `(async () => {
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        const cells = [...document.querySelectorAll("#icons [data-icon]")]
        const cut = cells
          .map((cell) => cell.querySelector("span"))
          .filter((caption) => caption.scrollWidth > caption.clientWidth)
          .map((caption) => caption.closest("[data-icon]").getAttribute("data-icon"))
        const top = cells[0]?.getBoundingClientRect().top
        const perRow = cells.filter((cell) => cell.getBoundingClientRect().top === top).length
        return { total: cells.length, cut, perRow }
      })()`,
    )
    check(
      "every glyph's name fits its cell on a phone, three glyphs to a row",
      fit.total > 90 && fit.cut.length === 0 && fit.perRow === 3,
      `${fit.cut.length} of ${fit.total} names cut off${
        fit.cut.length ? ` (${fit.cut.slice(0, 5).join(", ")})` : ""
      }, ${fit.perRow} per row at 375 px`,
    )
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/** One gallery glyph that failed a rendering rule, and why. */
interface GlyphFault {
  name: string
  fault: string
}

/** What {@link glyphPaintCheck} reads in one theme. */
interface GlyphPaint {
  total: number
  faults: GlyphFault[]
  minRatio: number
  hovered: number
}

/**
 * On the light and the dark theme, every glyph in the gallery renders at the gallery's 24 px size,
 * draws inside its own `viewBox` and spans at least 40% of it (Feather's small
 * `arrow-up-right` spans 42%), paints every stroke and fill in
 * the text colour it inherits, and that colour reaches 3:1 against the cell's background.
 *
 * The glyphs #233 swapped for pack drawings changed `viewBox` (`IconUpwork`, `IconBookmark`,
 * `IconQuote`, `IconGateway`, `IconExternalLink`) and stroke or fill kind (`IconQuote`,
 * `IconLinkedIn`, `IconTwitter`, `IconYouTube`); this is the proof that each still draws in the
 * cell, and none paints a fixed colour the theme cannot reach — the old `IconGateway` filled white.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function glyphPaintCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  for (const theme of ["light", "dark"] as const) {
    const read = await devtools.evaluate<GlyphPaint>(`(async () => {
      const root = document.documentElement
      const wasDark = root.classList.contains("dark")
      root.classList.toggle("dark", ${theme === "dark"})
      try {
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1
        const paint = canvas.getContext("2d", { willReadFrequently: true })
        // Any CSS colour, oklch included, as sRGB channels and alpha.
        const rgba = (css) => {
          paint.clearRect(0, 0, 1, 1)
          paint.fillStyle = "#000"
          paint.fillStyle = css
          paint.fillRect(0, 0, 1, 1)
          return [...paint.getImageData(0, 0, 1, 1).data]
        }
        const luminance = ([r, g, b]) => {
          const linear = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
        }
        // The first opaque background at or above an element: what it is drawn on.
        const behind = (element) => {
          for (let at = element; at; at = at.parentElement) {
            const colour = rgba(getComputedStyle(at).backgroundColor)
            if (colour[3] === 255) return colour
          }
          return rgba(getComputedStyle(root).backgroundColor)
        }
        const cells = [...document.querySelectorAll("#icons [data-icon]")]
        const faults = []
        let minRatio = Infinity
        for (const cell of cells) {
          const name = cell.getAttribute("data-icon")
          const svg = cell.querySelector("svg")
          // The laid-out size, not the painted one: two spinners rotate, which widens their
          // bounding rectangle mid-turn without changing the size they are laid out at.
          const size = getComputedStyle(svg)
          if (size.width !== "24px" || size.height !== "24px") {
            faults.push({ name, fault: "box " + size.width + " x " + size.height })
          }
          const view = svg.viewBox.baseVal
          const drawn = svg.getBBox()
          const inside = drawn.x >= view.x - 0.5 && drawn.y >= view.y - 0.5 &&
            drawn.x + drawn.width <= view.x + view.width + 0.5 &&
            drawn.y + drawn.height <= view.y + view.height + 0.5
          const cover = Math.max(drawn.width / view.width, drawn.height / view.height)
          if (!inside || cover < 0.4) {
            faults.push({ name, fault: "drawing " + [drawn.x, drawn.y, drawn.width, drawn.height]
              .map((n) => Math.round(n * 10) / 10).join(",") + " in viewBox " +
              [view.x, view.y, view.width, view.height].join(",") })
          }
          const text = rgba(getComputedStyle(svg).color).join(",")
          let painted = 0
          for (const shape of svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon")) {
            const style = getComputedStyle(shape)
            for (const property of ["fill", "stroke"]) {
              const value = style[property]
              if (value === "none") continue
              painted++
              if (rgba(value).join(",") !== text) {
                faults.push({ name, fault: property + " " + value + " is not the text colour" })
              }
            }
          }
          if (painted === 0) faults.push({ name, fault: "paints nothing" })
          const ink = luminance(rgba(getComputedStyle(svg).color))
          const ground = luminance(behind(cell))
          minRatio = Math.min(minRatio, (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05))
        }
        return {
          total: cells.length,
          faults,
          minRatio: Math.round(minRatio * 100) / 100,
          hovered: cells.filter((cell) => cell.matches(":hover")).length,
        }
      } finally {
        root.classList.toggle("dark", wasDark)
      }
    })()`)
    check(
      `on the ${theme} theme, every gallery glyph draws inside its 24 px box in the text colour, ` +
        "at 3:1 or more against its cell",
      read.total > 90 && read.hovered === 0 && read.faults.length === 0 && read.minRatio >= 3,
      `${read.total} glyphs, ${read.hovered} hovered, lowest ratio ${read.minRatio}:1` +
        (read.faults.length
          ? `; ${read.faults.length} faults: ${
            read.faults.slice(0, 6).map((f) => `${f.name} ${f.fault}`).join("; ")
          }`
          : ""),
    )
  }
}

/** What {@link starVariantsCheck} reads off the gallery's two stars. */
interface StarVariants {
  found: number
  outlineFill: string
  solidFill: string
  solidStroke: string
  text: string
  sameBox: boolean
}

/**
 * The gallery shows `IconStar` beside `<IconStar filled />`: the outline paints no fill, the filled
 * star paints its fill and its stroke in the text colour, and the two draw the same box, so filling
 * a star in a rating does not shift it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function starVariantsCheck(devtools: Devtools): Promise<void> {
  const read = await devtools.evaluate<StarVariants>(`(() => {
    const [outline, solid] = [...document.querySelectorAll("#icons [data-star-variants] svg")]
    if (!outline || !solid) return { found: [outline, solid].filter(Boolean).length }
    const shape = (svg) => getComputedStyle(svg.querySelector("polygon"))
    const box = (svg) => {
      const { x, y, width, height } = svg.querySelector("polygon").getBBox()
      return [x, y, width, height].join(",")
    }
    return {
      found: 2,
      outlineFill: shape(outline).fill,
      solidFill: shape(solid).fill,
      solidStroke: shape(solid).stroke,
      text: getComputedStyle(solid).color,
      sameBox: box(outline) === box(solid) &&
        outline.getBoundingClientRect().width === solid.getBoundingClientRect().width,
    }
  })()`)
  check(
    "the gallery's filled IconStar paints solid in the text colour, in the outline star's box",
    read.found === 2 && read.outlineFill === "none" && read.solidFill === read.text &&
      read.solidStroke === read.text && read.sameBox,
    `${read.found} stars; outline fill ${read.outlineFill}, filled fill ${read.solidFill} ` +
      `stroke ${read.solidStroke}, text ${read.text}, same box ${read.sameBox}`,
  )
}

/**
 * `icons/`'s browser checks: every caption fits on a phone, every glyph draws in the text colour
 * on both themes, the filled star beside the outline one, the glyphs #495 added, the live filter
 * over the glyph gallery, and click-to-copy on a glyph.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function iconsChecks(devtools: Devtools): Promise<void> {
  await captionFitCheck(devtools)
  await glyphPaintCheck(devtools)
  await starVariantsCheck(devtools)

  const added = await devtools.evaluate<string[]>(
    `["IconCopy", "IconPen"].filter((name) => document.querySelector(\`#icons [data-icon="\${name}"] svg\`))`,
  )
  check(
    "the gallery lists IconCopy and IconPen",
    added.length === 2,
    `found: ${added.join(", ") || "neither"}`,
  )

  const filter = await devtools.evaluate<{
    total: number
    filtered: number
    allMatch: boolean
    status: string
  }>(
    `(async () => {
      const input = document.querySelector('#icons input[name="icon-search"]')
      const total = document.querySelectorAll("#icons [data-icon]").length
      input.focus()
      input.value = "arrow"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await ${PAGE_UNTIL}(() => document.querySelectorAll("#icons [data-icon]").length < total)
      const shown = [...document.querySelectorAll("#icons [data-icon]")]
        .map((cell) => cell.getAttribute("data-icon"))
      return {
        total,
        filtered: shown.length,
        allMatch: shown.every((name) => name.toLowerCase().includes("arrow")),
        status: document.querySelector("#icons p[aria-live]").textContent.trim(),
      }
    })()`,
  )
  check(
    "the icon filter narrows the icon gallery live",
    filter.total > 90 && filter.filtered > 0 && filter.filtered < filter.total && filter.allMatch,
    `${filter.filtered}/${filter.total} — ${filter.status}`,
  )

  const copy = await devtools.evaluate<{ name: string; status: string }>(
    `(async () => {
      const cell = document.querySelector("#icons [data-icon]")
      const name = cell.getAttribute("data-icon")
      cell.click()
      await ${PAGE_UNTIL}(() =>
        document.querySelector("#icons p[aria-live]").textContent.includes("copied")
      )
      return { name, status: document.querySelector("#icons p[aria-live]").textContent }
    })()`,
  )
  check(
    "clicking an icon copies its JSX",
    copy.status.includes("copied") && copy.status.includes(`<${copy.name} />`),
    copy.status.trim(),
  )
}
