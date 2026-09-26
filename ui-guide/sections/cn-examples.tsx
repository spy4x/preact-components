/**
 * The examples of `cn()`, the one export of `cn/`.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { cn } from "@spy4x/preact-cn"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  cn: {
    title: "cn()",
    wide: true,
    summary:
      "Joins class names, drops the falsy ones, and lets a later Tailwind utility win over a conflicting earlier one.",
    snippet: `import { cn } from "@spy4x/preact-cn"

cn("px-2 py-1 text-sm", false, "px-4")`,
    covers: ["cn"],
    run: () => cn("px-2 py-1 text-sm", false, "px-4"),
  },
  cnCallerClass: {
    title: "A caller's class over a component's",
    wide: true,
    summary:
      "A component passes its own classes first and the caller's `class` last, so the caller's colour and padding replace the defaults.",
    snippet: `import { cn } from "@spy4x/preact-cn"

function Chip({ class: className }: { class?: string }) {
  return <span class={cn("rounded-full bg-gray-100 px-2 text-xs", className)} />
}

<Chip class="bg-purple-100 px-3" />`,
    covers: ["cn"],
    run: () => cn("rounded-full bg-gray-100 px-2 text-xs", "bg-purple-100 px-3"),
  },
}

/** The `cn/` examples, as registry cards. */
export const cnExamples = toExampleDemos(examples)
