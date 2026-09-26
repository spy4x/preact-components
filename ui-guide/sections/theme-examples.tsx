// spacing: off-scale until #328 (the lane that moves this file to the scale deletes this line)
/**
 * Examples of the helpers `theme/` exports: its stylesheets as text, the class names the
 * components render, and the spacing scale with its checker.
 *
 * Each card runs the real export when it renders; see `example.tsx`.
 */

import { COMPONENT_CLASSES, INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"
import { findOffScaleSpacing, SPACING_GAPS, SPACING_STEPS } from "@spy4x/preact-theme/spacing"
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
  "theme-spacing-steps": {
    title: "The spacing scale",
    summary:
      "`SPACING_STEPS` is every step a padding, margin or gap class may use: 0, 1 px, then 4, 8, 12, 16, 24, 32, 48 and 64 px. `SPACING_GAPS` maps the named gaps the layout components take to their steps.",
    snippet: `import { SPACING_GAPS, SPACING_STEPS } from "@spy4x/preact-theme/spacing"

[SPACING_STEPS.join(" "), SPACING_GAPS.md]`,
    covers: ["SPACING_STEPS", "SPACING_GAPS"],
    run: () => [SPACING_STEPS.join(" "), SPACING_GAPS.md],
  },
  "theme-find-off-scale-spacing": {
    title: "Checking a file against the scale",
    summary:
      "`findOffScaleSpacing` reads a file's text and returns every spacing class off the scale or with an arbitrary value, every arbitrary property that sets spacing and every off-scale `--spacing()` call, with its line, column and reason. It uses no Deno API, so an app runs it from its own test over its own sources.",
    snippet: `import { findOffScaleSpacing } from "@spy4x/preact-theme/spacing"

// Built from two parts, so Tailwind's scanner does not read this sample as a class to emit.
const offScale = "sm:mt-" + 7
findOffScaleSpacing(\`<div class="p-4 \${offScale} h-12">\`)
  .map((found) => \`\${found.line}:\${found.column} \${found.className}\`)`,
    covers: ["findOffScaleSpacing"],
    run: () => {
      const offScale = "sm:mt-" + 7
      return findOffScaleSpacing(`<div class="p-4 ${offScale} h-12">`)
        .map((found) => `${found.line}:${found.column} ${found.className}`)
    },
  },
}

/** The `theme/` examples, as registry cards. */
export const themeExamples = toExampleDemos(examples)
