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

Then tell Tailwind which classes the library's components render, so it emits them. The package
exports them as `COMPONENT_CLASSES`, one string of class names separated by spaces, and the app adds
one line to the entry above:

```ts
import { COMPONENT_CLASSES } from "@spy4x/preact-theme"

const entry = `
  @import "tailwindcss";
  @import "@spy4x/preact-theme/tokens.css";
  @import "@spy4x/preact-theme/preset.css";
  @source inline("${COMPONENT_CLASSES}");
`
```

`@source inline` (Tailwind 4.1 and later) takes class names instead of files, so the app's build
never scans the library. The app's own files are still scanned as usual.

An app that builds with Vite and `@tailwindcss/vite` has no entry string in TypeScript. It imports
the plugins from `@spy4x/preact-theme/vite` instead:

```ts
// vite.config.ts
import deno from "@deno/vite-plugin"
import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { npmSpecifiers, preactThemeCss, requireComponentCss } from "@spy4x/preact-theme/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    npmSpecifiers({ readTextFile: Deno.readTextFile }),
    deno(),
    preact(),
    preactThemeCss(),
    tailwindcss(),
    requireComponentCss(),
  ],
})
```

and its `src/app.css` keeps the `@import` lines of the recipe above:

```css
@import "tailwindcss";
@import "@spy4x/preact-theme/tokens.css";
@import "@spy4x/preact-theme/preset.css";
```

- `preactThemeCss()` replaces the theme's `@import` lines in `src/app.css` with the text this
  package exports, and appends the `@source inline` line with `COMPONENT_CLASSES`. The `tokens.css`
  and `preset.css` lines are required and `ink.css` is optional. Another stylesheet is named with
  `preactThemeCss({ stylesheet: "/styles/main.css" })`. List it before `tailwindcss()`.
- `requireComponentCss()` fails `vite build` when the built CSS lacks `.lg\:w-64` or
  `.focus\:not-sr-only`, two selectors only the library's components render. Tailwind exits 0
  when the class names never reached it, so without this check an app ships unstyled. `selectors`
  replaces the two defaults; never pass a plain class such as `.sr-only` there, because Tailwind
  scans `vite.config.ts` itself and emits it, so the guard could never fail.
- `npmSpecifiers()` resolves the `npm:` specifiers inside the library's modules, such as
  `npm:@preact/signals@2.5.1`, to the app's own copy of that package. `@deno/vite-plugin` 1.0.6
  cuts a scoped name at its first `@` and drops a subpath, so without it the build fails
  (denoland/deno-vite-plugin#74); it goes away once that is fixed. It throws
  `NpmVersionMismatchError` when the app's copy is not the version the library pins. It reads the
  resolved package's `package.json` through the `readTextFile` it is given — `Deno.readTextFile`,
  or Node's `(path) => readFile(path, "utf8")` — so the module itself calls no Deno-only API. List
  it before `deno()`.

The plugins are typed structurally, so this package does not depend on `vite`; an object they
return is accepted by Vite's `plugins` array as it is.

Scanning the installed library does not work for a Deno app. JSR packages are not in
`node_modules`: Deno keeps them in its own cache under hashed file names. Pointing `@source` at
those cached files works on a glibc system but emits nothing inside the `denoland/deno:alpine-*`
images: there, Deno is a glibc program, while Tailwind's scanner loads the build it made for musl,
because it reads `/usr/bin/ldd` to decide. That build scans none of the named files, and the CSS
ships without the components' classes while the build still exits 0 (#323).

`COMPONENT_CLASSES` is generated from every published package's sources and lists only names that
compile to CSS against `tailwindcss` and this preset; `component-classes.test.ts` fails when it
falls out of date. It carries every package's classes, used or not, so an app that renders only
some of the components still gets CSS for all of them.

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

- **Colour atoms** — `text-primary`, `bg-primary`, `bg-primary-muted` (the accent as a fill,
  which stays visible in dark where `bg-primary` is near-black chrome), `border-primary`,
  `rounded-primary`, `text-muted`, `bg-canvas`, `bg-surface`, `border-subtle`,
  `border-control`, `bg-danger`, `bg-warning`, `bg-success` and the `text-*`
  status tones.
- **Type** — `h1`–`h5`, `link`, `page-layout` (deprecated: use `Page` from
  `@spy4x/preact-ui/layout`), `list-ul`, plus `theme-base` for
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
  covers the parts a class cannot reach. The preset does not style
  `[aria-invalid]`: a field marked invalid keeps its normal border, so the
  error's colour and text come from the component (`Field` draws both).
  Under `.dark` the five control classes also set `color-scheme: dark`, so the
  browser draws a checkbox, a radio, a date picker's icon and a field's
  scrollbar dark instead of as a white box. The page's own scrollbar follows the
  root element's `color-scheme`, which the preset leaves to the app.
- **Surfaces** — `card`, `card-header`, `card-body`, `card-footer`, `scrollbar`.
- **Data display** — `num`, `kpi`, `kpi-label`, `kpi-value`, `bar`.
- **Map** — `map-marker` inside a `status-on` / `status-off` / `status-unknown` container, used by
  `@spy4x/preact-map`'s `Map` component and its plain-text list of markers.
- **Spacing** — `pb-safe` (bottom padding that clears a phone's home indicator) and `pb-safe-3`
  (step 3 plus that inset). The inset is the device's, not a step, so it gets a name here instead
  of an arbitrary value in a component.

## Spacing

Padding, margin, gap, `space-x`/`space-y` and scroll margin/padding use one fixed scale, which the
`@spy4x/preact-theme/spacing` subpath exports together with a checker. The rule itself — the steps,
the named gaps, the no-outer-margin rule and a page built from the layout components — is in
[`docs/spacing.md`](../docs/spacing.md).

| Export                        | What it is                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SPACING_STEPS`               | `0 px 1 2 3 4 6 8 12 16`: every step a spacing class may use                                              |
| `SPACING_GAPS`                | the named gaps of the layout components: `none xs sm md lg xl 2xl` → `0 1 2 4 6 8 12`                     |
| `findOffScaleSpacing(source)` | every off-scale or arbitrary spacing class, spacing arbitrary property and `--spacing()` call in `source` |

`findOffScaleSpacing` returns one `{ line, column, className, reason }` per finding, with the
variant prefix and any `-` kept in `className` (`sm:-mt-4`). Besides spacing classes it reports an
arbitrary property that sets padding, margin or a gap (`[padding:…]`) and a `--spacing()` call whose
argument is not a numeric step. It cannot see a raw CSS declaration (`padding: 10px`), an inline
`style`, a class name built at run time or Tailwind's legacy `theme()` function, so it is a floor
that review builds on, not a proof. It reads any file's text — TypeScript, TSX,
CSS with `@apply`, HTML — and uses no Deno API, so an app can call it from its own test. This is
the whole test an app built from `spy4x/template` needs, run with `--allow-read`:

```ts
// spacing.test.ts
import { findOffScaleSpacing } from "@spy4x/preact-theme/spacing"
import { expect } from "@std/expect"
import { walk } from "@std/fs/walk"

Deno.test("every spacing class is on the scale", async () => {
  const found: string[] = []
  for (const root of ["apps", "libs"]) {
    for await (const file of walk(root, { exts: [".ts", ".tsx", ".css"], skip: [/\.test\./] })) {
      for (const v of findOffScaleSpacing(await Deno.readTextFile(file.path))) {
        found.push(`${file.path}:${v.line}:${v.column} ${v.className} — ${v.reason}`)
      }
    }
  }
  expect(found).toEqual([])
})
```

Leave test files out: they spell out classes to assert on. Comments are read, because Tailwind's
own scanner reads them and emits CSS for a class it finds there; a word counts only when it has the
exact shape of a spacing class, so "a gap-free layout" or "top-5 results" is never reported.

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

### Accent

The components draw their accent — a primary `Button`'s fill, `LoadingSpinner`, `Calendar`'s
selected day, `Tabs`' current tab, `ToggleSwitch`, the accent `Badge`, `EmptyState`'s icon, the
accent `Kpi` and the components' focus rings — from an accent scale, not from Tailwind's
`purple-*`. So setting `--color-primary` on `:root` recolours them with the preset's own rules:

| Token                      | Light (`:root`)                  | Dark (`.dark`) |
| -------------------------- | -------------------------------- | -------------- |
| `--color-accent`           | `var(--color-primary)`           | purple-900     |
| `--color-accent-900`       | `var(--color-accent)`            | the same       |
| `--color-accent-50`…`-950` | worked out from `--color-accent` | the same       |

- `preset.css` maps the scale onto a Tailwind colour, `accent`, with `@theme inline reference`: a
  component writes `bg-accent-900`, `dark:text-accent-400`, `ring-accent-900` or
  `dark:bg-accent-900/30`, and the utility reads `var(--color-accent-900, <purple-900>)` at run
  time, so the app's cascade still wins. An app's own markup can use the same classes.
- Step 900 is the accent itself. Every other step is worked out from it through CSS relative
  colour syntax (`oklch(from var(--color-accent) …)`), in three parts:
  - **Lightness.** Tints (50–300) keep the lightness of Tailwind's purple step with the same
    number, so a tint stays a tint. Steps 400–950 scale the accent's own lightness by the purple
    step's ratio to purple-900's, with caps:
    - 400 and 500 are capped at 0.80 and 0.76. That keeps the scale in order for an accent about
      as dark as purple-900. For an accent lighter than about 0.5, capped steps come out of order;
      for example, step 700 is no longer lighter than step 900.
    - 600, 700 and 800 carry the primary Button's white label, as its dark hover, dark fill and
      light hover. They are capped at 0.545, 0.50 and 0.545, where white text clears 4.5:1 at
      every hue. Step 600 gets 0.013 more near purple, so purple-600 stays exact.
  - **Chroma.** A step takes the purple step's chroma ratio only near purple's own hue; any other
    accent keeps its own chroma on steps 400–800, and scales down on the tints and 950. The result
    is capped at an estimate of the most chroma sRGB can show at that lightness and hue: the
    triangle through the sRGB cusp, whose lightness and chroma are a 3-harmonic Fourier fit in
    the hue, scaled by 0.86. The cap matters because Chromium clips an out-of-gamut colour one
    channel at a time, and an uncapped warm accent rendered pure red.
  - **Hue.** The purple step's offset from purple-900's hue is added.

  Relative colour was chosen over `color-mix()` because it can reproduce the purple steps: with
  no token set, every step is Tailwind's own purple step to the third decimal, and an app that
  sets nothing renders the same colours as before. With any other accent, every step renders
  within 0.02 OKLab of the colour it names. The one exception is an accent within about 11° of
  purple: the allowance that keeps purple itself exact lets step 500 overshoot by up to about 0.025
  OKLab. A warm accent's dark fill (step 700) can sit fairly close to the danger button's red;
  white text on it comes first. `pages/checks/theme.ts` measures, in a browser, the purple steps,
  the gamut, and white-label contrast for four accents. Choose an accent about as dark as
  purple-900: white text sits on it.
- The scale's block in `tokens.css` is written by `accent-scale.ts`, which holds the purple steps,
  the caps and the weights, and fits the cusp itself. `accent-scale.test.ts` fails when
  `tokens.css` differs from its output, and `deno task --cwd theme generate` runs it.
- In the dark palette `--color-primary` is near-black chrome, so `.dark` sets `--color-accent` to
  purple-900 itself, and the components keep their purple there. An app with a dark palette sets
  `--color-accent` as well — on `:root` after `tokens.css`, which covers both palettes, or in its
  own `.dark` rule. An app that sets `--color-primary` on `:root` after `tokens.css` also
  overrides `.dark`'s near-black `--color-primary`, because the two selectors are equally specific
  and the later rule wins. So in the dark palette the preset's `.btn-primary` takes the brand
  colour, while the components follow `--color-accent`.
- The scale is worked out once, on `:root`, and inherited as colours: set the tokens on `:root`,
  not on a subtree. The scale's `@supports` block tests the maths it uses (`calc()`, `min()`,
  `max()`, `cos()` and `sin()` on channel keywords). A browser that cannot evaluate them skips
  the block, and every step except 900 draws the literal purple fallback `preset.css` carries,
  which is also what an app that skips `tokens.css` gets. Step 900 is declared outside the block,
  so it still follows the accent. In such a browser a blue-branded app gets a blue fill with a
  purple hover, a purple dark fill and purple dark rings.
- The components' focus rings read `ring-accent-*`, not `--color-focus-ring`: that token moves the
  preset's own rings (below), and under ink the components' rings keep the accent.
- Ink sets no accent token, so under ink the components keep the default dark accent, as before.

```css
/* After tokens.css. */
:root {
  --color-primary: oklch(0.424 0.199 265.638); /* blue-800 */
  --color-accent: oklch(0.424 0.199 265.638); /* the same, for the dark palette */
}
```

The catalogue's header has an accent switch that does exactly this.

The light canvas is `gray-100`, one step below the white surface, so a card
stands off the page without a heavy border. Muted text is `gray-600`, which
keeps WCAG AA contrast (4.5:1) on that canvas as well as on a card; `gray-500`
does not (4.4:1).

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

### Headings, weights, shapes and shadows

- **Headings.** `--font-heading` is not declared: unset, a heading inherits its font like any other
  text, so a heading inside a `font-mono` wrapper stays mono. An app sets it, and `h1`-`h6` under
  `.theme-base`, the preset's `h1`-`h5` classes and the `font-heading` class draw in it:
  `--font-heading: "Literata", serif` gives serif headings. A heading that carries a font class of
  its own (`font-sans`) keeps it, because utilities sit above the preset's base layer; a heading in
  a `font-mono` wrapper takes the app's `--font-heading`, which is what setting it asks for.
  `pages/checks/theme.ts` reads all three cases in a browser.
- **Weights.** `font-medium` and `font-bold` read Tailwind's own `--font-weight-medium` and
  `--font-weight-bold` (500 and 700). An app whose fonts ship only 400 and 600 sets both to `600`
  in `:root`, after the preset, so no weight is faked. No token of this package is needed.
- **Radius.** `--radius-primary` (`rounded-primary`, 0.5rem) is the shape of a button, a card body
  and most controls; `--radius-control` (`rounded-control`, 0.375rem) is a small field or chip and
  `--radius-card` (`rounded-card`, 0.75rem) a card. An app whose controls use `rounded-lg` sets
  `--radius-control: 0.5rem`. Pills stay `rounded-full`.
- **Shadows.** `--shadow-raised` (`shadow-raised`) is a card's and `--shadow-popover`
  (`shadow-popover`) a menu's, dialog's or tooltip's. `none` gives flat chrome with hairline
  borders, or a popover-only shadow: set `--shadow-raised: none`.

### Selection and focus

The accent is a colour of the primary `Button`. What is chosen or current reads its own tokens,
which follow the accent until an app points them elsewhere:

| Token                         | Class                              | For                                        |
| ----------------------------- | ---------------------------------- | ------------------------------------------ |
| `--color-selected`            | `bg-selected`                      | the chosen Calendar day, a checked control |
| `--color-selected-foreground` | `text-selected-foreground`         | text on that fill                          |
| `--color-selected-soft`       | `bg-selected-soft`                 | a selected row, a highlighted badge        |
| `--color-selected-hover`      | `bg-selected-hover`                | the chosen fill under the pointer          |
| `--color-selected-soft-hover` | `bg-selected-soft-hover`           | the quiet background under the pointer     |
| `--color-selected-text`       | `text-selected`, `border-selected` | the active tab, a current-item mark        |

The two hover tokens follow the accent, not `--color-selected`: the accent's hover step depends on
which label the accent takes, which a colour derived from `--color-selected` cannot know. An app
that repaints `--color-selected` or `--color-selected-soft` sets the matching hover token too.

In the dark palette `--color-selected` is accent step 600: step 900 stood only 1.62:1 off the dark
canvas, and 600 is the lightest step a white label is held to 4.5:1 on. `--color-selected-hover`
stays step 800 in both palettes. With the default purple the fill reads 3.20:1 on the dark canvas
and its label 5.54:1.

Focus: `ring-2 ring-focus ring-offset-2 ring-offset-focus` draws a 2px ring in `--color-ring` (the
accent, which is what the primary `Button` draws today; step 400 in the dark palette, 6.36:1 on the
dark canvas) with a 2px gap in `--color-focus-offset` (the canvas). `--color-focus-ring` is the
other token: it moves the preset's own `.input`, `.select`, `.textarea` and dark `.btn` rings, and
ink sets it, so ink does not touch the components' ring.

### Text on a fill

`--color-accent-foreground` is white (`oklch(1 0 0)`) or a near-black (OKLCH lightness 0.1),
whichever has the higher contrast on the accent: the accent's WCAG relative luminance, worked out
in CSS from its sRGB channels, decides at 0.18. The default purple takes white, so the primary
`Button` is what it was. The scale's label steps (600, 700, 800) follow the choice: for an accent
that takes the dark label they are the accent itself or a little lighter for the hovers, so a hover
never lowers the contrast; for one that takes white they are the caps in `accent-scale.ts`, as
before. What is proven, in `pages/checks/theme.ts`: for 56 accents (seven hues at chroma 0.3 and
eight lightnesses from 0.4 to 0.9, as the browser draws them) the label reads at 4.5:1 on steps 900,
800, 700 and 600, and the same holds for `#f97316`. An accent outside that sweep is not measured. An
app pins the label by setting `--color-accent-foreground`. The block needs `pow()` in CSS; a
browser without it keeps the previous rules (the literal purple steps and
`--color-primary-foreground`).

`.btn-danger` keeps `--color-danger-foreground` (red-50). The `Button`'s danger variant reads
`--color-danger-fill` (red-600 in light, red-700 in dark), `--color-danger-fill-hover` (red-700 and
red-600) and `--color-danger-fill-foreground` (white, 4.77:1 in light and 6.42:1 in dark). The fill
is not `--color-danger` because that is drawn as text in dark. In the dark palette `--color-danger`,
`--color-warning` and `--color-success` are text colours (red-400, orange-400 and green-400), each
at 4.5:1 or better on the surface and the canvas, so `text-danger`, `text-warning` and
`text-success` need no `dark:` override. `bg-warning`, `bg-success`, `.btn-warning`, `.btn-success`
and the on and off map markers read `--color-warning-fill` and `--color-success-fill` instead: the
text colour in light, and orange-600 and green-700 in dark. An app that repaints `--color-warning`
or `--color-success` also sets `--color-warning-fill` or `--color-success-fill` in `.dark`:
otherwise its dark fills stay orange-600 and green-700. `--color-danger-soft` and
`--color-info-soft` are the tinted backgrounds of an error or notice.

### Replacing fixed colours

A class naming a Tailwind gray, slate, zinc, neutral or stone step, or `white` or `black`, ignores
the tokens (`infra/scripts/fixed-colours.test.ts` lists the files that still have one). Each token
below flips with `.dark` on its own, so a light/dark pair collapses to one class.

| Fixed class (light and dark)                                                                                                                                                                                                  | Token class                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `text-gray-900`, `-950`, `-800`, `-700`, `dark:text-gray-50`…`-200`, `text-black`                                                                                                                                             | `text-foreground`                                                                                                 |
| `text-gray-600`, `-500` (secondary text), `dark:text-gray-400`                                                                                                                                                                | `text-muted`                                                                                                      |
| `text-gray-400`, `-500` (placeholder, idle icon)                                                                                                                                                                              | `text-placeholder`                                                                                                |
| `bg-white`, `dark:bg-gray-800`                                                                                                                                                                                                | `bg-surface`                                                                                                      |
| `bg-gray-50`, `bg-gray-100` (page or recessed area), `dark:bg-gray-900`                                                                                                                                                       | `bg-canvas`                                                                                                       |
| `hover:bg-gray-50`, `-100`, `-200`, `dark:hover:bg-gray-700`                                                                                                                                                                  | `hover:bg-hover`                                                                                                  |
| `bg-gray-200`, `-300` (track, unfilled part), `dark:bg-gray-600`                                                                                                                                                              | `bg-track`                                                                                                        |
| `bg-gray-900`, `bg-black` (inverse chip, tooltip) with `text-white`                                                                                                                                                           | `bg-foreground` with `text-canvas`; a tooltip that was gray-700 in dark adds `dark:bg-hover dark:text-foreground` |
| `bg-black/50` (backdrop), `text-white` drawn on it                                                                                                                                                                            | `bg-scrim`, `text-scrim-foreground`                                                                               |
| `text-white` on `bg-accent-*` (primary button)                                                                                                                                                                                | `text-accent-foreground`                                                                                          |
| `text-white` on `bg-red-*`                                                                                                                                                                                                    | `text-danger-fill-foreground` on `bg-danger-fill`                                                                 |
| `text-white` on a chosen day or checked control                                                                                                                                                                               | `text-selected-foreground` on `bg-selected`                                                                       |
| `border-gray-100`, `-200`, `dark:border-gray-700` (chrome)                                                                                                                                                                    | `border-subtle`                                                                                                   |
| `border-gray-300`, `dark:border-gray-600` (control border)                                                                                                                                                                    | `border-control`                                                                                                  |
| `divide-gray-*`                                                                                                                                                                                                               | `divide-subtle`                                                                                                   |
| `ring-gray-200`, `-300`, `dark:ring-gray-*`                                                                                                                                                                                   | `ring-subtle`, `ring-control`                                                                                     |
| `shadow-sm`, `shadow-xs`, `shadow-md`                                                                                                                                                                                         | `shadow-raised`                                                                                                   |
| `shadow-lg`, `shadow-xl`                                                                                                                                                                                                      | `shadow-popover`                                                                                                  |
| `bg-accent-50`, `dark:bg-accent-900/30` (selected row, active tab background)                                                                                                                                                 | `bg-selected-soft`                                                                                                |
| `text-accent-900`, `dark:text-accent-400` (active tab text)                                                                                                                                                                   | `text-selected`                                                                                                   |
| `hover:bg-accent-800` on a chosen day, `hover:bg-accent-100`, `dark:hover:bg-accent-900/50` on today                                                                                                                          | `hover:bg-selected-hover`, `hover:bg-selected-soft-hover`                                                         |
| `bg-accent-900` on a chosen day, checked box, switch on                                                                                                                                                                       | `bg-selected` with `text-selected-foreground`                                                                     |
| `bg-white/80`, `bg-white/85`, `bg-gray-900/80`, `bg-gray-900/85` (panel over content)                                                                                                                                         | `bg-surface-overlay`                                                                                              |
| `bg-gray-900/25`, `dark:bg-gray-900/*` (tint over the canvas, not a backdrop: see the drawer row below)                                                                                                                       | `bg-hover`                                                                                                        |
| `bg-black/80`, `bg-black/95` (lightbox backdrop)                                                                                                                                                                              | `bg-scrim-strong`                                                                                                 |
| `bg-white/10`, `bg-white/20` (marks drawn on a scrim)                                                                                                                                                                         | `bg-on-scrim`, `bg-on-scrim-strong`                                                                               |
| `border-white/10`                                                                                                                                                                                                             | `border-on-scrim`                                                                                                 |
| `text-white/70`, `text-white/80`                                                                                                                                                                                              | `text-on-scrim-muted`                                                                                             |
| `text-white/90`, `text-white` on a scrim                                                                                                                                                                                      | `text-scrim-foreground`                                                                                           |
| `border-gray-400`, `border-gray-500` (checkbox, strong hairline)                                                                                                                                                              | `border-strong`                                                                                                   |
| `decoration-gray-300`, `decoration-gray-500`, `decoration-gray-600`                                                                                                                                                           | `decoration-control`                                                                                              |
| `ring-black/5`, `ring-gray-900/5` (popover hairline)                                                                                                                                                                          | `ring-1 ring-subtle`                                                                                              |
| `ring-white`, `dark:ring-gray-800` (cutout ring)                                                                                                                                                                              | `ring-surface`                                                                                                    |
| `ring-offset-gray-800`, `ring-offset-white`                                                                                                                                                                                   | `ring-offset-surface`                                                                                             |
| `border-white`, `border-gray-800` (edge in the surface colour)                                                                                                                                                                | `border-surface`                                                                                                  |
| `bg-gray-950`, `bg-gray-900` (inverse block; flips light in dark)                                                                                                                                                             | `bg-foreground` with `text-canvas`                                                                                |
| `bg-gray-950` with `text-gray-100` (code block that stays dark in both palettes)                                                                                                                                              | `bg-scrim-strong` with `text-scrim-foreground`                                                                    |
| `text-gray-700`, `dark:text-gray-300` (body copy)                                                                                                                                                                             | `text-foreground`; use `text-muted` where the copy is meant to be secondary                                       |
| `bg-gray-100`, `dark:bg-gray-700/60` (inline code chip on a surface)                                                                                                                                                          | `bg-hover`                                                                                                        |
| `rounded-xl` (card)                                                                                                                                                                                                           | `rounded-card`                                                                                                    |
| `rounded-md` (field, chip), `rounded-lg` (control)                                                                                                                                                                            | `rounded-control`, `rounded-primary`                                                                              |
| `text-gray-300`, `dark:text-gray-600` (a day outside the month, faded text)                                                                                                                                                   | `text-placeholder opacity-35` (no token is that faint)                                                            |
| `bg-gray-900/25` (drawer backdrop over the page, unlike the tint row above)                                                                                                                                                   | `bg-scrim opacity-50` (`bg-hover` is opaque and would hide the page)                                              |
| `backdrop:bg-black/40` (`<dialog>` backdrop)                                                                                                                                                                                  | `backdrop:bg-scrim backdrop:opacity-80`                                                                           |
| `bg-white`, `text-gray-900` chip on a coloured bar that stays white in dark                                                                                                                                                   | `bg-(--color-scrim-foreground,oklch(1_0_0))`, `text-foreground dark:text-canvas`                                  |
| `dark:bg-gray-900` where the light side is `bg-white` (a bar or drawer)                                                                                                                                                       | `bg-surface dark:bg-canvas`, which keeps both shades                                                              |
| `bg-gray-100 hover:bg-gray-200`, `dark:bg-gray-700 dark:hover:bg-gray-600` (secondary button)                                                                                                                                 | `bg-hover hover:bg-track`                                                                                         |
| `bg-gray-100`, `dark:bg-gray-700` (a chip, an avatar, a pressed toolbar button)                                                                                                                                               | `bg-hover`                                                                                                        |
| `bg-gray-200 dark:bg-gray-700` (progress track, where the fill must keep 3:1)                                                                                                                                                 | `bg-track dark:bg-hover`                                                                                          |
| `bg-white dark:bg-gray-200` (switch knob, light in both palettes)                                                                                                                                                             | `bg-surface dark:bg-foreground`                                                                                   |
| `bg-gray-200 text-gray-600` (filled gray badge, no dark classes)                                                                                                                                                              | `bg-track text-foreground` (`text-muted` is 2.9:1 on the dark track)                                              |
| `bg-blue-50 text-blue-700` (chosen list option)                                                                                                                                                                               | `bg-selected-soft text-selected`                                                                                  |
| `border-accent-200 bg-accent-50 text-accent-700` (icon tile)                                                                                                                                                                  | `border-subtle bg-selected-soft text-selected`                                                                    |
| `border-accent-900 bg-accent-900 text-accent-50` (highlighted badge)                                                                                                                                                          | `border-transparent bg-selected text-selected-foreground`                                                         |
| `hover:text-accent-900`, `dark:hover:text-accent-400` (sortable header)                                                                                                                                                       | `hover:text-selected`                                                                                             |
| `focus-visible:ring-accent-900` (focus ring)                                                                                                                                                                                  | `focus-visible:ring-focus`                                                                                        |
| `border-blue-500 bg-blue-50` (drop target)                                                                                                                                                                                    | `border-info bg-info-soft`                                                                                        |
| `ring-white` on a scrim (focus ring)                                                                                                                                                                                          | `ring-(--color-scrim-foreground)` (`ring-scrim-foreground` generates no CSS)                                      |
| `ring-accent-900 dark:ring-accent-400`, `bg-accent-900 dark:bg-accent-400` (a lifted card's ring, a drop indicator)                                                                                                           | `ring-(--color-selected-text)`, `bg-(--color-selected-text)` (no utility exists)                                  |
| `text-white` on a status fill that stays fixed (toast info `bg-blue-700`, warning `bg-yellow-700`: their token pairs are lighter and would read worse; success uses its pair, `bg-success text-(--color-success-foreground)`) | `text-scrim-foreground`                                                                                           |
| `text-red-*`, `bg-red-*` (error text, danger tint)                                                                                                                                                                            | `text-danger`, `bg-danger-soft` (`text-info`, `bg-info-soft` for blue)                                            |

Where the token's dark value is a different shade from what a component used (for example a
`dark:` step a shade off), the lane that converts the file checks the result in the browser.

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
workspace needs `net`, `run` or `write` to test. `component-classes.test.ts` runs
in a second process with `--allow-ffi` added, because it runs Tailwind's class
scanner, a native addon; no other test gets that grant.

`component-classes.test.ts` holds `COMPONENT_CLASSES` to the packages' sources: it fails when a
component gains or loses a class and `component-classes.ts` was not regenerated. The same
`deno task --cwd theme generate` below rewrites it.

`infra/scripts/fixed-colours.test.ts` (with `fixed-colours.ts`, its checker) fails on a fixed gray,
slate, zinc, neutral, stone, white or black colour class in a component's source, except in the
files its allow-list names; the list may only shrink.

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
