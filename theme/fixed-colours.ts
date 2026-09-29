/**
 * Finds the fixed Tailwind colour classes a component must not use (#417): a step of the gray,
 * slate, zinc, neutral or stone palette, and `white` or `black`. They ignore the theme tokens, so
 * an app that repaints the tokens is left with cool grey patches. `README.md` → "Replacing fixed
 * colours" says which token replaces each.
 */

/** A fixed colour class found in a source text. */
export interface FixedColour {
  /** 1-based line. */
  line: number
  /** The class as written, with its variants: `dark:hover:bg-gray-700`. */
  className: string
}

const UTILITIES = [
  "bg",
  "text",
  "border",
  "border-[trblxyse]",
  "ring",
  "ring-offset",
  "divide",
  "outline",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "placeholder",
  "decoration",
  "accent",
  "caret",
  "shadow",
  "inset-ring",
].join("|")

/** `text-gray-500`, `dark:bg-white/10`, `hover:border-slate-200`; not `bg-gray` or `text-whitespace`. */
const FIXED = new RegExp(
  `(?<![\\w-])(?:[a-z0-9\\-\\[\\]&>*_]+:)*(?:${UTILITIES})-(?:(?:gray|slate|zinc|neutral|stone)-\\d{2,3}|white|black)(?:/\\d+)?(?![\\w-])`,
  "g",
)

/** Every fixed colour class in `text`, in order. */
export function findFixedColours(text: string): FixedColour[] {
  const found: FixedColour[] = []
  text.split("\n").forEach((source, index) => {
    for (const match of source.matchAll(FIXED)) {
      found.push({ line: index + 1, className: match[0] })
    }
  })
  return found
}
