/**
 * Examples of the helpers `ui/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { formatBytes } from "@preact-components/ui"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  formatBytes: {
    title: "formatBytes()",
    summary:
      "A byte count as a short size label, in binary units, with one decimal only when it is not whole.",
    snippet: `import { formatBytes } from "@preact-components/ui"

[formatBytes(512), formatBytes(1536), formatBytes(5 * 1024 ** 2)]`,
    covers: ["formatBytes"],
    run: () => [formatBytes(512), formatBytes(1536), formatBytes(5 * 1024 ** 2)],
  },
}

/** The `ui/` helper examples, as registry cards. */
export const uiExamples = toExampleDemos(examples)
