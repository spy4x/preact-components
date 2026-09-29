/**
 * Writes the accent scale — the `@supports` block of `tokens.css` between the `accent-scale`
 * region markers — from the inputs below, so every constant in it has a source (#380, #387).
 *
 * What each step is, in `oklch(from var(--color-accent) L C H)`:
 *
 * - **L.** The tints (50–300) keep Tailwind's purple lightness. Steps 400–950 scale the accent's
 *   lightness by the purple step's ratio to purple-900's, capped by {@link LIGHTNESS_CAPS}. The caps
 *   on 600, 700 and 800 exist for contrast: those steps carry a white label (the dark primary
 *   Button's fill and hover, the light hover), and at or below them white clears 4.5:1 at every
 *   hue. Step 600's cap gets {@link PURPLE_600_ALLOWANCE} times the near-purple weight, because
 *   purple-600 itself sits just above the cap and has to stay exact.
 * - **C.** The purple step's chroma ratio, grown only near purple's hue (the weight
 *   {@link NEAR_PURPLE}), then capped at the sRGB triangle: black, the gamut's cusp at that hue,
 *   white. The cusp's lightness and chroma are fitted here as {@link HARMONICS}-harmonic Fourier
 *   series in hue from the exact sRGB gamut, and the chroma scaled by {@link TRIANGLE_SCALE} so the
 *   triangle stays inside the gamut. Each step adds, times the same weight, the allowance purple
 *   itself needs to sit under the cap, plus {@link ALLOWANCE_MARGIN}.
 * - **H.** The purple step's hue offset from purple-900's.
 *
 * **The label.** `--color-accent-foreground` is white (`oklch(1 0 0)`) or a near-black of lightness
 * {@link DARK_LABEL}, whichever has the higher contrast on the accent: an accent whose WCAG relative
 * luminance (worked out from its sRGB channels in CSS with `pow()`) is above {@link LABEL_LUMINANCE}
 * takes the dark one. Steps 600, 700 and 800 sit under the label too; for an accent that takes the
 * dark label they are the accent, or lighter for the hovers ({@link DARK_LABEL_STEP}), so a hover
 * never lowers the contrast. The choice is a colour whose alpha is 0 or 1 (`--accent-label-probe`),
 * the origin those steps and the label read. `pages/checks/theme.ts` sweeps accents of several hues
 * and lightnesses through it in a browser.
 *
 * With no token set the accent is purple-900, the weight is exactly 1, and every step is Tailwind's
 * purple step; `pages/checks/theme.ts` measures that, the gamut and the white-label contrast in a
 * browser. `accent-scale.test.ts` fails when `tokens.css` differs from what this writes.
 *
 * ```bash
 * deno task --cwd theme generate   # runs this first, then generate.ts
 * ```
 *
 * Pure TypeScript with no dependency; the fit takes well under a second.
 */

/** Tailwind 4.1.12's purple steps, `[L, C, H]` in OKLCH — the colours the scale reproduces. */
export const PURPLE: Record<number, readonly [number, number, number]> = {
  50: [0.977, 0.014, 308.299],
  100: [0.946, 0.033, 307.174],
  200: [0.902, 0.063, 306.703],
  300: [0.827, 0.119, 306.383],
  400: [0.714, 0.203, 305.504],
  500: [0.627, 0.265, 303.9],
  600: [0.558, 0.288, 302.321],
  700: [0.496, 0.265, 301.924],
  800: [0.438, 0.218, 303.724],
  900: [0.381, 0.176, 304.987],
  950: [0.291, 0.149, 302.717],
}

/** The derived steps, in the order they are written. Step 900 is the accent itself. */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 950]

/**
 * Lightness caps for the steps that scale the accent's lightness. 400 and 500 keep the scale's
 * order for an accent about as dark as purple-900; 600, 700 and 800 keep a white label at 4.5:1.
 */
export const LIGHTNESS_CAPS: Record<number, number> = {
  400: 0.8,
  500: 0.76,
  600: 0.545,
  700: 0.5,
  800: 0.545,
}

/**
 * The relative luminance (WCAG) above which an accent takes a dark label instead of a white one.
 * White clears 4.5:1 up to 0.183 and a label of OKLCH lightness {@link DARK_LABEL} from 0.180, so
 * 0.18 leaves no accent without a label at 4.5:1.
 */
export const LABEL_LUMINANCE = 0.18

/** The lightness of the dark label: near-black, contrast 4.5:1 from a fill luminance of 0.18. */
export const DARK_LABEL = 0.1

/** The steps that sit under a label: the primary Button's fill and hover. */
const LABEL_STEPS = [600, 700, 800]

/**
 * What a label step is for an accent that takes a dark label, as a CSS lightness. The hover steps
 * (800 in light, 600 in dark) go a little lighter and the dark fill (700) is the accent itself: a
 * lighter fill only raises the dark label's contrast, where the usual caps, meant for a white
 * label, would darken it below 4.5:1.
 */
const DARK_LABEL_STEP: Record<number, string> = { 600: "l + 0.05", 700: "l", 800: "l + 0.05" }

/** Added to step 600's cap times the near-purple weight: purple-600's lightness is 0.558. */
export const PURPLE_600_ALLOWANCE = 0.013

/** The near-purple weight: exactly 1 at purple-900's hue, 0 beyond about 11 degrees from it. */
export const NEAR_PURPLE = "max(0, (cos((h - 304.987) * 1deg) - 0.98) * 50)"

/** Harmonics in the cusp's Fourier fit. */
export const HARMONICS = 3

/** Scale on the triangle's chroma, so the fitted triangle stays inside sRGB. */
export const TRIANGLE_SCALE = 0.86

/** Margin on top of the allowance purple itself needs under the triangle. */
export const ALLOWANCE_MARGIN = 0.004

/** Hues the cusp is sampled at: every 3 degrees. */
const HUES = Array.from({ length: 120 }, (_, index) => index * 3)

/** Linear sRGB of an OKLCH colour (Björn Ottosson's OKLab matrices). */
function linearSrgb(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos(h * Math.PI / 180)
  const b = c * Math.sin(h * Math.PI / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

/** The most chroma sRGB shows at a lightness and hue, by bisection. */
function maxChroma(l: number, h: number): number {
  let low = 0
  let high = 0.5
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (linearSrgb(l, middle, h).every((channel) => channel >= 0 && channel <= 1)) low = middle
    else high = middle
  }
  return low
}

/** The sRGB gamut's cusp at a hue: the lightness where chroma peaks, and that chroma. */
function cusp(h: number): [number, number] {
  let best: [number, number] = [0, 0]
  for (let index = 1; index < 400; index++) {
    const l = index / 400
    const c = maxChroma(l, h)
    if (c > best[1]) best = [l, c]
  }
  const coarse = best[0]
  for (let index = -20; index <= 20; index++) {
    const l = coarse + index / 8000
    if (l <= 0 || l >= 1) continue
    const c = maxChroma(l, h)
    if (c > best[1]) best = [l, c]
  }
  return best
}

/** A Fourier series: the constant, then `[cos, sin]` per harmonic, each rounded to 4 decimals. */
type Series = [number, ...[number, number][]]

/** Fit `values`, sampled at {@link HUES}, with {@link HARMONICS} harmonics, scaled by `scale`. */
function fit(values: number[], scale: number): Series {
  const round = (value: number) => Number((value * scale).toFixed(4))
  const n = values.length
  const series: Series = [round(values.reduce((sum, value) => sum + value, 0) / n)]
  for (let k = 1; k <= HARMONICS; k++) {
    let a = 0
    let b = 0
    values.forEach((value, index) => {
      a += value * Math.cos(k * HUES[index] * Math.PI / 180)
      b += value * Math.sin(k * HUES[index] * Math.PI / 180)
    })
    series.push([round(2 / n * a), round(2 / n * b)])
  }
  return series
}

/** The series' value at a hue. */
function evaluate(series: Series, h: number): number {
  const [constant, ...harmonics] = series
  return harmonics.reduce(
    (sum, [a, b], index) =>
      sum + a * Math.cos((index + 1) * h * Math.PI / 180) +
      b * Math.sin((index + 1) * h * Math.PI / 180),
    constant,
  )
}

/** The series as CSS, in terms of the channel keyword `h`. */
function css(series: Series): string {
  const [constant, ...harmonics] = series
  const terms = [`${constant}`]
  harmonics.forEach(([a, b], index) => {
    const angle = index === 0 ? "h * 1deg" : `h * ${index + 1}deg`
    for (const [coefficient, fn] of [[a, "cos"], [b, "sin"]] as const) {
      terms.push(`${coefficient < 0 ? "-" : "+"} ${Math.abs(coefficient)} * ${fn}(${angle})`)
    }
  })
  return `(${terms.join(" ")})`
}

/** A number as the CSS writes it: rounded, with no trailing zeros. */
const fixed = (value: number, digits: number) => `${Number(value.toFixed(digits))}`

/** The step's lightness expression. */
function lightness(step: number): string {
  const [l] = PURPLE[step]
  const scaled = `l * ${l} / 0.381`
  if (LABEL_STEPS.includes(step)) {
    const cap = step === 600
      ? `${LIGHTNESS_CAPS[600]} + ${PURPLE_600_ALLOWANCE} * ${NEAR_PURPLE}`
      : `${LIGHTNESS_CAPS[step]}`
    // `alpha` is the probe's: 1 for an accent that takes a dark label, else 0.
    return `calc((1 - alpha) * min(${cap}, ${scaled}) + alpha * (${DARK_LABEL_STEP[step]}))`
  }
  if (step in LIGHTNESS_CAPS) return `min(${LIGHTNESS_CAPS[step]}, ${scaled})`
  if (step === 950) return `calc(${scaled})`
  return `${l}`
}

/** `channel` (0-1, sRGB) as linear light, clamped to the gamut the screen draws. */
const linear = (channel: string) => `pow((clamp(0, ${channel}, 1) + 0.055) / 1.055, 2.4)`

/**
 * The accent as an sRGB colour, clipped to the screen's gamut as the browser draws it, whose alpha says which label it takes: 1 when its relative
 * luminance is above {@link LABEL_LUMINANCE} (a dark label), else 0 (white). The label steps and
 * the label read it as their origin, so the choice is made once and by the same measure.
 */
const PROBE =
  `color(from var(--color-accent) srgb clamp(0, r, 1) clamp(0, g, 1) clamp(0, b, 1) / clamp(0, calc((0.2126 * ${
    linear("r")
  } + 0.7152 * ${linear("g")} + 0.0722 * ${linear("b")} - ${LABEL_LUMINANCE}) * 1000000), 1))`

/** The generated block: the `@supports` rule that declares every derived step. */
export function accentScaleBlock(): string {
  const cusps = HUES.map(cusp)
  const cuspLightness = fit(cusps.map(([l]) => l), 1)
  const cuspChroma = fit(cusps.map(([, c]) => c), TRIANGLE_SCALE)
  const [, , purpleHue] = PURPLE[900]
  const triangle = (l: number) => {
    const lc = evaluate(cuspLightness, purpleHue)
    const cc = evaluate(cuspChroma, purpleHue)
    return Math.max(0, Math.min(cc * l / lc, cc * (1 - l) / (1 - lc)))
  }
  const lc = css(cuspLightness)
  const cc = css(cuspChroma)

  const declarations = STEPS.map((step) => {
    const [l, c, h] = PURPLE[step]
    const ratio = c / PURPLE[900][1]
    const grow = ratio > 1
      ? `c * (1 + ${fixed(ratio - 1, 6)} * ${NEAR_PURPLE})`
      : `c * ${c} / 0.176`
    const allowance = fixed(Math.max(0, c - triangle(l)) + ALLOWANCE_MARGIN, 3)
    const stepLightness = lightness(step)
    const inner = stepLightness.replace(/^calc\(/, "(")
    const origin = LABEL_STEPS.includes(step) ? "var(--accent-label-probe)" : "var(--color-accent)"
    const alpha = LABEL_STEPS.includes(step) ? "\n      / 1" : ""
    const offset = Number((h - purpleHue).toFixed(3))
    const hue = `calc(h ${offset < 0 ? "-" : "+"} ${Math.abs(offset)})`
    return `    --color-accent-${step}: oklch(
      from ${origin}
      ${stepLightness}
      min(
        ${grow},
        ${cc} * max(0, min(${inner} / ${lc}, (1 - ${inner}) / (1 - ${lc}))) + ${allowance} * ${NEAR_PURPLE}
      )
      ${hue}${alpha}
    );`
  })

  return `@supports (color: oklch(from red calc(pow(l, 2)) max(0, c * cos(h * 1deg)) calc(h + alpha))) {
  :root {
    --accent-label-probe: ${PROBE};
    --color-accent-foreground: oklch(
      from var(--accent-label-probe)
      calc(1 - alpha * ${1 - DARK_LABEL})
      0
      0
      / 1
    );
${declarations.join("\n")}
  }
}`
}

/** The region markers around the generated block in `tokens.css`. */
export const REGION_START = "/* #region accent-scale — generated by accent-scale.ts, do not edit */"
export const REGION_END = "/* #endregion accent-scale */"

/**
 * `tokens` with the text between the region markers replaced by {@link accentScaleBlock}.
 *
 * @throws If either marker is missing.
 */
export function withAccentScale(tokens: string): string {
  const start = tokens.indexOf(REGION_START)
  const end = tokens.indexOf(REGION_END)
  if (start < 0 || end < start) throw new Error("tokens.css has no accent-scale region markers")
  return `${tokens.slice(0, start + REGION_START.length)}\n${accentScaleBlock()}\n${
    tokens.slice(end)
  }`
}

if (import.meta.main) {
  const url = new URL("./tokens.css", import.meta.url)
  await Deno.writeTextFile(url, withAccentScale(await Deno.readTextFile(url)))
  console.log("wrote the accent scale into tokens.css")
}
