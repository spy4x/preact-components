/**
 * The example of `cn()`, the one export of `cn/`.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { cn } from "@spy4x/preact-cn"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  cn: {
    title: "cn()",
    summary:
      "Joins class names, drops falsy ones, and lets a later Tailwind utility win over a conflicting earlier one.",
    snippet: `import { cn } from "@spy4x/preact-cn"

cn("px-2 py-1 text-sm", false, "px-4")`,
    covers: ["cn"],
    run: () => cn("px-2 py-1 text-sm", false, "px-4"),
  },
}

/** The `cn/` examples, as registry cards. */
export const cnExamples = toExampleDemos(examples)
