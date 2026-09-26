/**
 * The spacing scale this library owns, and a checker that holds source code to it.
 *
 * Padding, margin, gap, `space-x/y` and scroll margin/padding use only the steps in
 * {@link SPACING_STEPS}. Layout components (`Stack`, `Cluster`, `Grid` in `@spy4x/preact-ui`) take
 * a named gap from {@link SPACING_GAPS} instead of a step. {@link findOffScaleSpacing} finds every
 * spacing class that breaks the scale in a file's text, so an app can run it from its own test.
 *
 * Everything here is plain string code with no Deno API, so it runs in any JavaScript runtime.
 * `docs/spacing.md` in the repository says which step to use where.
 */

/**
 * Every spacing step a class may use, smallest first: 0, 1 px, then 4, 8, 12, 16, 24, 32, 48 and
 * 64 px (Tailwind's step times 4 px).
 */
export const SPACING_STEPS = ["0", "px", "1", "2", "3", "4", "6", "8", "12", "16"] as const

/** One of {@link SPACING_STEPS}. */
export type SpacingStep = typeof SPACING_STEPS[number]

/**
 * The named gaps a layout component offers, and the step each one stands for: 0, 4, 8, 16, 24, 32
 * and 48 px. Steps `3` (12 px) and `16` (64 px) are not named: they are for a component's own
 * insides and the page gutter, not for the space between siblings.
 */
export const SPACING_GAPS = {
  none: "0",
  xs: "1",
  sm: "2",
  md: "4",
  lg: "6",
  xl: "8",
  "2xl": "12",
} as const satisfies Record<string, SpacingStep>

/** A named gap: a key of {@link SPACING_GAPS}. */
export type SpacingGap = keyof typeof SPACING_GAPS

/** One spacing class that breaks the scale, and where it is. */
export interface SpacingViolation {
  /** 1-based line of the class in the source. */
  line: number
  /** 1-based column of the class's first character, variants included. */
  column: number
  /** The class exactly as written, variants and `-` included: `sm:-mt-4`. */
  className: string
  /** Why it breaks the scale, in a sentence. */
  reason: string
}

/**
 * Spacing utility names, longest first so `gap-x` wins over `gap` and `scroll-mt` over `mt`.
 * Logical sides (`ps`, `me`, `scroll-ms`) are included.
 */
const UTILITIES = [
  "space-x",
  "space-y",
  "gap-x",
  "gap-y",
  "gap",
  ...["scroll-p", "scroll-m", "p", "m"].flatMap((base) =>
    ["x", "y", "t", "r", "b", "l", "s", "e"].map((side) => base + side)
  ),
  "scroll-p",
  "scroll-m",
  "p",
  "m",
].sort((a, b) => b.length - a.length)

/** Where a class may start: not inside a longer word, a custom property or a path. */
const START = String.raw`(?<![\w\-./:\[\]$@])`

/** A variant chain: `sm:`, `dark:hover:`, `data-[open]:`, `[&>*]:`, `group-hover/name:`. */
const VARIANTS = String.raw`((?:(?:[\w\-@*&]+(?:\[[^\]\s]*\])?|\[[^\]\s]*\])(?:\/[\w-]+)?:)*)`

/**
 * A class-shaped token: a variant chain, an optional `!` and `-`, a spacing utility, then a value —
 * a number, `px`, `auto`, `reverse`, `[arbitrary]` or `(--custom-property)` — and an optional
 * trailing `!`. The look-behind and look-ahead stop it matching inside a longer word, so `top-5`,
 * `step-5` and `--p-5` are not spacing classes.
 */
const CLASS = new RegExp(
  START +
    VARIANTS +
    String.raw`(!?)(-?)(${UTILITIES.join("|")})-` +
    String.raw`(\d+(?:\.\d+)?|px|auto|reverse|\[[^\]\s]*\]|\([^)\s]*\))` +
    String.raw`(!?)(?![\w\-%/\[(]|\.\d)`,
  "g",
)

/** CSS properties that are spacing: padding, margin, their scroll forms, and the gaps. */
const SPACING_PROPERTY = String.raw`(?:scroll-)?(?:padding|margin)` +
  String.raw`(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?` +
  String.raw`|(?:grid-)?(?:row-|column-)?gap`

/**
 * A Tailwind arbitrary property that sets spacing — a CSS declaration in square brackets whose
 * property is one of {@link SPACING_PROPERTY} — with the same variant chain and `!` as
 * {@link CLASS}.
 */
const ARBITRARY_PROPERTY = new RegExp(
  START + VARIANTS + String.raw`(!?)\[(${SPACING_PROPERTY}):[^\]\s]+\](!?)(?![\w\-])`,
  "g",
)

/** Tailwind's spacing function with its argument, in a stylesheet or inside an arbitrary value. */
const SPACING_FUNCTION = /--spacing\(\s*([\w.]*)\s*\)/g

const STEPS: ReadonlySet<string> = new Set(SPACING_STEPS)

/** The steps the spacing function takes: every step but `px`, which is not a number. */
const NUMERIC_STEPS = SPACING_STEPS.filter((step) => step !== "px").join(" ")

/**
 * Finds every spacing class in `source` that uses a step outside {@link SPACING_STEPS} or an
 * arbitrary value, written in square brackets or as a custom property in parentheses; every
 * arbitrary property that sets padding, margin, a gap or their scroll forms; and every use of
 * Tailwind's spacing function whose argument is not a numeric step.
 *
 * `source` is any file's text: TypeScript, TSX, CSS with `@apply`, or HTML. Every class-shaped
 * token is checked wherever it stands, comments included, because Tailwind's own scanner reads
 * comments too and emits CSS for a class it finds there. A word only counts when it has the exact
 * shape of a spacing class, so prose such as "gap-free", "p-value" or "top-5" is never reported.
 * Sizes and positions (`h-12`, `size-9`, `inset-2`, `max-w-6xl`) are not spacing and are not
 * checked, and neither are `auto` and `reverse`.
 *
 * What it cannot see: a raw CSS declaration (`padding: 10px` in a stylesheet), an inline `style`,
 * a class name built at run time (`` `p-${n}` ``), and Tailwind's legacy `theme()` function.
 */
export function findOffScaleSpacing(source: string): SpacingViolation[] {
  const violations: SpacingViolation[] = []
  const lines = source.split("\n")
  lines.forEach((text, index) => {
    const found: { index: number; className: string; reason: string }[] = []
    for (const match of text.matchAll(CLASS)) {
      const value = match[5]
      const reason = value.startsWith("[") || value.startsWith("(")
        ? `arbitrary spacing value ${value}; use a step from the scale`
        : value === "auto" || value === "reverse" || STEPS.has(value)
        ? undefined
        : `step ${value} is not on the scale (${SPACING_STEPS.join(" ")})`
      if (reason === undefined) continue
      found.push({ index: match.index ?? 0, className: match[0], reason })
    }
    for (const match of text.matchAll(ARBITRARY_PROPERTY)) {
      found.push({
        index: match.index ?? 0,
        className: match[0],
        reason: `arbitrary spacing property ${match[3]}; use a spacing utility with a step`,
      })
    }
    for (const match of text.matchAll(SPACING_FUNCTION)) {
      if (match[1] !== "px" && STEPS.has(match[1])) continue
      found.push({
        index: match.index ?? 0,
        className: match[0],
        reason: `--spacing(${match[1]}) is not a step on the scale (${NUMERIC_STEPS})`,
      })
    }
    found.sort((a, b) => a.index - b.index)
    for (const { index: at, className, reason } of found) {
      violations.push({ line: index + 1, column: at + 1, className, reason })
    }
  })
  return violations
}
