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
the all-pages document have no "On this page" list, so their content takes both right-hand columns.

The page column is a container (`@container`), and the card grid lays out by the column's width, not
the window's: one column below 42rem (`@2xl`), two from there.

## Which gap goes where

| Between                                             | Gap         | Size                |
| --------------------------------------------------- | ----------- | ------------------- |
| header controls                                     | `sm`        | 8 px                |
| a navigation group's title and its links, the links | none        | 0 (links pad 4 px)  |
| navigation groups                                   | `lg`        | 24 px               |
| the parts of a page's header (package, title, lead) | `md`        | 16 px               |
| a page's header and its first section, two sections | `2xl`       | 48 px               |
| a section's heading and its description             | `xs`        | 4 px                |
| a section's header and its cards                    | `lg`        | 24 px               |
| cards in the grid                                   | `md`        | 16 px               |
| the overview's hero, example, packages and rules    | `2xl`       | 48 px               |
| the page column and the header, top and bottom      | `xl` / `12` | 32 px, 48 from `lg` |

A guide section is a group of cards with its own heading, so sections are `2xl` apart, the gap
`docs/spacing.md` gives groups of sections, rather than `Page`'s `xl`.

Inside a card: the header, the demo canvas and the props summary each have a 16 px inset on a phone
and 24 px from `sm`; the card's name and its sentence are `xs` apart.

## Type scale

One font family everywhere, the theme's sans; monospace only for code, package names and prop types.

| Role                   | Size and weight                        |
| ---------------------- | -------------------------------------- |
| overview title         | `text-4xl`, `sm:text-5xl`, bold, tight |
| page title (`h1`)      | `text-3xl`, `sm:text-4xl`, bold, tight |
| page lead              | `text-base`, `sm:text-lg`, muted       |
| section title (`h2`)   | `text-2xl`, semibold, tight            |
| card name (`h3`)       | `text-base`, semibold                  |
| card sentence, nav     | `text-sm`                              |
| group titles, captions | `text-xs`, semibold, muted             |

## Surfaces

Two, and never a bordered box inside a bordered box:

- **The page**: the host's canvas colour (`theme-base`: gray-50 light, gray-900 dark).
- **The card**: white, or gray-800 at 60% in the dark palette, a 1px border and a rounded-xl corner.

The demo sits on a **canvas band** across the card: the page's colour showing through with a faint
16 px dot grid, divided from the card's header and footer by hairlines, not boxed. The code block is
the one dark surface, and it is code, not a container.

The preset paints a table with the surface colour in the dark palette (`theme/preset.css`, "Chrome
the popup is painted by"). A demo band must not show that as a box: the guide's own props table
opts out with `bg-transparent`, and `Bars`, which renders a table, does the same in its own package
(#337). A lane that finds another component boxed this way fixes it in that component's package.

Accent is the purple of the theme: the current page and card in the navigation, the package name,
and the class chips. The primary button stays the theme's primary.

## The card

In order, top to bottom:

1. **Name**: the component's own name (`Badge`), or the card's title for a class or example card.
2. **One plain sentence** on what it is for. Written as inline Markdown (`` `code` `` and
   `**strong**`, `markdown.tsx`), so no literal backtick reaches the page; a sentence that needs
   more is JSX in `description`.
3. **The demo** on its canvas.
4. **Props summary**, optional: the few props a reader reaches for first, with type, default and
   one sentence. The README stays the full reference.
5. **Code**: a disclosure row, closed by default (open on an example card, whose code is its
   content), with the copy button pinned to the row so the snippet copies without opening it.

The card's API is the registry's `Demo`: `summary`, `description?`, `snippet`, `render`, `wide?` and
`props?`. `wide: true` gives a card the full row: a table, a chart, a form, anything that needs
room. `wide: false` says it shares a row. A section that has not been moved to this design leaves
`wide` out, and the grid then widens a card whose demo holds a table or a menu, as the old grid did.
An example card (`Example` in `example.tsx`) takes the same `wide?`, `props?` and `description?`.
Every migrated card says `wide: true` or `wide: false`; the Charts page is the model.

In a component section the two cards of a row share its height, so the pair reads as one row. In
an example section each card keeps its own height (`items-start`): an output is often three lines,
and stretching it to its neighbour's would leave a tall empty canvas.

**No holes.** Normal cards fill the row two at a time. The last card of an odd run of normal cards
(before a wide card, or at the end of the section) takes the whole row (`cardSpans` in `shell.tsx`).
Cards keep their order: no dense packing, so reading order and visual order agree.

## Navigation

Grouped, in this order: **Start here** (Overview, Everything), **Components** (UI, System, CRUD,
Charts, Map), **Helpers** (Signals, cn), **Foundations** (Theme, Icons). Group titles are small and
muted; links are one font and one size, and a long name wraps rather than being cut.

Under the page showing, below `xl` only: its sections, when it has more than one, and its cards.
From `xl` the "On this page" column lists both, so the side navigation lists pages alone. The links
stay in the document, hidden, so the section or card a route names is still marked. The current page
has a tinted background; the current section or card a purple left rule.

A page's section heading is kept for the outline but hidden when it would repeat the page's own
heading: on a page of one section, and on a section named like its page (Charts → Charts).

## Header

Sticky, 56 px (`h-14`), translucent over the page. Left: the menu button (below `lg`), the library's
name, and its version in a quiet grey pill (from `sm`). Right: search, the repository link, the
theme switch when the host passes its `colorScheme`, and the host's own `actions`. The switch says
what a press does: its name is "Switch to dark mode" (or light) at every width, with a moon or sun,
and from `md` the words "Dark mode" (or "Light mode"), which the name contains. Every word is a
label with an English default.

**Search** is a field-shaped button from `sm` (an icon button on a phone) that opens a modal dialog.
It searches page titles, component names, example and class card titles, and every helper an
example covers, ranked exact, prefix, substring, then place. The arrows, Home, End and Enter are the
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

A landing page, not a list:

1. The library's name, one sentence on what it is, and the install line
   (`deno add jsr:@spy4x/preact-ui`) with its copy button.
2. **Browse components**, and the totals: live cards, icons, packages.
3. **A first example**: one wide card with a live `Cluster` of buttons and a badge and its code.
4. **Packages**: a grid of every package page, with its specifier, one plain sentence (`summary` in
   `registry.ts`, not the page's longer lead) and its card count. The tiles in a row share a height.
5. **Design rules**: the theme's classes and page conventions, in one card.
