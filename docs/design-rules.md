# Design rules

The rules of [design-language.md](./design-language.md), one line each; headings link to the
reasons.

## [Type](./design-language.md#type)

- Geist Sans, Geist Mono for code, tabular figures in tables.
- Fonts self-hosted, never from a CDN.
- An app sets `--font-sans` and `--font-mono` once, in its `@theme`.
- Weights: 400 body, 500 labels and app headings, 600 marketing headings, 700 hero, 800 storefront.
- Arabic: Noto Sans Arabic, loaded only for Arabic letters.
- Tailwind's text sizes only, never `text-[17px]`.
- Paragraphs at most `max-w-2xl`; headings `text-balance`, paragraphs `text-pretty`.
- Sentence case; uppercase only where the library draws it.

## [Spacing and width](./design-language.md#spacing-and-width)

- Gaps from the scale `0 px 1 2 3 4 6 8 12 16`; a component's root has no margin.
- Marketing bands are `py-12`, `py-16` from `lg`; never `py-20` or `py-24`.
- Widths: `max-w-md` a form, `2xl` reading, `5xl` app lists, `6xl` marketing.

## [Shape and surfaces](./design-language.md#shape-elevation-and-surfaces)

- Radius: the three library tokens, unchanged.
- Canvas for the page, surface for a card; shadows: raised (light only) and popover.
- No card inside a card, around a single line, or a dashed box in a card.

## [Motion](./design-language.md#motion)

- Motion only to explain a change: 150 ms hovers, 150–200 ms `ease-out`.
- No scroll reveals, parallax, bouncing, or over 300 ms.
- Honour reduced motion.

## [Icons](./design-language.md#icons)

- Only `@spy4x/preact-icons`; add a missing icon there.
- Outline, `size-5` beside text, `size-4` in dense rows, `currentColor`.
- An icon always has a label or an accessible name.
- Only directional glyphs mirror in RTL.

## [Colour](./design-language.md#colour-apart-from-the-brand-hue)

- Token classes (`bg-surface`), never `gray-*`, `white`, `black`.
- Status colours are the library's tokens, never the brand hue.
- Accent only for the one primary action and "current".
- Colour never carries meaning alone: add a word and an icon.

## [Dark mode](./design-language.md#dark-mode)

- Light and dark, following the system, with no white flash.
- The house dark is near-black ink (`INK_CSS`), never `#000` or slate.
- A dark-only site declares `color-scheme: dark`.
- `theme-color` and the manifest background equal the canvas.

## [Layout](./design-language.md#layout-patterns)

- Apps `AppShell`; marketing `SiteHeader`, `SiteFooter`; personal site `Rail` with labels.
- Every signed-in page starts with `PageHeader`, the only page title.
- Settings with sub-pages use `SettingsLayout`.
- Daily controls on the page, rare ones in a menu; forms open when asked.

## [App shell](./design-language.md#app-shell)

- An app draws no chrome of its own.
- Screens never set a width; the shell's column does.
- On a phone, at most four tabs plus the account slot.

## [Components](./design-language.md#component-patterns)

- Need → component: the table there, or [choose-a-component.md](./choose-a-component.md).
- Product media sits in the plain `WindowFrame`.
- Show both palettes only through `ThemePreview`.

## [Words](./design-language.md#words)

- Plain, short, sentence case: "Create note", not "Submit".
- One wording per action across an app.
- Errors say what happened and what to do; no "Oops".
- No exclamation marks; format with `Intl`.
- An empty state names what the person will get.

## [Accessibility](./design-language.md#accessibility-bar)

- WCAG 2.2 AA in both palettes: text 4.5:1, controls 3:1.
- Everything works from the keyboard with a visible focus ring.
- Touch targets 44 px on a phone, 36 px from `sm`.
- No sideways scroll at 320 px; works at 200 % zoom.
- Every control and image has a name.
- Browser tests run axe-core in both palettes.

## [Brand](./design-language.md#what-each-app-chooses)

- An app chooses only its brand hue (personal sites: warm neutrals, a serif).
- Hue lightness 0.38–0.5, 30° from other apps, clear of status hues.
- The mark is a rounded square in the hue with a white glyph, then the name.
