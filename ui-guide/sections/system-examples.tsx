/**
 * Examples of the helpers `system/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { normalizeCanonical } from "@preact-components/system"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  normalizeCanonical: {
    title: "normalizeCanonical()",
    summary:
      "A canonical address in the one spelling a search engine should see: resolved, with dot segments removed.",
    snippet: `import { normalizeCanonical } from "@preact-components/system"

normalizeCanonical("https://example.com/docs/../guide?page=2")`,
    covers: ["normalizeCanonical"],
    run: () => normalizeCanonical("https://example.com/docs/../guide?page=2"),
  },
}

/** The `system/` examples, as registry cards. */
export const systemExamples = toExampleDemos(examples)
