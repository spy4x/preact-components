import { check, CONTRAST_HELPERS, type Devtools } from "../harness.ts"

/** One `Notice` tone's panel, read in one palette. */
interface NoticePanel {
  tone: string
  /** Whether the panel was found in the catalogue. */
  found: boolean
  /** The text's contrast against the panel's background, composited over the page. */
  text: number
  /** The glyph's contrast against the same background. */
  glyph: number
  /** Whether the border paints `--color-<tone>` and the background `--color-<tone>-soft`. */
  onTokens: boolean
  /** Whether the glyph paints `--color-<tone>`, not the text colour or a neighbouring token. */
  glyphOnToken: boolean
  /** The computed colours, for the report. */
  detail: string
}

/**
 * `Notice` draws each tone — info, warning, success and danger — from its tokens (#572, #552): the
 * border and the glyph paint `--color-<tone>` and the background `--color-<tone>-soft` in the
 * light, the dark and the ink palette; its text reaches 4.5:1 and its glyph 3:1 against that
 * background.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function noticeToneCheck(devtools: Devtools): Promise<void> {
  const reading = await devtools.evaluate<Record<"light" | "dark" | "ink", NoticePanel[]>>(
    `(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const tones = ["info", "warning", "success", "danger"]
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(" + name + ")"
      document.body.appendChild(probe)
      const color = paint(getComputedStyle(probe).backgroundColor)
      probe.remove()
      return color
    }
    const same = (a, b) => a.every((channel, index) => channel === b[index])
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
    // Only the panels' own transitions: the catalogue also runs endless animations (spinners).
    const settle = async () => {
      const panels = [...document.querySelectorAll("#demo-Notice [data-tone]")]
      await Promise.all(
        panels.flatMap((panel) => panel.getAnimations({ subtree: true }))
          .map((animation) => animation.finished.catch(() => {})),
      )
      await frame()
      await frame()
    }
    const measure = () => tones.map((tone) => {
      const panel = document.querySelector('#demo-Notice [data-tone="' + tone + '"]')
      const glyph = panel?.querySelector("svg")
      if (!panel || !glyph) {
        return {
          tone,
          found: false,
          text: 0,
          glyph: 0,
          onTokens: false,
          glyphOnToken: false,
          detail: "missing",
        }
      }
      const style = getComputedStyle(panel)
      const lines = glyph.nextElementSibling ? textHolders(glyph.nextElementSibling) : []
      return {
        tone,
        found: lines.length > 0,
        text: lines.length ? Math.min(...lines.map((line) => seenRatio(line))) : 0,
        glyph: seenRatio(glyph),
        onTokens: same(paint(style.borderTopColor), token("--color-" + tone)) &&
          same(paint(style.backgroundColor), token("--color-" + tone + "-soft")),
        glyphOnToken: same(paint(getComputedStyle(glyph).color), token("--color-" + tone)),
        detail: "text " + style.color + ", border " + style.borderTopColor + ", background " +
          style.backgroundColor + ", glyph " + getComputedStyle(glyph).color,
      }
    })
    try {
      root.classList.remove("dark")
      root.removeAttribute("data-theme")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      root.setAttribute("data-theme", "ink")
      await settle()
      const ink = measure()
      return { light, dark, ink }
    } finally {
      root.classList.toggle("dark", wasDark)
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
    }
  })()`,
  )

  for (const palette of ["light", "dark", "ink"] as const) {
    for (const panel of reading[palette]) {
      check(
        `in the ${palette} palette the ${panel.tone} Notice draws its border and its glyph with ` +
          `--color-${panel.tone} and its background with --color-${panel.tone}-soft, its text at ` +
          "4.5:1 or better and its glyph at 3:1 or better",
        panel.found && panel.onTokens && panel.glyphOnToken && panel.text >= 4.5 &&
          panel.glyph >= 3,
        panel.found
          ? `text ${panel.text.toFixed(2)}:1, glyph ${panel.glyph.toFixed(2)}:1 — ${panel.detail}`
          : `no ${panel.tone} Notice in the catalogue`,
      )
    }
  }
}
