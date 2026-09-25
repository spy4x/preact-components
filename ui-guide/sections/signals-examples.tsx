/**
 * Examples of `signals/`, which exports state helpers and renders nothing.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { parseSort, serializeSort, toggleSort } from "@preact-components/signals"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  toggleSort: {
    title: "Sort rules in the address",
    summary:
      "`parseSort` reads rules out of a URL parameter, `toggleSort` advances one column through asc, desc and off, and `serializeSort` writes the rules back.",
    snippet: `import { parseSort, serializeSort, toggleSort } from "@preact-components/signals"

const rules = parseSort("name:asc", ["name", "size"], [])
const next = toggleSort(toggleSort(rules, "name"), "size")
serializeSort(next)`,
    covers: ["toggleSort", "parseSort", "serializeSort"],
    run: () => {
      const rules = parseSort("name:asc", ["name", "size"], [])
      const next = toggleSort(toggleSort(rules, "name"), "size")
      return serializeSort(next)
    },
  },
}

/** The `signals/` examples, as registry cards. */
export const signalsExamples = toExampleDemos(examples)
