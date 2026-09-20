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

import type { ClassDemoFragment } from "../registry.ts"

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
          The body is the only part with a padding floor of its own: a header and a footer already
          carry theirs, so a card with all three needs no spacing utilities between them.
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
    <div class="card max-w-md">
      <div class="card-body">
        <div class="scrollbar flex gap-3" data-e2e="scrollbar">
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
        <p class="mt-2 text-xs text-muted" data-e2e="scrollbar-note">
          Twelve chips, one 28rem box: the row scrolls, the card does not.
        </p>
      </div>
    </div>
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
        <li>`.list-ul` is the one list rule: disc markers, inside, one step down in size.</li>
        <li>
          <a class="link" href="#surfaces">`.link`</a>{" "}
          underlines on its own, and drops the underline on hover.
        </li>
      </ul>
      <p class="text-xs text-muted">
        `.page-layout` is the horizontal frame around all of it: `mx-auto max-w-6xl space-y-4`.
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
    <div class="grid max-w-md gap-3">
      <div class="grid grid-cols-2 gap-3">
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
      </div>
      <table class="w-full text-sm">
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
    </div>
  )
}

/** Every colour atom the preset ships, on the element it was written for. */
function ColourAtomsDemo() {
  return (
    <div class="grid gap-4 text-sm">
      <div class="grid gap-1">
        {["text-primary", "text-muted", "text-danger", "text-warning", "text-success"].map(
          (name) => <span key={name} class={name}>{name}</span>,
        )}
      </div>

      <div class="flex flex-wrap gap-2">
        {["bg-primary", "bg-danger", "bg-warning", "bg-success"].map((name) => (
          <span key={name} class={`${name} rounded-primary px-2 py-1 text-xs text-white`}>
            {name}
          </span>
        ))}
      </div>

      <div class="flex flex-wrap gap-2">
        {["border-primary", "border-subtle", "border-control"].map((name) => (
          <span key={name} class={`${name} border px-2 py-1 text-xs`}>{name}</span>
        ))}
      </div>

      <div class="flex flex-wrap gap-2">
        <span class="bg-canvas border-subtle rounded-primary border px-2 py-1 text-xs">
          bg-canvas — page
        </span>
        <span class="bg-surface border-subtle rounded-primary border px-2 py-1 text-xs">
          bg-surface — card
        </span>
        <span class="rounded-primary bg-primary px-2 py-1 text-xs text-white">
          rounded-primary
        </span>
      </div>
    </div>
  )
}

export const surfaceDemos = {
  "class-card": {
    title: "Card",
    classes: ["card", "card-header", "card-body", "card-footer", "link", "text-muted"],
    summary:
      "The four-part surface: `.card` is the frame, and `.card-header`/`.card-body`/`.card-footer` carry their own padding and the border between them, so the parts are spacing-free in composition.",
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
    classes: ["scrollbar", "card", "card-body", "border-subtle", "rounded-primary", "text-muted"],
    summary:
      "`.scrollbar` turns a flex row into a horizontal scroller with a 4px thumb instead of the platform's full-height bar. It sets the overflow only — the height belongs to the content.",
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
      "`.h1`–`.h5` are type-scale utilities, `.list-ul` and `.link` are the two text affordances, and `.page-layout` is the standard frame: `mx-auto max-w-6xl space-y-4 lg:space-y-8`. Apply them to whatever element is semantically right.",
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
      "`.kpi` is the tile, `.kpi-label` the caption above its value. `.bar` is a width-less bar — the caller sets the length — and `.num` right-aligns a cell with tabular figures so a column of numbers lines up.",
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
      "bg-danger",
      "bg-warning",
      "bg-success",
      "border-primary",
      "border-subtle",
      "border-control",
      "bg-canvas",
      "bg-surface",
      "rounded-primary",
    ],
    summary:
      "Every colour the preset exposes as a utility, read through `var(--color-*, fallback)`: text, fill, border and the two surfaces. `.rounded-primary` is the radius the same way, so a box and a button share one corner rounding.",
    snippet: `<span class="text-danger">text-danger</span>
<span class="bg-success rounded-primary px-2 py-1 text-xs text-white">bg-success</span>
<span class="border-control border px-2 py-1 text-xs">border-control</span>
<span class="bg-canvas border-subtle border px-2 py-1 text-xs">bg-canvas</span>`,
    render: () => <ColourAtomsDemo />,
  },
} satisfies ClassDemoFragment
