/**
 * Examples of the helpers `theme/` exports: its stylesheets as text, and the class names the
 * components render.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { COMPONENT_CLASSES, INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"
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
  "theme-component-classes": {
    title: "The classes the components render",
    summary:
      "`COMPONENT_CLASSES` lists every Tailwind class the published components can render, separated by spaces. An app puts it inside an `@source inline` rule, so its build emits those classes without scanning the library's files, which a Deno app keeps in its cache rather than in `node_modules`.",
    snippet: `import { COMPONENT_CLASSES } from "@spy4x/preact-theme"

const entry = \`@import "tailwindcss";
@source inline("\${COMPONENT_CLASSES}");\`

COMPONENT_CLASSES.split(" ").filter((name) => name.startsWith("lg:w-"))`,
    covers: ["COMPONENT_CLASSES"],
    run: () => COMPONENT_CLASSES.split(" ").filter((name) => name.startsWith("lg:w-")),
  },
}

/** The `theme/` examples, as registry cards. */
export const themeExamples = toExampleDemos(examples)
