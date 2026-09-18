/**
 * The prose half of the theme work: what the design-system classes are for, and the drift guard
 * that keeps this page from documenting classes that do not exist.
 *
 * The class names below are rendered as text rather than applied to the catalogue's own markup, so
 * the guide still reads correctly in an app that never imported `preset.css`. `documentedClasses`
 * is the single list the page renders from and the one `instructions.test.ts` checks against
 * `theme/preset.css` — a class that is renamed or dropped in the theme fails the test here instead
 * of decorating a page nobody re-reads.
 */

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
  Map: ["map-marker"],
}

/**
 * Classes that were deliberately dropped from the theme, with the reason.
 *
 * Both had zero usages in `gb` and survived only because its `ui-guide` referenced them. They are
 * listed here so the catalogue states why they are gone, and so the test can prove that neither
 * this page nor the preset brought them back.
 */
export const removedClasses: Record<string, string> = {
  "h6": "use `text-base font-medium`",
  "btn-sm": "use `h-9 px-4` on the button",
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

/** One documented class, rendered as code text rather than applied. */
function ClassChip({ name }: { name: string }) {
  return (
    <code class="rounded-md border border-purple-600 px-1.5 py-0.5 font-mono text-xs text-purple-600 dark:text-purple-400">
      .{name}
    </code>
  )
}

/**
 * Design-system rules for the pages built out of `theme/`.
 *
 * Not a demo of a `ui/` component — it is the context the components are meant to be assembled in,
 * ported from `financy`'s guide.
 */
export function CatalogInstructions() {
  return (
    <section id="instructions" class="scroll-mt-8">
      <div class="mb-4 border-b border-gray-200 pb-2 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">General instructions</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          What <code>@preact-components/theme</code>{" "}
          provides, and the page conventions the components assume.
        </p>
      </div>

      <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>
          Every class below is a Tailwind 4 utility emitted by <code>preset.css</code>. Import{" "}
          <code>tokens.css</code>{" "}
          before it to get the palette these utilities read; the presets fall back to the library's
          own values if you skip it.
        </p>
        <p>
          Put <ClassChip name="theme-base" /> on <code>{"<body>"}</code>{" "}
          to opt into the document-level font, colour and canvas — nothing is applied to the host
          page by importing the preset. Use <ClassChip name="page-layout" />{" "}
          for the standard page width.
        </p>
        <p>
          The <code>ui/</code>{" "}
          primitives in this catalogue deliberately do not use these classes: they inline their own
          utilities so they render without the token layer. Reach for a component first and a class
          second.
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(documentedClasses).map(([group, names]) => (
            <div key={group}>
              <h3 class="mb-2 font-medium text-gray-900 dark:text-gray-100">{group}</h3>
              <div class="flex flex-wrap gap-1.5">
                {names.map((name) => <ClassChip key={name} name={name} />)}
              </div>
            </div>
          ))}
        </div>

        <div class="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
          <p class="font-medium">Removed, and not coming back</p>
          <ul class="mt-1 list-disc pl-5">
            {Object.entries(removedClasses).map(([name, replacement]) => (
              <li key={name}>
                <code>.{name}</code> — {replacement}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
