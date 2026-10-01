import { twMerge } from "tailwind-merge"

export { join } from "./join.ts"

/**
 * Join conditional class names and resolve conflicting Tailwind utilities.
 *
 * Falsy inputs are dropped. The surviving string is then passed through `twMerge`, so a later
 * utility wins over an earlier one in the same group (`cn("p-2", "p-4")` is `"p-4"`) instead of both
 * reaching the DOM and leaving the winner to CSS source order.
 *
 * `twMerge` only knows Tailwind's own utility groups — it does not know this repository's theme
 * component classes (`btn-*`, `input`, `badge-*`, …), and it is not taught them here, because that
 * list would be hand-kept and would drift from `theme/`. Do not override a theme component class
 * through `class`; pick the variant through the component's own prop instead. Two theme classes
 * passed to `cn` are both kept — `cn("btn-primary", "btn-danger")` is `"btn-primary btn-danger"` —
 * `cn` resolves conflicts between Tailwind utilities only.
 *
 * `tailwind-merge` is about 28 KB minified, and every browser bundle that imports `cn` carries it.
 * Where the inputs cannot conflict, {@link join} does the same join without it.
 *
 * @param inputs Class names. Use `condition && "class"` to include a name
 * conditionally; `false`, `null` and `undefined` are skipped.
 * @returns One space-separated class string, `""` when nothing survives.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return twMerge(inputs.filter(Boolean).join(" "))
}
