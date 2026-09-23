# @preact-components/theme

The design-system CSS every component in this repo styles against: design tokens,
a Tailwind 4 preset, and the class names components render.

Tailwind 4, CSS-first — no `tailwind.config.ts` is shipped or required.

## Install

`tokens.css` and `preset.css` ship inside the published package as plain files, not as
`deno.json` `exports` entries — JSR refuses a CSS file as an export ("Expected a JavaScript or
TypeScript module, but identified a Css module"), so `@preact-components/theme/tokens.css` is not
an importable specifier, from JSR or from the npm package JSR publishes alongside it. Getting the
two files in front of Tailwind is therefore the app's build step's job, not a plain `@import` line,
and there are two ways to do it depending on what that build step already has.

**A build script that runs in Deno or Node** resolves the files through this package's one export,
`+index.ts`, which hands back their real location — in the JSR cache, in `node_modules`, wherever
the installer put them — as `file:` URLs:

```ts
// build.ts — same shape as this repository's own pages/build.ts
import { PRESET_CSS_URL, TOKENS_CSS_URL } from "@preact-components/theme"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"

const entry = `
  @import "tailwindcss";
  @import "${TOKENS_CSS_URL}";
  @import "${PRESET_CSS_URL}";
`

const compiler = await compile(entry, {
  // Tailwind hands every `@import` id to this loader; an absolute URL (the two above) is read
  // as-is, a relative one resolves against `base` the way a browser would.
  async loadStylesheet(id, base) {
    const url = /^[a-z]+:/.test(id) ? new URL(id) : new URL(id, base)
    return {
      path: fileURLToPath(url),
      base: fileURLToPath(url),
      content: await Deno.readTextFile(url),
    }
  },
})
```

**A bundler that already materialises `node_modules`** (Vite, esbuild, the Tailwind CLI, an npm
install of the JSR-published package) can `@import` the files by a relative path instead, because
that is plain filesystem resolution and does not go through `exports` at all — see "If the app's
bundler cannot resolve a package `@import`" below for the exact line.

Whichever way the two files reach the compiler, feed them to Tailwind in this order:

```css
@import "tailwindcss";
@import "<tokens.css, resolved one of the two ways above>";
@import "<preset.css, resolved one of the two ways above>";
```

Then tell Tailwind where the library's components live, so the classes they use
are emitted:

```css
@source "../node_modules/@preact-components";
```

`@tailwindcss/forms` is optional: the preset's own form rules render without it,
so nothing in this package loads it, imports it or pins it. An app that wants
its glyphs adds the plugin itself (`npm:@tailwindcss/forms`, pinned to whatever
version that app chooses) and loads it with `@plugin`, not `@import` — it is a
JavaScript plugin, `main: src/index.js`, no style entry — **last**, after
`preset.css`. Both then end up in the same `@layer base`, so there is one
cascade layer and **source order decides inside it**: forms' own selectors —
`[type="text"]`, `select`, `textarea`, at (0,1,0) — are imported later and
therefore beat any of the preset's form rules that are wrapped in `:where()`,
whose gate contributes no specificity at all. Do not move forms above the preset.
That reasoning comes from the layer layout of the compiled sheet rather than from
a measured build: forms is not loaded by this repo's demo, so nothing here
exercises it end to end.

For dark mode, put `dark` on `<html>`. The preset defines the `dark` variant as
`&:where(.dark, .dark *)`, so no `@custom-variant` is needed in the app.

Also put `theme-base` on `<body>`, and note that this is the only thing that
decides whether the preset's host-level rules apply at all: they do nothing until
`.theme-base` is present. With it, adding `.dark` paints form controls, the
OS-rendered `option` list and the table shell; without it, the preset leaves that
markup exactly as the app left it, no matter where `.dark` sits. That is the
guarantee this gate buys — scope, not appearance — and it is why the example above
is written the way it is. The two are wrapped differently, deliberately: the dark
chrome is `:where(.dark) :where(.theme-base) …`, while the document rules are a
plain `.theme-base { … }` — that block sets the light palette too, so it cannot be
scoped to `.dark`.

Which element carries which class is **not** interchangeable. The dark chrome
needs `.dark` on an **ancestor** — the outer element, `<html>` — and
`.theme-base` on a **descendant** of it, `<body>`. Put both classes on one
element, or put them the other way round, and the descendant part of the selector
has nothing to match.

When the package is installed into a real `node_modules` tree (an npm/pnpm/yarn install of the
JSR-published package, or `deno install --node-modules-dir`), a bundler can also reach the files by
relative path directly — this is plain filesystem resolution, so it works with no `exports` entry:

```css
@import "../node_modules/@preact-components/theme/tokens.css";
@import "../node_modules/@preact-components/theme/preset.css";
```

or, vendored into the app's own tree rather than installed:

```css
@import "../libs/preact-components/theme/tokens.css";
@import "../libs/preact-components/theme/preset.css";
```

## What it ships

| File         | Contents                                                                   |
| ------------ | -------------------------------------------------------------------------- |
| `tokens.css` | every design token as a custom property: light in `:root`, dark in `.dark` |
| `preset.css` | base type, colour atoms, buttons, forms, surfaces, data display, map atoms |

### Classes

- **Colour atoms** — `text-primary`, `bg-primary`, `border-primary`,
  `rounded-primary`, `text-muted`, `bg-canvas`, `bg-surface`, `border-subtle`,
  `border-control`, `bg-danger`, `bg-warning`, `bg-success` and the `text-*`
  status tones.
- **Type** — `h1`–`h5`, `link`, `page-layout`, `list-ul`, plus `theme-base` for
  the document-level font, colour and canvas. Nothing is applied to the host
  page by importing the preset; `theme-base` is put on `<body>` when wanted, and
  every rule that would otherwise restyle the host is gated behind it — the
  document rules above and the `.dark` form, table and `option` chrome in the
  next bullet.
- **Buttons** — `btn` with `btn-primary`, `btn-danger`, `btn-warning`,
  `btn-success` and their `-outline` variants; `btn-icon`, `btn-link`,
  `btn-input-icon`, `btn-disabled`. `btn` carries its own `:disabled` styling.
- **Forms** — `input`, `select`, `textarea`, `label`, `checkbox`, `radio`. In
  dark mode the OS-rendered `option` list, the popup chrome and the table
  (`table`, `th`, `td` borders) are repainted by `:where(.dark)
  :where(.theme-base) …` rules, so they apply only inside `theme-base`, and only
  while `.dark` is on an ancestor. Components that already carry `.input` /
  `.select` / `.textarea` are painted by those utilities; these rules are what
  covers the parts a class cannot reach.
- **Surfaces** — `card`, `card-header`, `card-body`, `card-footer`, `scrollbar`.
- **Data display** — `num`, `kpi`, `kpi-label`, `kpi-value`, `bar`.
- **Map** — `map-marker` inside a `status-on` / `status-off` / `status-unknown`
  or `power-anomaly` container (`.power-anomaly .map-marker` blinks).

## Theming

Every colour, radius and font in `preset.css` is read as
`var(--token, <default>)`, so an app restyles the library by setting custom
properties. No CSS fork, no `!important`:

```css
@import "tailwindcss";
@import "<tokens.css, resolved as under Install>";
@import "<preset.css, resolved as under Install>";

/* After tokens.css, so this wins the cascade. */
:root {
  --color-primary: oklch(0.55 0.18 255);
  --radius-primary: 0.25rem;
}
```

`--color-primary` is purple (`purple-900`) because that is what the components
were designed against in `gb` and `financy`; dark mode swaps it for near-black
chrome. The full list is in `tokens.css`, each with the Tailwind palette value it
came from.

Two consequences of the design worth knowing:

- **Tokens are runtime custom properties, not a Tailwind `@theme` block.**
  Tailwind resolves `@theme` at build time, so a variable declared in both an
  app's `@theme` and the library's would fold into whichever declaration the
  compiler saw last — the app could not reliably win. `var()` is resolved by CSS
  at runtime, so the cascade decides. Set the tokens in `:root`, or inline on any
  element, and they win.
- **`tokens.css` is optional.** The defaults are inlined as the `var()`
  fallbacks, so an app that imports only `preset.css` still renders in the
  library palette. Import `tokens.css` to get the palette, to use
  `var(--color-primary)` in the app's own CSS, and to have one place to restyle.

## Not carried over from the sources

Both classes had zero usages in `gb`, the product they were extracted from —
only its `ui-guide` referenced them, which is how they survived:

- `.h6` — use `text-base font-medium`.
- `.btn-sm` — use `h-9 px-4` on the button.

`card-header` and `btn-disabled` were added back from `financy`, where both are
in use (`btn-disabled` replaces that repo's `fieldset[disabled] .btn`).

## Tests

The workspace `test` task runs this suite with the rest of the repo:

```bash
deno task check          # from the repository root, what CI runs
deno task --cwd theme test   # this package alone
```

`integration/` compiles the shipped CSS with the real Tailwind 4 compiler and
asserts the output: every class is emitted with declarations, atoms read tokens,
the dark variant is class-scoped, an app's token override is still reachable
after the preset, and the preset still works when `tokens.css` is skipped. The
Deno-side `@import` reader the compile needs is covered there too.

That compile reads `HOME`, the preset and the Deno npm cache, so the root `test`
task grants `--allow-read --allow-env`. Those are repo-wide only because
`deno test` discovers every member's suite in one process; nothing in the
workspace needs `net`, `run` or `write` to test.
