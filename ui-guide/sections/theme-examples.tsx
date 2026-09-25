/**
 * Examples of the helpers `theme/` exports: its stylesheets as text.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

const examples: ExampleFragment = {
  "theme-css-text": {
    title: "The stylesheets as text",
    summary:
      "`TOKENS_CSS`, `PRESET_CSS` and `INK_CSS` carry the three stylesheets as strings, for a build that cannot import a CSS file from the registry.",
    snippet: `import { INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"

[TOKENS_CSS, PRESET_CSS, INK_CSS].map((css) => css.length > 0)`,
    covers: ["TOKENS_CSS", "PRESET_CSS", "INK_CSS"],
    run: () => [TOKENS_CSS, PRESET_CSS, INK_CSS].map((css) => css.length > 0),
  },
}

/** The `theme/` examples, as registry cards. */
export const themeExamples = toExampleDemos(examples)
