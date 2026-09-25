# @spy4x/preact-theme

The design-system CSS every component in this repo styles against: design tokens,
a Tailwind 4 preset, and the class names components render.

Tailwind 4, CSS-first — no `tailwind.config.ts` is shipped or required.

## Install

`tokens.css` and `preset.css` ship inside the published package as plain files, not as
`deno.json` `exports` entries — JSR refuses a CSS file as an export ("Expected a JavaScript or
TypeScript module, but identified a Css module"), so `@spy4x/preact-theme/tokens.css` is not
an importable specifier, from JSR or from the npm package JSR publishes alongside it. A `file:`
path does not exist either once the package comes from the registry: a module JSR serves resolves
its own `import.meta.url` to the registry's `https:` address, not to a location on disk, so there
is nothing on the installing machine to point a bundler's `@import` at.

What the package exports instead is each file's **text**, as `TOKENS_CSS` and `PRESET_CSS` string
constants — the two required files; `INK_CSS`, a third and optional one, is "Theming" → "Ink"
below. A build script — Deno or Node, the entry point every bundler already calls —
hands that text to Tailwind's own compiler through `loadStylesheet`, the same hook
[this repository's own `pages/build.ts`](../pages/build.ts) uses to resolve `@import "tailwindcss"`
itself:

```ts
// build.ts
import { PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"

// The two ids below name no real file — they are matched here and answered from the text this
// package exports. Anything else (`tailwindcss` itself) is a real npm package, resolved through
// the workspace/import map the way `pages/build.ts` resolves it.
const THEME_STYLESHEETS: Record<string, string> = {
  "@spy4x/preact-theme/tokens.css": TOKENS_CSS,
  "@spy4x/preact-theme/preset.css": PRESET_CSS,
}

const entry = `
  @import "tailwindcss";
  @import "@spy4x/preact-theme/tokens.css";
  @import "@spy4x/preact-theme/preset.css";
`

const compiler = await compile(entry, {
  async loadStylesheet(id, base) {
    const theme = THEME_STYLESHEETS[id]
    if (theme !== undefined) return { path: id, base: id, content: theme }

    const resolved = new URL(import.meta.resolve(id))
    const url = resolved.pathname.endsWith(".css")
      ? resolved
      : new URL(import.meta.resolve(`${id}/index.css`))
    return {
      path: fileURLToPath(url),
      base: fileURLToPath(url),
      content: await Deno.readTextFile(url),
    }
  },
})
```

This is the whole recipe — no `node_modules`, no network access and no read permission beyond
what resolving `tailwindcss` itself already needs. It has been run against this package served
from a local JSR-compatible registry, under its earlier name `@preact-components/theme` (the
package is now `jsr:@spy4x/preact-theme`): the compiled output contained both `.btn` and
`--color-primary`. That was a one-off run by hand; no check repeats it.
`compiler.build([...candidates])` (Tailwind's own scanner output, as `pages/build.ts` drives it) is
the compiled stylesheet with the design system in it.

An app that keeps its own vendored copy of `tokens.css`/`preset.css` — not installed, checked into
its own tree — can still `@import` those files by a relative path instead; that is plain
filesystem resolution and never goes through this package's `exports` at all. The exact line is
further down, past the cascade-layer notes below.

Then tell Tailwind where the library's components live, so the classes they use
are emitted:

```css
@source "../node_modules/@spy4x";
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

Vendored into the app's own tree rather than installed — a copy of `tokens.css`/`preset.css`
checked into the app's own repository — a bundler reaches them by an ordinary relative `@import`,
which is plain filesystem resolution and never goes through this package's `exports`:

```css
@import "../libs/preact-components/theme/tokens.css";
@import "../libs/preact-components/theme/preset.css";
```

`deno install --node-modules-dir` does **not** give a Deno app this same shortcut: it materialises
`node_modules` for this package's npm dependencies, not for `@spy4x/preact-theme` itself, so
there is no `node_modules/@spy4x/preact-theme/tokens.css` to import that way. Use the recipe
under "Install" instead.

## What it ships

| File         | Contents                                                                   |
| ------------ | -------------------------------------------------------------------------- |
| `tokens.css` | every design token as a custom property: light in `:root`, dark in `.dark` |
| `preset.css` | base type, colour atoms, buttons, forms, surfaces, data display, map atoms |
| `ink.css`    | additional, opt-in dark palette (#257): `.dark[data-theme="ink"]`          |

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
- **Map** — `map-marker` inside a `status-on` / `status-off` / `status-unknown` container, used by
  `@spy4x/preact-map`'s `Map` component and its plain-text list of markers.

## Theming

Every colour, radius and font in `preset.css` is read as
`var(--token, <default>)`, so an app restyles the library by setting custom
properties. No CSS fork, no `!important`:

```css
@import "tailwindcss";
@import "@spy4x/preact-theme/tokens.css";
@import "@spy4x/preact-theme/preset.css";

/* After tokens.css, so this wins the cascade. */
:root {
  --color-primary: oklch(0.55 0.18 255);
  --radius-primary: 0.25rem;
}
```

(The two `@spy4x/preact-theme` ids are not real specifiers — see "Install" above for what
actually resolves them: the entry string a build script hands to `compile()`, matched by
`loadStylesheet` and answered from `TOKENS_CSS`/`PRESET_CSS`.)

`--color-primary` is purple (`purple-900`) because that is what the components
were designed against in the source applications they were extracted from; dark
mode swaps it for near-black chrome. The full list is in `tokens.css`, each with
the Tailwind palette value it came from.

Focus rings follow the accent. A focused `.input`, `.select` or `.textarea` draws its outline in
`--color-primary-muted`, and so does a focused `.btn` under `.dark`; in the light palette a `.btn`
keeps the browser's own ring. To give focus rings a colour of their own, set `--color-focus-ring`:
every one of those rules reads it first. The tone buttons (`.btn-danger`, `.btn-warning`,
`.btn-success` and their `-outline` forms) draw their own tone's ring and read neither token.

### Fonts

`tokens.css` declares `--font-sans`; it does not declare `--font-serif` or `--font-mono`. Both
exist already — Tailwind 4 defines all three as part of its own default theme, so `font-serif` and
`font-mono` utilities and a bare `<code>` element already resolve to a system stack with no
declaration from this package. Redeclaring either in `:root` here would win the cascade over an
app's own `@theme --font-mono`, the same problem the header comment in `tokens.css` explains for
colour tokens — an app could not override it. #257 asked for the two tokens to exist for a
proof-first site's use of monospace and serif text, not for this package to own their default
value, so this package leaves both at Tailwind's own default and only names `--font-sans` as its
one opinionated addition.

### Ink

`INK_CSS` is a second, additional palette (#257) — dark-only, opt-in, and it changes nothing about
the default Eirene palette above. Importing it is the one extra line past the "Install" recipe:

```ts
// build.ts
import { INK_CSS, PRESET_CSS, TOKENS_CSS } from "@spy4x/preact-theme"

const THEME_STYLESHEETS: Record<string, string> = {
  "@spy4x/preact-theme/tokens.css": TOKENS_CSS,
  "@spy4x/preact-theme/ink.css": INK_CSS,
  "@spy4x/preact-theme/preset.css": PRESET_CSS,
}

const entry = `
  @import "tailwindcss";
  @import "@spy4x/preact-theme/tokens.css";
  @import "@spy4x/preact-theme/ink.css";
  @import "@spy4x/preact-theme/preset.css";
`
```

`ink.css`'s position among the three imports does not matter: `.dark[data-theme="ink"]` is more
specific than `:root` and `.dark`, so its declarations win wherever both match. It repaints the
same custom properties `tokens.css` declares, so `preset.css`'s rules pick the ink values up
through their `var(--token, <default>)` reads; the three focus rules noted below are the only
preset changes. An app that skips importing `ink.css` gets the default palette only, exactly as
before this file existed.

Ink applies to an element carrying **both** `.dark` and `data-theme="ink"` — the selector is
`.dark[data-theme="ink"]`, because the palette has no light variant:

```html
<html class="dark" data-theme="ink">
```

Beyond repainting `--color-primary`, `--color-surface`, `--color-canvas` and the rest of the
tokens above, ink adds a handful its own: a four-step surface scale for a navigation rail
(`--color-surface-page`, `--color-surface-rail`, `--color-surface-card`, `--color-surface-active`),
a hairline rule colour (`--color-hairline`), two named text tones (`--color-text`,
`--color-text-muted`), and — the reason ink exists as a second selector rather than a copy of the
default dark palette — `--color-nav-active` and `--color-focus-ring`, split off `--color-primary`
so focus states and a rail's current item do not use the accent. `--color-nav-active` is a
**foreground/indicator** colour: a rail draws its current item's icon or text in it, not its
background — the background a rail paints behind its current item is `--color-surface-active`
above, a separate token. `--color-focus-ring` is read by three focus rules in `preset.css`:
`.btn`'s ring under any `.dark`, and the `.input`/`.select`/`.textarea` outline. Each falls back to
the accent, `--color-primary-muted`, where the token is not set, which is everywhere but ink. So the
form fields draw the rings they drew before, and a focused `.btn` in default dark draws purple-400
instead of the browser's near-black ring (#297). The default palette's `--color-primary` stays
documented as covering buttons, links, focus rings and active nav all at once — ink is the one
palette that splits focus rings and a rail's active indicator off it, onto their own tokens. Everything else that reads
`--color-primary` or `--color-primary-muted` in `preset.css` still carries the accent under ink:
`.btn-primary`'s fill, links (`.btn-link`, `.text-primary`, `.border-primary`), `bg-primary`,
checkboxes, radios, `.btn-primary-outline` and `.bar`. That is narrower than #257 asked (the accent
on the primary action alone); moving those is left for a later change.

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

Both classes had zero usages in the product they were extracted from — only its
`ui-guide` referenced them, which is how they survived:

- `.h6` — use `text-base font-medium`.
- `.btn-sm` — use `h-9 px-4` on the button.

`card-header` and `btn-disabled` were added back from another source
application, where both are in use (`btn-disabled` replaces that app's
`fieldset[disabled] .btn`).

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

`css-text.test.ts` guards the other half: that `TOKENS_CSS`/`PRESET_CSS` — what `+index.ts`
actually exports — match `tokens.css`/`preset.css` byte for byte. Both constants are generated
files (`tokens-css.ts`/`preset-css.ts`), written by `generate.ts` and never hand-edited; run it
after changing either CSS file:

```bash
deno task --cwd theme generate
```

The test is what actually stops the export and the file from drifting apart — nothing else in
`deno task check` or in any package's `deno publish --dry-run` reads `tokens-css.ts`/
`preset-css.ts` against their source, so both stay green even if `generate.ts` is forgotten.
