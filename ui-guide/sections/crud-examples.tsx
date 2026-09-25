/**
 * Examples of the helpers `crud/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { timeAgo } from "@preact-components/crud"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  timeAgo: {
    title: "timeAgo()",
    summary:
      "How long ago a timestamp was, in words; `now` is a parameter, so a render never depends on the clock.",
    snippet: `import { timeAgo } from "@preact-components/crud"

timeAgo("2026-01-01T10:00:00Z", new Date("2026-01-01T12:30:00Z"))`,
    covers: ["timeAgo"],
    run: () => timeAgo("2026-01-01T10:00:00Z", new Date("2026-01-01T12:30:00Z")),
  },
}

/** The `crud/` examples, as registry cards. */
export const crudExamples = toExampleDemos(examples)
