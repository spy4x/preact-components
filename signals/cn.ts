import { twMerge } from "tailwind-merge"

/**
 * Join conditional class names and resolve conflicting Tailwind utilities.
 *
 * Falsy inputs are dropped. The surviving string is then passed through `twMerge`, so a later
 * utility wins over an earlier one in the same group (`cn("p-2", "p-4")` is `"p-4"`) instead of both
 * reaching the DOM and leaving the winner to CSS source order.
 *
 * @param inputs Class names. Use `condition && "class"` to include a name
 * conditionally; `false`, `null` and `undefined` are skipped.
 * @returns One space-separated class string, `""` when nothing survives.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return twMerge(inputs.filter(Boolean).join(" "))
}
