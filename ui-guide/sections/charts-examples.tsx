/**
 * Examples of the helpers `charts/` exports beside its charts.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { extent } from "@preact-components/charts"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  extent: {
    title: "extent()",
    summary:
      "The smallest and largest finite value of a series, or `null` when it has none: the domain a scale starts from.",
    snippet: `import { extent } from "@preact-components/charts"

[extent([3, 9, 1, Number.NaN]), extent([])]`,
    covers: ["extent"],
    run: () => [extent([3, 9, 1, Number.NaN]), extent([])],
  },
}

/** The `charts/` examples, as registry cards. */
export const chartsExamples = toExampleDemos(examples)
