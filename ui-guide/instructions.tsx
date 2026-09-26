/**
 * The prose half of the theme work: what the design-system classes are for, and the test that
 * keeps this page from documenting classes that do not exist.
 *
 * The class names below are rendered as text rather than applied to the catalogue's own markup, so
 * the guide still reads correctly in an app that never imported `preset.css`. `documentedClasses`
 * is the single list the page renders from and the one `instructions.test.ts` checks against
 * `theme/preset.css` — a class that is renamed or dropped in the theme fails the test here instead
 * of decorating a page nobody re-reads.
 *
 * `instructions.test.ts` covers one direction: *documented* implies *defined*. The other direction —
 * a class `preset.css` defines that nothing demonstrates — is `classes.test.tsx`'s, and it is the
 * one that let `.btn-sm` and `.h6` outlive their last real caller. See {@link UNDEMONSTRATED_CLASSES}
 * and {@link demonstratedClasses}.
 */

import { Cluster, Grid, Section, Stack } from "@spy4x/preact-ui/layout"
import { InlineMarkdown } from "./markdown.tsx"

/** Classes documented by {@link CatalogInstructions}, grouped by what they are for. */
export const documentedClasses: Record<string, string[]> = {
  "Colour atoms": [
    "text-primary",
    "bg-primary",
    "border-primary",
    "rounded-primary",
    "text-muted",
    "bg-canvas",
    "bg-surface",
    "border-subtle",
    "border-control",
    "bg-danger",
    "bg-warning",
    "bg-success",
    "text-danger",
    "text-warning",
    "text-success",
  ],
  Type: ["h1", "h2", "h3", "h4", "h5", "link", "page-layout", "list-ul", "theme-base"],
  Buttons: [
    "btn",
    "btn-primary",
    "btn-primary-outline",
    "btn-danger",
    "btn-danger-outline",
    "btn-warning",
    "btn-warning-outline",
    "btn-success",
    "btn-success-outline",
    "btn-icon",
    "btn-link",
    "btn-input-icon",
    "btn-disabled",
  ],
  Forms: ["input", "select", "textarea", "label", "checkbox", "radio"],
  Surfaces: ["card", "card-header", "card-body", "card-footer", "scrollbar"],
  "Data display": ["num", "kpi", "kpi-label", "kpi-value", "bar"],
  Map: ["map-marker", "status-on", "status-off", "status-unknown"],
  Spacing: ["pb-safe", "pb-safe-3"],
}

/**
 * Classes that were deliberately dropped from the theme, with the reason.
 *
 * Both had zero usages in the source application and survived only because its `ui-guide` referenced them. They are
 * listed here so the catalogue states why they are gone, and so the test can prove that neither
 * this page nor the preset brought them back.
 */
export const removedClasses: Record<string, string> = {
  "h6": "use `text-base font-medium`",
  "btn-sm": "use `h-9 px-4` on the button",
  "power-anomaly":
    "application-specific wording, not part of this library — colour a marker with `status-on` / `status-off` / `status-unknown` instead",
}

/**
 * Class names `preset.css` actually defines.
 *
 * Comments are stripped first: the preset documents the removal of `.h6` and `.btn-sm` in prose, and
 * a substring search would count that mention as a definition. Two forms then count as a
 * definition — a Tailwind `@utility name` block, and a plain `.name` in a selector.
 *
 * @param css Contents of `preset.css`.
 * @returns Every class name the preset defines.
 */
export function definedClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const names = new Set<string>()
  for (const match of withoutComments.matchAll(/@utility\s+([\w-]+)/g)) {
    names.add(match[1])
  }
  for (const match of withoutComments.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    names.add(match[1])
  }
  return names
}

/**
 * Why most of the button family has no demo: the component is the API, the class form is `crud/`'s.
 *
 * Kept as one string because the entries that share one decision — see `README.md`, "Class-name
 * demos".
 *
 * `btn`, `btn-primary` and `btn-link` are deliberately **not** in this record: `crud/CrudEditor`
 * applies them to its own Save, Cancel and archive controls, so the `crud` section's card for it
 * demonstrates them by rendering the real component. `classes.test.tsx` measures the demonstrated
 * set from rendered markup, so leaving them here would be the stale-exclusion failure it also
 * checks. A class leaves this list the moment something in the guide really applies it.
 */
const BUTTON_CLASSES_REASON =
  'Demonstrated through `ui/Button` (`variant` × `size`), which inlines its own utilities, and consumed in class form by `crud/`. A `.btn-danger` card next to `<Button variant="danger">` would document two APIs for one control.'

/**
 * The Map card's classes: `map/` applies them to its pins and its list of places, and the guide
 * loads `map/` only when the map page opens (`sections/map-leaflet.tsx`, #315), so the server-rendered
 * catalogue `classes.test.tsx` measures holds the card's placeholder instead. `pages/checks/map.ts`
 * sees them in the browser.
 */
const MAP_CLASSES_REASON =
  "Applied by `map/Map` to its pins and its list of places. The guide loads `map/` only when the map page opens, so the server-rendered catalogue shows a placeholder in its place; the map page shows them in the browser."

/**
 * Classes `preset.css` defines that the catalogue deliberately does not apply, with the reason.
 *
 * The exclusion half of the class guard: `classes.test.tsx` fails when a class is neither
 * demonstrated by the rendered guide nor named here with a reason, so the two ways out of a gap are
 * to demonstrate the class or to write down why nobody should. A class only named here is still
 * visible in review and in the test's own record — which is the property the source guides lacked:
 * they kept both classes alive by documenting them while nothing used them.
 *
 * Every entry is checked against reality in both directions, so this record cannot rot: an entry the
 * preset no longer defines, and an entry the guide demonstrates after all, both fail.
 */
export const UNDEMONSTRATED_CLASSES: Record<string, string> = {
  "theme-base":
    "Document-level rules for `<body>`. The catalogue renders inside a host page that applies it (`pages/src/document.tsx`), so a demo of it would repaint the page around the demo.",
  "dark":
    "A variant marker on `<html>`, not a class an element wears. The host page's colour-scheme toggle owns it and `pages/checks/theme.ts` drives it.",
  "btn-primary-outline": BUTTON_CLASSES_REASON,
  "btn-danger": BUTTON_CLASSES_REASON,
  "btn-danger-outline": BUTTON_CLASSES_REASON,
  "btn-warning": BUTTON_CLASSES_REASON,
  "btn-warning-outline": BUTTON_CLASSES_REASON,
  "btn-success": BUTTON_CLASSES_REASON,
  "btn-success-outline": BUTTON_CLASSES_REASON,
  "btn-icon": BUTTON_CLASSES_REASON,
  "btn-disabled": BUTTON_CLASSES_REASON,
  "map-marker": MAP_CLASSES_REASON,
  "status-on": MAP_CLASSES_REASON,
  "status-off": MAP_CLASSES_REASON,
  "status-unknown": MAP_CLASSES_REASON,
}

/**
 * Class names a rendered catalogue applies, read out of its `class` attributes.
 *
 * The measured half of the class guard, and deliberately not a hand-kept list: the failure mode
 * being guarded against — `.btn-sm` and `.h6` outliving their last caller — is exactly what a
 * hand-kept "demonstrated" list does when it is not maintained. This reads what the page really
 * renders, so removing a class from a demo removes it from the set.
 *
 * Snippet text is inert: `preact-render-to-string` escapes `"` inside a `<pre><code>` block, so a
 * `class="…"` inside a usage snippet is text, not an attribute, and cannot be counted as a
 * demonstration. `classes.test.tsx` pins that down.
 *
 * @param html Rendered catalogue markup, e.g. `render(<UIGuide />)`.
 * @returns Every class token the markup applies.
 */
export function demonstratedClasses(html: string): Set<string> {
  const names = new Set<string>()
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    for (const name of match[1].split(/\s+/)) {
      if (name) names.add(name)
    }
  }
  return names
}

/** One documented class, rendered as code text rather than applied. */
function ClassChip({ name }: { name: string }) {
  return (
    <code class="rounded-md bg-purple-50 px-1 font-mono text-xs text-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
      .{name}
    </code>
  )
}

/**
 * Design-system rules for the pages built out of `theme/`.
 *
 * Not a demo of a `ui/` component — it is the context the components are meant to be assembled in,
 * ported from a source application's guide. It sits on the overview as one card: the rules as
 * prose, then every documented class by group, then the classes that were removed.
 */
export function CatalogInstructions() {
  return (
    <Section
      as="section"
      id="instructions"
      class="scroll-mt-16"
      title="Design rules"
      headingLevel={2}
      description={
        <>
          What <code class="font-mono">@spy4x/preact-theme</code>{" "}
          provides, and the page conventions the components assume.
        </>
      }
    >
      <div class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-xs sm:p-6 dark:border-gray-700/80 dark:bg-gray-800/60 dark:text-gray-300">
        <Stack gap="lg">
          <Stack gap="sm" class="max-w-prose">
            <p>
              Every class below is a Tailwind 4 utility emitted by{" "}
              <InlineMarkdown text="`preset.css`. Import `tokens.css`" />{" "}
              before it to get the palette these utilities read; the presets fall back to the
              library's own values if you skip it.
            </p>
            <p>
              Put <ClassChip name="theme-base" /> on <InlineMarkdown text="`<body>`" />{" "}
              to opt into the document-level font, colour and canvas — nothing is applied to the
              host page by importing the preset. Lay a page out with{" "}
              <InlineMarkdown text="`Page`, `Section`, `Stack` and `Grid` from `@spy4x/preact-ui/layout`" />;
              {" "}
              <ClassChip name="page-layout" />{" "}
              still gives the standard page width, and is deprecated in their favour.
            </p>
            <p>
              The <InlineMarkdown text="`ui/`" />{" "}
              primitives in this catalogue deliberately do not use these classes: they inline their
              own utilities so they render without the token layer. Reach for a component first and
              a class second.
            </p>
          </Stack>

          <Grid minColumnWidth="md">
            {Object.entries(documentedClasses).map(([group, names]) => (
              <Stack key={group} gap="sm">
                <h3 class="font-medium text-gray-900 dark:text-gray-100">{group}</h3>
                <Cluster gap="xs">
                  {names.map((name) => <ClassChip key={name} name={name} />)}
                </Cluster>
              </Stack>
            ))}
          </Grid>

          <Stack
            gap="xs"
            class="border-t border-gray-200 pt-4 dark:border-gray-700/80"
          >
            <p class="font-medium text-gray-900 dark:text-gray-100">Removed, and not coming back</p>
            <ul class="list-disc pl-6">
              {Object.entries(removedClasses).map(([name, replacement]) => (
                <li key={name}>
                  <ClassChip name={name} /> — <InlineMarkdown text={replacement} />
                </li>
              ))}
            </ul>
          </Stack>
        </Stack>
      </div>
    </Section>
  )
}
