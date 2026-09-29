# UI guide design

The guide is the library's showcase, so it is built from the library: its layout components, its
named gaps, its buttons, its install box and its combobox keyboard logic. Every gap on the page is a
named gap or a step of the spacing scale (`docs/spacing.md`); none is picked per element. This file
is the design the shell (`shell.tsx`), the card (`card.tsx`) and the search (`search.tsx`)
implement, and what every section's pull request under #328 follows. Inspiration came from the
documentation sites of shadcn/ui, Radix, Mantine and Tailwind UI; no code came from any of them.

## Layout grid and breakpoints

| Width         | Columns                                        | What changes                                           |
| ------------- | ---------------------------------------------- | ------------------------------------------------------ |
| below `lg`    | one: the page                                  | the navigation is a drawer behind the header's menu    |
| `lg` (1024px) | navigation 15rem · page                        | the navigation is a sticky column                      |
| `xl` (1280px) | navigation 15rem · page · "On this page" 13rem | the page's cards move from the navigation to the right |

The whole frame is at most `max-w-screen-2xl` wide and centred. The side gutter is `Page`'s: 16 px
on a phone, 24 px from `sm`, 32 px from `lg`. The columns are `xl` (32 px) apart. The overview and
the served document of every page have no "On this page" list, so their content takes both right-hand columns.

The page column is a container (`@container`), and the card grid lays out by the column's width, not
the window's: one column below 42rem (`@2xl`), two from there.

## Which gap goes where

| Between                                               | Gap         | Size                |
| ----------------------------------------------------- | ----------- | ------------------- |
| header controls                                       | `sm`        | 8 px                |
| a navigation group's title and its links, the links   | none        | 0 (links pad 4 px)  |
| navigation groups                                     | `lg`        | 24 px               |
| the parts of a page's header (package, title, lead)   | `md`        | 16 px               |
| a page's header and its first section, two sections   | `2xl`       | 48 px               |
| a section's heading and its description               | `xs`        | 4 px                |
| a section's header and its cards                      | `lg`        | 24 px               |
| cards in the grid                                     | `md`        | 16 px               |
| the overview's hero, app, why, start, packages, rules | `2xl`       | 48 px               |
| the overview's "why" tiles, its steps                 | `md`        | 16 px               |
| the page column and the header, top and bottom        | `xl` / `12` | 32 px, 48 from `lg` |

A guide section is a group of cards with its own heading, so sections are `2xl` apart, the gap
`docs/spacing.md` gives groups of sections, rather than `Page`'s `xl`.

Inside a card: the header, the demo canvas and the props summary each have a 16 px inset on a phone
and 24 px from `sm`; the card's name and its sentence are `xs` apart.

## Type scale

One font family everywhere, the theme's sans; monospace only for code, package names and prop types.

| Role                   | Size and weight                        |
| ---------------------- | -------------------------------------- |
| overview headline      | `text-3xl`, `sm:text-5xl`, bold, tight |
| page title (`h1`)      | `text-3xl`, `sm:text-4xl`, bold, tight |
| page lead              | `text-base`, `sm:text-lg`, muted       |
| section title (`h2`)   | `text-2xl`, semibold, tight            |
| card name (`h3`)       | `text-base`, semibold                  |
| card sentence, nav     | `text-sm`                              |
| group titles, captions | `text-xs`, semibold, muted             |

## Surfaces

Two, and never a bordered box inside a bordered box:

- **The page**: the host's canvas colour (`theme-base`: gray-100 light, gray-900 dark).
- **The card**: `bg-surface` (white, or gray-800 in the dark palette), a 1px `border-subtle`, a
  small shadow and a rounded-xl corner. In light the card is a step brighter than the page, which is what makes it read
  as a card.

The demo sits on a **canvas band** across the card: the page's colour showing through with a faint
16 px dot grid, divided from the card's header and footer by hairlines, not boxed. The code block is
the one dark surface (`bg-scrim-strong`, so it stays dark in both palettes), and it is code, not a container.

The preset paints a table with the surface colour in the dark palette (`theme/preset.css`, "Chrome
the popup is painted by"). A demo band must not show that as a box: the guide's own props table
opts out with `bg-transparent`, and `Bars`, which renders a table, does the same in its own package
(#337). A lane that finds another component boxed this way fixes it in that component's package.

Accent is the purple of the theme: the current page and card in the navigation, the package name,
and the class chips. The primary button stays the theme's primary. The guide's own chrome writes
that purple; the components in the cards draw the theme's accent scale (`bg-accent-900`,
`theme/README.md` → "Accent"), so the demo host's accent switch repaints the cards and leaves the
chrome purple, which is how a reader tells the two apart.

## The card

In order, top to bottom:

1. **Name**: the component's own name (`Badge`), or the card's title for a class card.
2. **One plain sentence** on what it is for. Written as inline Markdown (`` `code` `` and
   `**strong**`, `markdown.tsx`), so no literal backtick reaches the page; a sentence that needs
   more is JSX in `description`.
3. **The demo** on its canvas.
4. **Props summary**, optional: the few props a reader reaches for first, with type, default and
   one sentence. The README stays the full reference. A prop name never breaks mid-word (#400):
   names and types wrap with `overflow-wrap: break-word`, not `anywhere`, and a name too long for
   its column wraps at a camel-case hump, where the card puts a `<wbr>` (`conflict`/`Removed`/
   `Message`). `pages/checks/ui-guide.ts` locates every line break inside a name at 1440, 1024 and
   390 px.
5. **Code**: a disclosure row, closed by default, with the copy button pinned to the row so the
   snippet copies without opening it. Opened on a phone, the code scrolls inside its block: a long
   line is never clipped by the card.

The card's API is the registry's `Demo`: `summary`, `description?`, `snippet`, `render`, `wide?` and
`props?`. `wide: true` gives a card the full row: a table, a chart, a form, anything that needs
room. `wide: false` says it shares a row. A section that has not been moved to this design leaves
`wide` out, and the grid then widens a card whose demo holds a table or a menu, as the old grid did.
Every migrated card says `wide: true` or `wide: false`; the Charts page is the model.

The two cards of a row share its height, so the pair reads as one row and no hole opens beside the taller card. A short output sits on a taller canvas
instead; when that canvas would be mostly empty, pair the card with a similar one or make it wide.

**No holes.** Normal cards fill the row two at a time. The last card of an odd run of normal cards
(before a wide card, or at the end of the section) takes the whole row (`cardSpans` in `shell.tsx`).
Cards keep their order: no dense packing, so reading order and visual order agree.

## Navigation

Grouped, in this order: **Start here** (Overview), then **Packages** (UI, Icons, Theme, Charts, Map,
System, CRUD). There is no page of every page, and no page for a package of helpers alone: the guide
shows components. Group titles are small and muted; links are one font and one size, and a long name wraps rather than being cut.

Under the page showing, below `xl` only: its sections, when it has more than one, and its cards.
From `xl` the "On this page" column lists both, so the side navigation lists pages alone. The links
stay in the document, hidden, so the section or card a route names is still marked. The current page
has a tinted background; the current section or card a purple left rule.

A page's section heading is kept for the outline but hidden when it would repeat the page's own
heading: on a page of one section, and on a section named like its page (Charts → Charts).

## Header

Sticky, 56 px (`h-14`), translucent over the page. Left: the menu button (below `lg`), the library's
name, and its version in a quiet grey pill (from `sm`). Right: search, the author link when the host
passes an `author` ("Made by …", quiet grey text, from `xl` only), the repository link named "Star
on GitHub" (a GitHub mark, with the words from `xl`), the theme switch when the host passes its
`colorScheme`, and the host's own `actions`. Below `xl` the author link lives in the footer alone,
so a phone's header keeps room for its controls. The switch says
what a press does: its name is "Switch to dark mode" (or light) at every width, with a moon or sun,
and from `md` the words "Dark mode" (or "Light mode"), which the name contains. Every word is a
label with an English default.

**Search** is a field-shaped button from `sm` (an icon button on a phone) that opens a modal dialog.
It searches page titles, component names and class card titles, ranked exact, prefix, substring, then place. The arrows, Home, End and Enter are the
library's combobox keys; Escape or a click outside closes it. `/` and Ctrl+K (⌘K) open it.

## "On this page"

At `xl`, a sticky right-hand column lists the page's cards, grouped under links to their sections
when there are more than one. The first card in view (below the header, in the top half of the
window) is marked with `aria-current="location"` and a purple rule. Clicking a card follows the
card's own route, which marks the card and scrolls to it.

## Phone drawer

Below `lg` the navigation is a native modal `<dialog>` from the left, at most 20rem or 85% of the
window: a sticky row with the library's name and a close button, then the same grouped navigation,
the current page's sections and cards included. Escape, the close button and following a link close
it; focus returns to the menu button.

## Overview

A landing page for a developer deciding whether to install the library (#400). The two actions it
leads to are the install line and "Star on GitHub"; the author is credited quietly, in the header and
the footer, with no sales block. In order, `2xl` apart:

1. **Hero.** The library's name as a small monospaced eyebrow, a one-line headline (the page's
   `h1`), the tagline, then **Browse components** (primary) and **Star on GitHub** (outline, only
   when the host passes `repository`), the install line with its copy button, and the totals:
   components, icons and packages.
2. **See it in an app.** One wide card, the same `DemoCard` every package page uses, whose demo is
   a live mini app (`mini-app.tsx`): a framed dashboard with a status filter (a labelled `role="group"` of toggle buttons, not a landmark, laid out as a
   row below the frame's `@3xl`), `Kpi` tiles, a `LineChart`, a sortable `DataTable`, a "Run
   checks" button that raises a `Toastr` toast from `createToastStore`, and a "New project"
   `Modal` holding a `Field` form that adds a row. It runs on local state only, with neutral demo
   data (project names, no people, prices or invoices); it draws the accent scale, so the header's
   dark and accent switches repaint it. Its code sits in the card's code row, one click away.
3. **Why preact-components.** Six plain facts, one tile each with an icon, a title and a sentence:
   web standards, server render then hydrate, keyboard and focus proven in a real browser, no
   third-party UI kit, themed by tokens, MIT licence. None carries a number.
4. **Get started.** Three numbered steps, each a full-width card: the step's number, title and
   sentence on the left, what it hands over on the right (stacked below `@3xl`). Add the styles:
   the theme's install line, one line that fits a phone, and a link to its README's build step. Use
   a component: one snippet under a file-name bar that holds its copy button, so the button never
   covers code, with lines short enough to fit a 390 px column without scrolling. Read on:
   `docs/usage.md` and the README of every published package, the guide's own included.
   `pages/checks/ui-guide.ts` holds all of it at 1440 and 390 px: no copy button over code, no
   box that clips code without scrolling, every command on one line inside its box, the snippet
   unscrolled.
5. **Packages**: a grid of every package page, with its specifier, one plain sentence (`summary` in
   `registry.ts`, not the page's longer lead) and its card count. The tiles in a row share a height.
6. **Design rules**: the theme's classes and page conventions, in one card.

**Every number is computed.** The totals, each package tile's count and the "Get started" README
list come from the registry, the icon set and `libraryPackageIds` (`overview.tsx`: every package
page, the helper packages, and the guide itself — every package the workspace publishes, which a
test reads from the `deno.json` files), never from a number in a sentence. `overview.test.tsx`
renders the overview and the footer and takes out only the computed counts, the step numbers, the
live demo's own canvas (its rows, KPI values and chart labels are demo data), code blocks, and the
class names the design rules list in code; any digit left in a heading, a card title or summary, an
inline code span in a sentence or the footer fails it. It also calls the English count sentences
with numbers no registry has, so a count written into one of them fails too.

**The overview's own chrome stays purple**, like the rest of the guide's (see "Surfaces" above):
the eyebrow, the links, the step numbers and the "why" icons. What the header's accent switch
repaints is the library's components — the buttons, the mini app — which is how a reader tells the
two apart.

## Footer

On every page, under the navigation and the page column, divided from them by a hairline, at the
frame's gutter. Left: the library's name and one line. Right, a `Cluster` `md` apart: "Source on
GitHub" (when the host passes `repository`), "Packages on JSR", "MIT licence" (a link to `LICENSE`
when there is a repository, plain words otherwise), "Design system by Eirene" (#258, `CREDITS.md`)
and "Made by …" (when the host passes `author`). Links are quiet grey text, underlined.
