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
      "The three stylesheets as strings, for a build that cannot import a CSS file from the registry.",
    wide: false,
    snippet: `import { INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"

[TOKENS_CSS, PRESET_CSS, INK_CSS].map((css) => css.length > 0)`,
    covers: ["TOKENS_CSS", "PRESET_CSS", "INK_CSS"],
    run: () => [TOKENS_CSS, PRESET_CSS, INK_CSS].map((css) => css.length > 0),
  },
  "theme-component-classes": {
    title: "The classes the components render",
    summary:
      "Every class the components can render, for an `@source inline` rule so an app's Tailwind build emits them without scanning the library.",
    wide: false,
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
      "The steps a padding, margin or gap class may use, and the named gaps the layout components take.",
    wide: false,
    snippet: `import { SPACING_GAPS, SPACING_STEPS } from "@spy4x/preact-theme/spacing"

[SPACING_STEPS.join(" "), SPACING_GAPS.md]`,
    covers: ["SPACING_STEPS", "SPACING_GAPS"],
    run: () => [SPACING_STEPS.join(" "), SPACING_GAPS.md],
  },
  "theme-find-off-scale-spacing": {
    title: "Checking a file against the scale",
    summary:
      "Finds every spacing class in a file's text that is off the scale, so an app can check its own sources from a test.",
    wide: false,
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
