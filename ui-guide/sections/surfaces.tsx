/**
 * The surface and utility chapter: the classes an app applies to its own markup.
 *
 * Cards, the scroll container, the type scale, KPI tiles and the colour atoms are the half of
 * `preset.css` no `ui/` component owns — a page built from the library styles its own container
 * elements with exactly these. Nothing here is a component, which is why the section declares the
 * `theme` package instead of one of the five the catalogue derives component names from.
 *
 * A card's `classes` list is rendered as chips and checked against the card's own markup by
 * `classes.test.tsx`, so a chip cannot name a class the card does not apply.
 */

import { INK_CSS } from "@spy4x/preact-theme"
import { Button, Cluster, Grid, Stack } from "@spy4x/preact-ui"
import type { ClassDemoFragment } from "../registry.ts"

/**
 * Every custom property `.dark[data-theme="ink"]` declares, as a `property → value` map parsed
 * straight out of `INK_CSS` — the same generated constant a consuming app splices into its own
 * build. Reading the values here rather than copying them by hand is what {@link InkPaletteDemo}'s
 * swatches need: a literal copy drifts silently the moment `ink.css` changes, and nothing catches
 * that until someone notices the catalogue disagrees with the theme it is showing.
 */
function parseInkDeclarations(): Record<string, string> {
  const start = INK_CSS.indexOf('.dark[data-theme="ink"] {')
  const end = INK_CSS.indexOf("\n}", start)
  const block = INK_CSS.slice(start, end)
  const declarations: Record<string, string> = {}
  for (const match of block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
    declarations[match[1]] = match[2].trim()
  }
  return declarations
}

/** Which of {@link parseInkDeclarations}'s properties get a swatch, and the label each carries. */
const INK_SWATCH_LABELS: Record<string, string> = {
  "--color-surface-page": "surface-page",
  "--color-surface-rail": "surface-rail",
  "--color-surface-card": "surface-card",
  "--color-surface-active": "surface-active",
  "--color-hairline": "hairline",
  "--color-text": "text",
  "--color-text-muted": "text-muted",
  "--color-primary": "primary action",
  "--color-nav-active": "nav-active",
  "--color-focus-ring": "focus-ring",
}

/**
 * Swatches for the ink theme's tokens: the surface scale, the hairline, the two text
 * tones, the one accent, and the nav-active/focus tokens split off it.
 *
 * `ink.css` only paints once `.dark` and `data-theme="ink"` sit together, and the convention this
 * catalogue holds everywhere else is that `.dark` is a variant marker on `<html>`, owned by the
 * host page's colour-scheme toggle — not a class an inner element wears (see
 * `UNDEMONSTRATED_CLASSES["dark"]` in `instructions.tsx`). So this card does not fake a scoped
 * `.dark[data-theme="ink"]` locally: the swatches below read the palette's own values straight out
 * of `INK_CSS` (see {@link parseInkDeclarations}), and the real cascade — `<html class="dark"
 * data-theme="ink">` repainting a page through the same tokens `preset.css` already reads — is
 * proven in the browser by `pages/checks/theme.ts` instead, which is the only place in this
 * repository that ever toggles `.dark` on `<html>`. A couple of ink's own declarations are
 * themselves a `var(--other-token)` reference rather than a literal colour
 * (`--color-surface-page: var(--color-canvas)`, for one) — {@link resolveInkValue} follows those
 * one level, which is as deep as `ink.css` itself ever nests them.
 */
function resolveInkValue(value: string, declared: Record<string, string>): string {
  const reference = value.match(/^var\((--[a-z-]+)\)$/)
  return reference ? (declared[reference[1]] ?? value) : value
}

function InkPaletteDemo() {
  const declared = parseInkDeclarations()
  const swatches = Object.entries(INK_SWATCH_LABELS).map(([property, label]) => ({
    label,
    value: resolveInkValue(declared[property] ?? "", declared),
  }))
  return (
    <Stack class="max-w-md">
      <p class="text-sm text-muted">
        Dark only: set <code>data-theme="ink"</code> together with <code>.dark</code> on{" "}
        <code>&lt;html&gt;</code>.
      </p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {swatches.map((swatch) => (
          <div key={swatch.label} class="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              class="rounded-primary border border-subtle block size-10"
              style={`background: ${swatch.value}`}
            />
            <span class="text-muted text-xs">{swatch.label}</span>
          </div>
        ))}
      </div>
    </Stack>
  )
}

/** The four-part surface: header, body, footer, all three edges from the tokens. */
function CardDemo() {
  return (
    <div class="card max-w-md">
      <div class="card-header">
        <div>
          <p class="font-medium">Meter 4417</p>
          <p class="text-xs text-muted">Last read 4 minutes ago</p>
        </div>
        <span class="text-xs text-muted">online</span>
      </div>
      <div class="card-body">
        <p class="text-sm">
          The body holds the content. The header and the footer bring their own padding and the line
          between them, so the parts need no spacing classes.
        </p>
      </div>
      <div class="card-footer">
        <a class="link" href="#surfaces">Open the meter</a>
        <span class="text-xs text-muted">No data leaves the device.</span>
      </div>
    </div>
  )
}

/**
 * `.scrollbar` is the only overflow rule in the preset: horizontal scrolling plus a 4px themed
 * scrollbar, so a wide table or a row of chips stays inside its card instead of widening the page.
 */
function ScrollbarDemo() {
  return (
    <Stack gap="sm" class="max-w-md">
      <div class="scrollbar flex gap-2" data-e2e="scrollbar">
        {[
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ].map((month) => (
          <span key={month} class="rounded-primary border border-subtle px-3 py-1 text-sm">
            {month}
          </span>
        ))}
      </div>
      <p class="text-xs text-muted" data-e2e="scrollbar-note">
        Twelve months in one 28rem row: the row scrolls, the page does not.
      </p>
    </Stack>
  )
}

/**
 * The type scale, on paragraphs rather than headings.
 *
 * `.h1`–`.h5` are typography utilities, not elements: applying them to real headings inside the
 * catalogue would nest a second document outline in a page that already has one.
 */
function TypographyDemo() {
  return (
    <div class="page-layout">
      <p class="h1">h1 — page title</p>
      <p class="h2">h2 — section</p>
      <p class="h3">h3 — sub-section</p>
      <p class="h4">h4 — card title</p>
      <p class="h5">h5 — field group</p>
      <ul class="list-ul">
        <li>A bulleted list, with its markers inside.</li>
        <li>
          <a class="link" href="#surfaces">A link</a>, underlined until the pointer is on it.
        </li>
      </ul>
      <p class="text-xs text-muted">
        <code>.page-layout</code> frames this demo; a new page uses <code>Page</code> instead.
      </p>
    </div>
  )
}

/**
 * Data display: the KPI tile and the two numeric conventions that go with it.
 *
 * `.bar` is a width-less bar — the caller sets the length, the preset sets the height, radius and
 * colour — and `.num` right-aligns a cell with tabular figures so a column of numbers lines up.
 */
function DataDisplayDemo() {
  return (
    <Stack class="max-w-md">
      <Grid minColumnWidth="sm">
        <div class="kpi">
          <span class="kpi-label">Consumed</span>
          <span class="kpi-value">1 284</span>
          <span class="bar" style={{ width: "72%" }} />
        </div>
        <div class="kpi">
          <span class="kpi-label">Budget</span>
          <span class="kpi-value">1 800</span>
          <span class="bar" style={{ width: "100%" }} />
        </div>
      </Grid>
      <table class="w-full bg-transparent text-sm">
        <thead>
          <tr>
            <th scope="col" class="text-left font-normal text-muted">Month</th>
            <th scope="col" class="num font-normal text-muted">Readings</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-subtle border-b">
            <td class="py-1">January</td>
            <td class="num py-1">1 284</td>
          </tr>
          <tr>
            <td class="py-1">February</td>
            <td class="num py-1">986</td>
          </tr>
        </tbody>
      </table>
    </Stack>
  )
}

/**
 * The fills that carry a label, each with its own foreground: the class pair a label on that fill
 * is drawn with. The warning and success foregrounds have no utility of their own, so they are read
 * from their custom properties, as `SWUpdater` and the success toast read them.
 */
const LABELLED_FILLS: readonly (readonly [string, string])[] = [
  ["bg-primary", "text-primary-foreground"],
  ["bg-danger-fill", "text-danger-fill-foreground"],
  ["bg-warning", "text-(--color-warning-foreground)"],
  ["bg-success", "text-(--color-success-foreground)"],
]

/** Every colour atom the preset ships, on the element it was written for. */
function ColourAtomsDemo() {
  return (
    <Stack class="text-sm">
      <Stack gap="xs">
        {["text-primary", "text-muted", "text-danger", "text-warning", "text-success"].map(
          (name) => <span key={name} class={name}>{name}</span>,
        )}
      </Stack>

      <Cluster>
        {LABELLED_FILLS.map(([fill, label]) => (
          <span key={fill} class={`${fill} ${label} rounded-primary px-2 py-1 text-xs`}>
            {fill}
          </span>
        ))}
      </Cluster>

      <Stack gap="xs">
        <Cluster>
          {["bg-primary-muted", "bg-danger"].map((name) => (
            <span key={name} class="inline-flex items-center gap-2 text-xs">
              <span class={`${name} rounded-primary size-4`} aria-hidden="true" />
              {name}
            </span>
          ))}
        </Cluster>
        <p class="text-muted text-xs">
          These two fills are for marks, such as a bar or a dot, and carry no label: no one
          foreground token reads on them at 4.5:1 in both palettes. A danger label goes on
          bg-danger-fill.
        </p>
      </Stack>

      <Cluster>
        {["border-primary", "border-subtle", "border-control"].map((name) => (
          <span key={name} class={`${name} border px-2 py-1 text-xs`}>{name}</span>
        ))}
      </Cluster>

      <Cluster>
        <span class="bg-canvas border-subtle rounded-primary border px-2 py-1 text-xs">
          bg-canvas — page
        </span>
        <span class="bg-surface border-subtle rounded-primary border px-2 py-1 text-xs">
          bg-surface — card
        </span>
        <span class="rounded-primary bg-primary text-primary-foreground px-2 py-1 text-xs">
          rounded-primary
        </span>
      </Cluster>
    </Stack>
  )
}

/**
 * The tokens a warm dark palette overrides, set inline on one wrapper so the rest of the page keeps
 * its own palette. Nothing else styles the demo: every colour, font, weight, radius and shadow in
 * it comes from these custom properties. The accent scale is worked out on `:root` only, so the
 * steps the primary button reads are set here by hand; an app sets `--color-accent` on `:root`
 * and gets them, and the label colour, from `tokens.css` (`pages/checks/theme.ts` measures that).
 */
const WARM_TOKENS = [
  "--color-canvas: oklch(0.19 0.008 60)",
  "--color-surface: oklch(0.235 0.01 60)",
  "--color-foreground: oklch(0.94 0.012 80)",
  "--color-muted-foreground: oklch(0.76 0.02 75)",
  "--color-placeholder: oklch(0.66 0.02 70)",
  "--color-border-subtle: oklch(0.33 0.012 60)",
  "--color-border-control: oklch(0.42 0.014 60)",
  "--color-hover: oklch(0.29 0.012 60)",
  "--color-track: oklch(0.36 0.014 60)",
  "--color-accent-900: oklch(0.705 0.19 47)",
  "--color-accent-800: oklch(0.6 0.17 47)",
  "--color-accent-700: oklch(0.6 0.17 47)",
  "--color-accent-600: oklch(0.6 0.17 47)",
  "--color-accent-foreground: oklch(0.17 0.01 60)",
  "--color-selected: oklch(0.33 0.012 60)",
  "--color-selected-foreground: oklch(0.94 0.012 80)",
  "--color-selected-soft: oklch(0.29 0.012 60)",
  "--color-selected-text: oklch(0.94 0.012 80)",
  "--color-ring: oklch(0.705 0.19 47)",
  "--color-focus-offset: oklch(0.19 0.008 60)",
  "--color-danger-fill: oklch(0.5 0.14 30)",
  "--color-danger-fill-hover: oklch(0.45 0.13 30)",
  "--color-danger-fill-foreground: oklch(0.96 0.01 60)",
  "--radius-primary: 0.5rem",
  "--radius-control: 0.5rem",
  "--radius-card: 0.75rem",
  "--shadow-raised: none",
  "--shadow-popover: 0 8px 24px oklch(0 0 0 / 0.5)",
  "--font-heading: Georgia, 'Times New Roman', serif",
  "--font-weight-medium: 600",
].join("; ")

/** A warm dark page made only by overriding tokens: a serif heading, a light accent, flat cards. */
function WarmPaletteDemo() {
  return (
    <div
      data-e2e="warm-palette"
      class="bg-canvas text-foreground rounded-card border-subtle border p-6"
      style={WARM_TOKENS}
    >
      <Stack>
        <h3 class="h3 font-heading" data-e2e="warm-heading">Winter readings</h3>
        <p class="text-muted text-sm">
          The heading is serif and the weight is 600 because of <code>--font-heading</code> and{" "}
          <code>--font-weight-medium</code>. Nothing else was styled.
        </p>
        <div class="bg-surface border-subtle rounded-card shadow-raised border p-4">
          <Stack gap="sm">
            <p class="font-medium">Meter 4417</p>
            <p class="text-placeholder text-xs">A flat card: --shadow-raised is none.</p>
            <Cluster>
              <Button>Save</Button>
              <Button variant="danger">Delete</Button>
              <span class="bg-selected text-selected-foreground rounded-control px-2 py-1 text-xs">
                Chosen day
              </span>
              <span class="bg-selected-soft text-selected border-selected rounded-control border px-2 py-1 text-xs">
                Active tab
              </span>
            </Cluster>
            <span class="ring-2 ring-focus ring-offset-2 ring-offset-focus rounded-control w-fit px-2 py-1 text-xs">
              A focus ring: accent, with a page-coloured gap
            </span>
          </Stack>
        </div>
      </Stack>
    </div>
  )
}

/** Every token class added for selection, focus, fills, shapes and shadows, on its own sample. */
function TokenClassesDemo() {
  const swatch = "rounded-control border-subtle border px-2 py-1 text-xs"
  return (
    <Stack class="text-sm">
      <Cluster>
        <span class={`bg-selected text-selected-foreground ${swatch}`}>bg-selected</span>
        <span class={`bg-selected-soft text-selected ${swatch}`}>bg-selected-soft</span>
        <span class={`border-selected text-selected border ${swatch}`}>border-selected</span>
        <span class={`bg-selected-hover text-selected-foreground ${swatch}`}>
          bg-selected-hover
        </span>
        <span class={`bg-selected-soft-hover text-selected ${swatch}`}>bg-selected-soft-hover</span>
        <span class={`bg-hover ${swatch}`}>bg-hover</span>
        <span class={`bg-track ${swatch}`}>bg-track</span>
        <span class={`bg-foreground text-canvas ${swatch}`}>bg-foreground</span>
        <span class={`bg-scrim text-scrim-foreground ${swatch}`}>bg-scrim</span>
      </Cluster>
      <Cluster>
        <span class={`bg-info text-info-foreground ${swatch}`}>bg-info</span>
        <span class={`text-info border-info border ${swatch}`}>text-info</span>
        <span class={`bg-danger-fill text-danger-foreground ${swatch}`}>bg-danger-fill</span>
        <span class={`bg-danger-fill-hover text-danger-foreground ${swatch}`}>
          bg-danger-fill-hover
        </span>
        <span class={`bg-primary text-primary-foreground ${swatch}`}>text-primary-foreground</span>
        <span class={`bg-accent-900 text-accent-foreground ${swatch}`}>text-accent-foreground</span>
      </Cluster>
      <Cluster>
        <span class={`bg-danger-soft text-danger border-danger border ${swatch}`}>
          bg-danger-soft
        </span>
        <span class={`bg-info-soft text-info ${swatch}`}>bg-info-soft</span>
        <span class={`bg-danger-fill text-danger-fill-foreground ${swatch}`}>
          text-danger-fill-foreground
        </span>
        <span class={`bg-surface-overlay ${swatch}`}>bg-surface-overlay</span>
        <span class={`border-strong border px-2 py-1 text-xs`}>border-strong</span>
        <span class="decoration-control text-xs underline">decoration-control</span>
        <span class={`border-surface bg-canvas border-2 px-2 py-1 text-xs`}>border-surface</span>
        <span class={`ring-surface ring-offset-surface ring-2 ring-offset-2 ${swatch}`}>
          ring-surface
        </span>
      </Cluster>
      <div class="bg-scrim-strong border-on-scrim text-scrim-foreground rounded-control flex gap-2 border p-2 text-xs">
        <span class="bg-on-scrim px-2 py-1">bg-scrim-strong bg-on-scrim</span>
        <span class="bg-on-scrim-strong text-on-scrim-muted px-2 py-1">
          bg-on-scrim-strong text-on-scrim-muted
        </span>
      </div>
      <Cluster>
        <span class="text-foreground">text-foreground</span>
        <span class="text-placeholder">text-placeholder</span>
        <span class="font-heading">font-heading</span>
      </Cluster>
      <Cluster gap="lg">
        <span class={`ring-2 ring-focus ring-offset-2 ring-offset-focus ${swatch}`}>
          ring-focus
        </span>
        <span class={`ring-1 ring-subtle ${swatch}`}>ring-subtle</span>
        <span class={`ring-1 ring-control ${swatch}`}>ring-control</span>
        <span class="rounded-card border-subtle shadow-raised border px-2 py-1 text-xs">
          rounded-card, shadow-raised
        </span>
        <span class="bg-surface rounded-control shadow-popover px-2 py-1 text-xs">
          rounded-control, shadow-popover
        </span>
      </Cluster>
      <div class="divide-subtle divide-y text-xs">
        <p class="py-1">divide-subtle</p>
        <p class="py-1">between rows</p>
      </div>
    </Stack>
  )
}

export const surfaceDemos = {
  "class-card": {
    title: "Card",
    classes: ["card", "card-header", "card-body", "card-footer", "link", "text-muted"],
    summary:
      "Frames a block of content, with an optional header and footer that bring their own padding and dividers.",
    wide: false,
    snippet: `<div class="card">
  <div class="card-header">
    <p class="font-medium">Meter 4417</p>
    <span class="text-xs text-muted">online</span>
  </div>
  <div class="card-body">…</div>
  <div class="card-footer">
    <a class="link" href={meterHref}>Open the meter</a>
  </div>
</div>`,
    render: () => <CardDemo />,
  },
  "class-scrollbar": {
    title: "Scroll container",
    classes: ["scrollbar", "border-subtle", "rounded-primary", "text-muted"],
    summary:
      "Lets a row wider than its box, such as a strip of chips, scroll sideways behind a thin themed scrollbar.",
    wide: false,
    snippet: `<div class="scrollbar flex gap-3">
  {months.map((month) => (
    <span class="rounded-primary border border-subtle px-3 py-1 text-sm">{month}</span>
  ))}
</div>`,
    render: () => <ScrollbarDemo />,
  },
  "class-typography": {
    title: "Type scale",
    classes: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "link",
      "list-ul",
      "page-layout",
      "text-muted",
    ],
    summary:
      "Gives any element a heading size, a bulleted list style or a link style, whatever its tag.",
    wide: false,
    snippet: `<div class="page-layout">
  <p class="h2">Section</p>
  <ul class="list-ul">
    <li>Disc markers, inside, one step down in size.</li>
    <li><a class="link" href={reportHref}>A link that underlines itself</a></li>
  </ul>
</div>`,
    render: () => <TypographyDemo />,
  },
  "class-data-display": {
    title: "KPI tiles and numbers",
    classes: ["kpi", "kpi-label", "kpi-value", "bar", "num", "border-subtle", "text-muted"],
    summary:
      "Shows a headline number in a tile with an optional bar, and lines up a column of numbers in a table.",
    wide: false,
    snippet: `<div class="kpi">
  <span class="kpi-label">Consumed</span>
  <span class="kpi-value">1 284</span>
  <span class="bar" style="width: 72%" />
</div>

<td class="num">1 284</td>`,
    render: () => <DataDisplayDemo />,
  },
  "class-colour-atoms": {
    title: "Colour atoms",
    classes: [
      "text-primary",
      "text-muted",
      "text-danger",
      "text-warning",
      "text-success",
      "bg-primary",
      "bg-primary-muted",
      "bg-danger",
      "bg-danger-fill",
      "bg-warning",
      "bg-success",
      "border-primary",
      "border-subtle",
      "border-control",
      "bg-canvas",
      "bg-surface",
      "rounded-primary",
      "text-primary-foreground",
      "text-danger-fill-foreground",
    ],
    summary:
      "Paints text, fills, borders, the two surfaces and the corner radius from the theme's tokens.",
    wide: true,
    snippet: `<span class="text-danger">text-danger</span>
<span class="bg-success rounded-primary px-2 py-1 text-xs text-(--color-success-foreground)">bg-success</span>
<span class="border-control border px-2 py-1 text-xs">border-control</span>
<span class="bg-canvas border-subtle border px-2 py-1 text-xs">bg-canvas</span>`,
    render: () => <ColourAtomsDemo />,
  },
  "class-token-classes": {
    title: "Token classes",
    classes: [
      "bg-selected",
      "text-selected-foreground",
      "bg-selected-soft",
      "text-selected",
      "border-selected",
      "bg-selected-hover",
      "bg-selected-soft-hover",
      "bg-hover",
      "bg-track",
      "bg-foreground",
      "text-canvas",
      "bg-scrim",
      "text-scrim-foreground",
      "bg-primary",
      "bg-surface",
      "bg-canvas",
      "text-danger",
      "border-subtle",
      "bg-info",
      "text-info",
      "border-info",
      "text-info-foreground",
      "bg-danger-fill",
      "bg-danger-fill-hover",
      "text-danger-foreground",
      "text-primary-foreground",
      "text-accent-foreground",
      "text-foreground",
      "text-placeholder",
      "font-heading",
      "ring-focus",
      "ring-offset-focus",
      "ring-subtle",
      "ring-control",
      "divide-subtle",
      "rounded-card",
      "rounded-control",
      "shadow-raised",
      "shadow-popover",
      "text-danger-fill-foreground",
      "bg-danger-soft",
      "bg-info-soft",
      "border-danger",
      "bg-surface-overlay",
      "bg-scrim-strong",
      "bg-on-scrim",
      "bg-on-scrim-strong",
      "border-on-scrim",
      "text-on-scrim-muted",
      "border-strong",
      "decoration-control",
      "border-surface",
      "ring-surface",
      "ring-offset-surface",
    ],
    summary:
      "Replaces a fixed gray, white or black class: what is chosen, hovered or dimmed, the text on each fill, the focus ring, the card corner and the two shadows.",
    wide: true,
    snippet: `<span class="bg-selected text-selected-foreground rounded-control px-2 py-1">
  Chosen day
</span>
<button class="ring-2 ring-focus ring-offset-2 ring-offset-focus">Focus</button>
<div class="rounded-card shadow-raised border border-subtle">…</div>`,
    render: () => <TokenClassesDemo />,
  },
  "class-warm-palette": {
    title: "A warm dark palette from tokens",
    classes: [
      "bg-canvas",
      "bg-surface",
      "text-muted",
      "border-subtle",
      "rounded-card",
      "bg-danger-fill",
      "bg-selected",
      "bg-selected-soft",
      "border-selected",
      "font-heading",
      "h3",
      "ring-focus",
      "ring-offset-focus",
      "rounded-control",
      "shadow-raised",
      "text-accent-foreground",
      "text-danger-fill-foreground",
      "text-foreground",
      "text-placeholder",
      "text-selected",
      "text-selected-foreground",
    ],
    summary:
      "One wrapper that overrides custom properties only: warm surfaces, a serif heading, a light orange accent with dark text, flat cards and 600 for medium weight.",
    wide: true,
    snippet: `<style>
:root {
  --color-canvas: oklch(0.19 0.008 60);
  --color-surface: oklch(0.235 0.01 60);
  --color-foreground: oklch(0.94 0.012 80);
  --color-accent: oklch(0.705 0.19 47); /* the label turns dark by itself */
  --color-selected: oklch(0.33 0.012 60); /* keep the accent for the primary button */
  --font-heading: Georgia, serif; /* unset, headings inherit */
  --font-weight-medium: 600;
  --shadow-raised: none;
}
</style>`,
    render: () => <WarmPaletteDemo />,
  },
  "class-ink-palette": {
    title: "Ink palette",
    classes: ["text-muted", "rounded-primary", "border-subtle"],
    summary:
      "An opt-in dark palette that repaints the same tokens with a quieter surface scale and its own focus colour.",
    wide: true,
    snippet: `<html class="dark" data-theme="ink">
  <body class="theme-base">
    <nav style="background: var(--color-surface-rail)">…</nav>
  </body>
</html>`,
    render: () => <InkPaletteDemo />,
  },
} satisfies ClassDemoFragment
