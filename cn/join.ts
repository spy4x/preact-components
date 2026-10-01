/**
 * Join conditional class names, with no Tailwind conflict resolution.
 *
 * Falsy inputs are dropped and the rest are joined with one space, in order. Nothing is merged:
 * `join("p-2", "p-4")` is `"p-2 p-4"`. That is what keeps it small — `cn` resolves conflicts
 * through `tailwind-merge`, about 28 KB minified, and every browser bundle that imports `cn` carries
 * it. The library's own components compose their classes with `join`, so an island that renders
 * them does not.
 *
 * Use `join` where the inputs cannot conflict, and `cn` where a later utility has to replace an
 * earlier one of the same group.
 *
 * @param inputs Class names. Use `condition && "class"` to include a name
 * conditionally; `false`, `null` and `undefined` are skipped.
 * @returns One space-separated class string, `""` when nothing survives.
 */
export function join(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ")
}
