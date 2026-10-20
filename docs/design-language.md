# Design language

One house style for every app built on this library, so that a person who uses two of them can
tell they were made by the same hand, and can still tell at a glance which app they are in.

The rule in one sentence: **everything is shared except the brand hue** (plus, for the owner's
personal sites only, a warm neutral palette and a serif display face). Type, spacing, radius,
elevation, motion, icons, components, layouts and words are the same everywhere.

This page decides what an app looks like. The library already implements most of it: the tokens
in [`theme/README.md`](../theme/README.md), the spacing rules in [`spacing.md`](./spacing.md), and
the components in the [live guide](https://spy4x.github.io/preact-components). Where this page
asks for something the library cannot do yet, "What the library still lacks" at the end says so.

## Why one language

The apps grew one at a time, and each one picked its own look: five accents, five font setups,
three dark palettes and card radii from 12 to 16 px. A person moving from the Seed site to the Seed
app changed font, dark palette and logo on one click. Each app also carried its own copies of
buttons, cards and menus, so a fix in the library reached some apps and not others. A shared
language fixes both: the apps feel related, and the work of making one look good is done once.

## What every app shares

### Type

- **Font: Geist Sans for all text, Geist Mono for code, numbers in tables are Geist Sans with
  tabular figures.** Geist is built for interfaces, is tight without being cold, has a matching
  mono, and ships as one variable file per family, so every weight costs nothing extra. Inter was
  the alternative; it is on every second product and gives no identity.
- **Self-hosted, never loaded from a font CDN at run time.** Variable woff2, subset to the scripts
  the app needs, `font-display: swap` with a metric-matched fallback face so the swap does not move
  the layout. Preload the sans file only. A font CDN leaks every visit to a third party, needs a
  wider Content Security Policy, and fails offline, which an offline-first app cannot accept.
- **Set it once per app**, in the app's own `@theme` block, because the library declares no font
  token ([`theme/README.md`](../theme/README.md), "Fonts"):

  ```css
  @theme {
    --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  ```

- **Weights:** 400 body, 500 labels, buttons and in-app headings, 600 marketing headings, 700 a
  marketing hero only.
- **Scale.** Tailwind's own sizes only, never an arbitrary `text-[17px]`:

  | Role                                | Phone       | From `lg`   | Weight and tracking    |
  | ----------------------------------- | ----------- | ----------- | ---------------------- |
  | Marketing hero `h1`                 | `text-4xl`  | `text-6xl`  | 700, `tracking-tight`  |
  | Marketing page `h1`                 | `text-3xl`  | `text-5xl`  | 600, `tracking-tight`  |
  | Marketing section `h2`              | `text-2xl`  | `text-4xl`  | 600, `tracking-tight`  |
  | App page title (`PageHeader`)       | `text-xl`   | `text-2xl`  | 500                    |
  | App section title (`Section`, card) | `text-base` | `text-lg`   | 500                    |
  | Lead paragraph                      | `text-lg`   | `text-xl`   | 400, muted             |
  | Body                                | `text-base` | `text-base` | 400                    |
  | Secondary, table cell               | `text-sm`   | `text-sm`   | 400, muted where quiet |
  | Rail and tab bar label              | `text-xs`   | `text-xs`   | 500                    |
  | Eyebrow above a marketing `h2`      | `text-sm`   | `text-sm`   | 500, mono, accent text |
  | Code                                | `text-sm`   | `text-sm`   | Geist Mono 400         |

- **Measure.** Paragraphs at most `max-w-2xl` (about 65 characters). Headings use `text-balance`,
  paragraphs `text-pretty`.
- **Case.** Sentence case for every heading, button, label and menu item. Uppercase only for the
  tiny labels the library already draws that way (a `Kpi` label, a table group), with
  `tracking-wide`.

### Spacing and width

- The library's scale and named gaps, nothing else: `0 px 1 2 3 4 6 8 12 16`
  ([`spacing.md`](./spacing.md)). Pages are built from `Page`, `Section`, `Stack`, `Cluster` and
  `Grid`; a component's root carries no margin.
- Section bands on a marketing page are `py-12` on phones and `py-16` from `lg`; a hero adds
  nothing larger. `py-20` and `py-24` are not on the scale.
- Content widths, by what the column holds:

  | Column                                   | Width       |
  | ---------------------------------------- | ----------- |
  | Sign-in, sign-up, a one-form page        | `max-w-md`  |
  | Reading text, a settings or account page | `max-w-2xl` |
  | Lists, tables, dashboards in an app      | `max-w-5xl` |
  | Marketing sections                       | `max-w-6xl` |

  Inputs never stretch across a wide column.

### Shape, elevation and surfaces

- **Radius: the library's three tokens, unchanged in every app.** `--radius-control` 6 px for a
  field or chip, `--radius-primary` 8 px for a button, `--radius-card` 12 px for a card, a dialog,
  a screenshot frame. Pills (`rounded-full`) for avatars, badges and toggle chips only. An app
  does not override them: radius changes how an app feels more than any colour does, so it stays
  the same everywhere.
- **Surfaces: two steps.** The page is `--color-canvas`, a card is `--color-surface` one step
  lighter, with a 1 px `--color-border-subtle` hairline. That step does most of the work a shadow
  would.
- **Shadows: two.** `--shadow-raised` on a card in the light palette only; `--shadow-popover` on a
  menu, dialog or tooltip. In the dark palette a card has no shadow (it cannot show on near-black);
  a raised frame there gets a 1 px border and an inner top highlight instead.
- **No card inside a card**, no card around a single line, no dashed box inside a card: an empty
  section inside a card is `<EmptyState inset />`, in the place of its `CardBody`.

### Motion

- **Only motion that explains a change.** Colour and border transitions on hover and focus at
  150 ms; a menu, dialog or toast enters in 150 to 200 ms with `ease-out` and leaves faster. A
  linked card may lift by 1 px on hover.
- **Never:** scroll-triggered reveals, parallax, bouncing, a spinner that holds content back for
  effect, an animation longer than 300 ms.
- **Reduced motion is honoured everywhere:** transitions and transforms sit under
  `@media (prefers-reduced-motion: no-preference)`, and so does `scroll-behavior: smooth`.

Tailwind's `duration-150` and `ease-out` express all of this; there are no motion tokens.

### Icons

- **Only `@spy4x/preact-icons`**: no emoji as icons, no second icon set, no hand-pasted SVG. An
  icon that is missing is added to the library.
- **Outline style on a 24-unit grid**, `size-5` beside text and `size-4` inside a dense row, drawn
  in `currentColor` so it takes the text colour. A filled glyph only for a selected state.
- **An icon never stands alone without a name:** a label beside it, or an accessible name on the
  icon-only button and a tooltip for sighted users.

### Colour, apart from the brand hue

- **Neutrals** are the library's grays: canvas, surface, three border strengths, foreground,
  muted. An app draws with the token classes (`bg-surface`, `text-muted`, `border-subtle`), never
  with a fixed `gray-*`, `white` or `black` (the theme README, "Replacing fixed colours", lists the
  swaps).
- **Status colours** are the library's danger, warning, success and info tokens in every app. They
  are never the brand hue, and the brand hue is never one of them.
- **The accent is for the one primary action and for "current".** One accent-filled button per
  view. Links, headings, icons and borders are not accent-coloured by default; a link is
  foreground text with an underline on hover.
- **Colour never carries meaning alone.** A status has a word and an icon too (`StatusMark`,
  `Badge` with text).

### Dark mode

- **Every product has a light and a dark palette and follows the system by default.** The choice
  (System, Light, Dark) sits in the user menu or the settings page, through the library's
  `ThemeToggle` and `createThemeStore`; `themeBootstrapScript` sets the class before the first
  paint, so a dark-mode user never sees a white flash.
- **The house dark is near-black, not slate.** Products use the library's ink surfaces
  (`INK_CSS` and `data-theme="ink"`: canvas `oklch(0.15 0.012 260)`, card `oklch(0.26 0.014 260)`)
  with their own brand hue, not the default gray-900. Never pure `#000`, never gray text that
  falls under 4.5:1.
- **A marketing site or personal site may be dark-only.** It then declares
  `color-scheme: dark`, so scrollbars, autofill and native controls match.
- `theme-color` and a web app manifest's `background_color` equal the canvas of the palette in
  use, with one `<meta name="theme-color">` per `prefers-color-scheme`.

### Layout patterns

Pick the shell by the kind of app; all of them are library components.

| Kind of app                       | Shell                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product (SPA)                     | `AppShell`: a 72 px icon rail from `md` at every desktop width, with a tooltip on each icon; the workspace switcher on top, the destinations in the middle, notifications and the account menu at the bottom. No top bar and no brand mark: the page starts with its `PageHeader`. On a phone, a bottom tab bar of at most four destinations, whose last slot (the avatar, "Account") opens a sheet with the rest.                                                                                                               |
| Admin panel                       | The same `AppShell` as its product, with no switcher. An "Admin" badge in neutral gray under the avatar in the account cell, "Admin" as the phone's last tab and "Admin" in every page title keep an operator from mistaking it for the product.                                                                                                                                                                                                                                                                                 |
| Marketing site                    | `SiteHeader` (sticky through its `class` prop, one call to action on the right, a disclosure menu on phones) and `SiteFooter`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Personal site                     | `Rail` with labels: the same zones, cells and current style as an app's rail, in an 88 px column with wider cells and a short label under each icon, because first-time visitors do not know the icons. The portrait sits in the top slot as a `RailEntry` and links home; the one primary action (Book) is pinned first. On a phone, a tab bar with the primary action in the centre and "More" last; pages the column does not list (Home, About) are `sheetOnly` rows of its sheet, and the footer goes in `Rail`'s `footer`. |
| Single-page tool (a status board) | A top bar with the brand mark and the page's one control (a search box), then the content column. No rail.                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Every signed-in page starts with `PageHeader`:** the title on the left; the one primary action
and, if needed, one "More actions" menu on the right. On a phone the title stays on one line and
the actions become icon buttons with accessible names. Nothing else draws a page title.

**Placement** follows how often a person needs a control: daily on the page, monthly one click
away, once or never in a menu or a "Danger zone" disclosure at the bottom. Forms open when asked,
in a `Modal` for a short form or `InlineEdit` for one value. What cannot happen is not shown. The
full set, written for the template, is in its `docs/design/ui-layout.md`, and holds for every
product.

### App shell

Every app (every product SPA and its admin panel) uses `AppShell` and draws no chrome of its own.
An app chooses only its brand hue, its destinations and its content.

- **Rail.** 72 px (`w-18`) from `md`, `bg-surface` with a right hairline. Cells are 48 px squares
  with a 24 px icon, 4 px apart, at `--radius-primary`. The current destination is a filled
  rounded square in `--color-surface-active` with the icon in the nav-active colour; hover is the
  canvas step. Each icon has a tooltip on its right, 8 px past the rail, after 300 ms of hover or
  at once on keyboard focus. Escape hides it. A control an app draws in a zone, such as the
  switcher, sits in a `RailCell` and wears `railFocusRing`, so its tooltip and ring match.
- **Zones.** The top holds the switcher, a 40 px tile. The middle holds the destinations and is
  the only part that scrolls on a short screen. The bottom holds the connection while it is not
  live, the bell with its unread count, and the account avatar (32 px) opening `AccountMenu`.
- **Labels variant.** An 88 px column (`w-22`) with 80 × 56 px cells, 4 px of padding inside, and
  a `text-xs` label under each icon, used on the personal site. It has no tooltips at all, a
  `RailCell`'s included. On touch-only screens, where tooltips cannot appear, the icons variant
  shows its labels too, in 64 px cells inside its 72 px column. A link a site draws in a zone,
  such as its portrait, is a `RailEntry`, so it is drawn exactly as the rail's own entries; a site
  writes no rail CSS.
- **Content.** One centred column, `px-4 md:px-8`, `py-6 sm:py-8`: 48 rem by default, 64 rem for
  tables. Screens never set a width.
- **Phone.** Below `md`, a 64 px tab bar of at most four destinations plus the account slot, which
  opens a sheet with the switcher, the rest, notifications and the account menu. Offline shows as a
  strip on top of the tab bar.
- **Counts** sit on the icon's top-right corner and read "99+" above 99.

### Component patterns

| Need                    | Use                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A form                  | `EnhancedForm` with `Field`s in one column, labels above inputs, hint under the label, the submit button last and right-aligned (full width on a phone). Pending disables it.                         |
| Field errors            | Under the field, tied with `aria-describedby`; focus moves to the first error. An error no field owns sits under the form, never in a toast. The invalid field's border turns danger, focused or not. |
| A list or table         | `DataTable` or `Table`; numbers right-aligned with tabular figures; row actions in a `MoreMenu`; archived rows behind a filter, not mixed in.                                                         |
| Nothing in a list yet   | `EmptyState`: one line on what will appear here, one action that adds the first item. No paragraph of explanation. Inside a `Card`, `inset` drops the dashed box.                                     |
| Something failed        | `ErrorState` in place of the content, saying what happened and what to do, with a retry. A failed background action gets a toast with a retry.                                                        |
| Loading                 | Nothing for the first 300 ms, then `LoadingSkeleton` shaped like the content. `LoadingSpinner` only inside a button or a small inline area. Never a full-page spinner.                                |
| Confirmation of success | The change itself is the confirmation. A toast (`Toastr`) only for something that happened out of view, or that can be undone.                                                                        |
| Destructive action      | `ConfirmDialog` naming the thing and the consequence; the danger button says the verb ("Delete note"). A password re-check uses a `Modal` with a danger submit.                                       |
| Settings                | `SettingList` and `SettingRow`, grouped by `SettingGroup`; a toggle applies at once, a text value through `InlineEdit`.                                                                               |
| Create or edit a record | Its editor page at `/<entity>/new` and `/<entity>/:id`, one component for both.                                                                                                                       |
| Status                  | `Badge` with a word, or `StatusMark` with icon and word. Never a coloured dot alone.                                                                                                                  |
| A row of chips          | `ToggleChips` for filters an island owns, one or many pressed; `RadioChips` for one choice that must work without JavaScript.                                                                         |

`RadioChips` draws the same chip on native radios in a `<fieldset>` named by its `<legend>`, so it
renders and switches server-side: the browser keeps the choice, arrow keys move it within one tab
stop, and page CSS can follow it through `:has(#id:checked)`. Reach for it on a marketing page or
a demo that works with JavaScript off, and inside a plain form; an island may still pass `value`
and `onChange`. Never draw a local radio look-alike.

`ThemePreview` is the one way to show components in both palettes on one page: a `RadioChips` pair,
Dark first and checked, over a frame that takes the chosen palette while the page keeps its own.
Use it on a page that sells or documents the library; never repaint a whole page to show light and
dark.

### Words

- **Plain, short, sentence case.** "Create note", not "Submit"; "Delete group", not "Confirm".
  A button names the verb and, when it helps, the object.
- **One wording per action across an app**: the header button, the empty state and the help text
  all say "Book a free 30-minute call", never three variants.
- **Errors say what happened and what to do next**, without blame and without "Oops": "We could
  not save the note. Check your connection and try again."
- **No exclamation marks, no jokes in errors, no fake urgency.** Numbers as digits; dates, times
  and money formatted with `Intl` in the person's locale.
- An empty state talks about what the person will get, not about the system: "Your notes will
  appear here."

### Accessibility bar

WCAG 2.2 AA in both palettes, checked, not assumed:

- Text 4.5:1, large text and control boundaries 3:1, on every surface it can sit on.
- Everything works from the keyboard, focus is always visible (the library's ring, 2 px with a
  2 px gap), and focus moves on purpose after a step, a dialog or an error.
- Touch targets at least 44 px on a phone (`min-h-11`); 36 px from `sm` with a pointer.
- Nothing scrolls sideways at 320 px; the page works zoomed to 200 %.
- Every control has a label, every icon-only button an accessible name, every image a text
  alternative or `alt=""`.
- An app's browser tests run axe-core through `@axe-core/playwright` on its main screens in both
  palettes.

## What each app chooses

Three things, and only these.

### 1. A brand hue (every app)

One OKLCH hue, the app's own, from which the library derives the whole accent scale
([`theme/README.md`](../theme/README.md), "Accent"). The app sets two tokens on `:root` and nothing
else:

```css
:root {
  --color-primary: oklch(0.48 0.19 262);
  --color-accent: oklch(0.48 0.19 262); /* the same, so the dark palette follows */
}
```

Rules for picking it:

- **Lightness 0.38 to 0.5**, so a white label reads at 4.5:1 or better on the fill and the colour
  works as text on the canvas, at any hue. Keep the chroma inside sRGB at that lightness and hue,
  so the hex value and the OKLCH value name the same colour.
- **At least 30° of hue from every other app's hue**, so two apps never look alike in a tab bar.
- **Clear of the status hues**: red (about 25°), orange and amber (about 50 to 75°) and green (about
  140 to 155°). A brand that reads as "error" or "done" weakens both.
- **Everything with a colour uses it:** the primary button, the brand mark, the favicon, the PWA
  icon, the selected state. No second accent hides in a dashboard or a logo.

Hues assigned (most apps have not moved to theirs yet):

| App                            | Hue                     | Light accent                       |
| ------------------------------ | ----------------------- | ---------------------------------- |
| Seed (template) and this guide | purple, 305°            | `oklch(0.381 0.176 305)` `#59168b` |
| financy                        | blue, 262°              | `oklch(0.48 0.19 262)` `#1853c6`   |
| oko                            | azure, 228°             | `oklch(0.5 0.095 228)` `#0a6d8e`   |
| mig                            | teal, 178°              | `oklch(0.5 0.09 178)` `#097463`    |
| caldav-tasks-web               | raspberry, 350°         | `oklch(0.5 0.19 350)` `#ab1d72`    |
| The owner's personal sites     | orange, 47° (see below) | `#f97316` with a dark label        |

The wheel is nearly full. The one gap left that keeps 30° from every hue above and from the status
hues is about 105° (chartreuse, at a lightness of 0.5 or less so the white label still works). An app after that
shares a neighbour's hue at a clearly different lightness, which is the owner's call. Add a row
here in the same change that gives an app its hue.

### 2. Neutral temperature (the owner's personal sites only)

Products use the library's cool neutrals (hue about 260). The owner's personal sites, his
freelance site and company card, use a warm near-black palette (page `#15120f`, card `#25211d`,
text `#efebe2`) and are dark-only. The warm palette says "a person", the cool one "a product";
mixing them across products would blur that line.

### 3. A display face (the owner's personal sites only)

Headings on the personal sites may be set in **Literata 600** through `--font-heading`, with body
text in Geist. Products use Geist for headings too. One sans across every product is the
strongest same-hand signal there is; the serif is reserved for the places where the owner speaks
as himself. Leads and card copy stay in the body face, so the serif marks headlines only.

The personal sites' orange is lighter than the hue rules above allow, because it was chosen as a
single bright "Book" button on a dark page. It keeps the near-black label
(`--color-accent-foreground`) and appears on that one action only; focus and "current" are drawn
in the text colour, never in orange.

### The brand mark

Every app's mark has the same construction: a rounded square at `--radius-card`, filled with the
brand hue, holding one simple white glyph, followed by the app's name in Geist 500. The same
square, without the name, is the favicon (an SVG) and the PWA icon. The mark belongs to the
favicon, the PWA icon and the public site; a signed-in app's chrome draws none, because its
sidebar starts with the workspace switcher. The `<title>` and manifest name say the product's
name, never "template".

## Taste

Taste is mostly what we leave out. Concrete pairs:

| Do                                                                                       | Don't                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| One accent-filled button per view; everything else quieter.                              | Accent on the button, the links, the icons and the headings at once.                     |
| Status as a short word in a quiet tint, with an icon when it matters.                    | A saturated block of red, green and blue on every row of a table.                        |
| Canvas and surface one step apart, a hairline border, no shadow in dark mode.            | A drop shadow on every card, a card inside a card, a border on every side of everything. |
| Real screenshots of the product on its marketing site, in both palettes.                 | Stock illustrations, gradient text, emoji standing in for icons.                         |
| Numbers right-aligned with tabular figures, units in muted text.                         | Centred numbers that jitter as they change.                                              |
| A skeleton shaped like the content after 300 ms.                                         | A full-page spinner, or a skeleton that flashes for 50 ms.                               |
| An empty state with one line and one action.                                             | Three paragraphs explaining why the list is empty.                                       |
| Sentence case, plain verbs, one wording per action.                                      | Title Case Buttons, "Submit", "Oops!", the same action named three ways.                 |
| Near-black dark mode with readable muted text (4.5:1).                                   | Pure black, or gray text at 3:1 because it "looks subtle".                               |
| Fonts and icons self-hosted, from the house set.                                         | Fonts from a CDN, a second icon set, a hand-drawn SVG in one place.                      |
| Rare actions in a menu; destructive ones confirmed.                                      | Every action on the page at once, a red button beside "Save".                            |
| The page works and reads without JavaScript where the app can (a marketing site always). | A blank page until the bundle loads.                                                     |

### The bar, by kind of app

What to take from each reference, not what to copy. Their markup and code are never a source
([`no-third-party-components.md`](./no-third-party-components.md)).

**Product (SPA)**

- **Linear**: restraint. One accent, near-black dark mode, keyboard first, a command palette,
  nothing on screen that is not needed now.
- **Things 3**: calm typography and spacing; small, purposeful motion; an empty state that feels
  finished.
- **Stripe Dashboard**: forms and tables that respect the reader; tabular numbers; error messages
  that say what to do.
- **Cal.com**: an open-source product that still looks crafted; a public booking page that is a
  single obvious flow.

**Admin panel**

- **Stripe Dashboard**: a detail page per record with its history; dense tables with filters
  that live in the address bar.
- **Vercel dashboard**: quiet chrome, status shown with a word and a mark, logs readable at a
  glance.
- **Supabase Studio**: an open-source admin that stays usable with thousands of rows.

**Marketing site**

- **Linear's site**: the product itself as the hero, few words, generous space.
- **Plausible**: honest copy, open prices, a page a reader can skim in a minute; the tone we want.
- **Resend**: typography and code samples carry the page; dark mode done properly.

**Personal site**

- **rauno.me**: craft in the small details; every interaction considered.
- **paco.me**: a minimal page that still has a voice.
- **brianlovin.com**: work, writing and links in one calm structure.
- **Stripe Press**: serif display type that feels editorial without being old-fashioned.

## Adopting the language in an app

1. Update to the library's latest version and import `TOKENS_CSS`, `PRESET_CSS` and `INK_CSS`.
2. Set the brand hue (two tokens) and the fonts (`@theme`); remove any copied token values and any
   `gray-*` classes the token classes replace.
3. Replace local look-alikes (buttons, fields, cards, menus, theme toggles, shells) with the
   library components; anything missing goes to the library first.
4. Put the brand mark, favicon, PWA icon, `theme-color` and manifest colours on the brand hue and
   the canvas.
5. Screenshot the main screens at 390 and 1440 px in both palettes, look at the phone ones first,
   and run axe-core on them.

An app that cannot import the library (a Go page with no build, a static HTML card) copies the
token values it uses into one block, with a comment naming this page and the library version it
copied from.

## What the library still lacks

Smallest change first, and whether it is needed now.

1. **Icons mix stroke widths.** 65 glyphs draw at 2, 41 at 1.5 and 10 at other widths, so two
   icons side by side can look like two sets. The fix is to redraw the 1.5 and odd ones at one
   width (2, the majority). **Needed with the first app that aligns,** because that is when the
   mix shows up on one screen.
2. **The filled `Badge` is a saturated block.** A quiet tint (a light fill in the tone's colour
   with the tone's text colour) is what the taste table asks for. The smallest change is to make
   the existing filled style that tint, using the `*-soft` tokens the theme already has. **Needed
   with the first app that aligns its status badges;** it changes how every app's badges look, so
   it ships as its own release.
3. **No shared font files.** Every app self-hosts its own copy of Geist. A package that ships the
   files would need JSR to serve fonts, which it does not as an export. **Not needed now:** each app
   copies the variable woff2 from the pinned `geist` npm package, with the licence beside it.
4. **No warm neutral palette.** The personal sites set their warm values themselves through the
   tokens, which works. **Not needed now;** revisit if a third site wants it.
5. **Headings draw heavier than the type scale.** `PageHeader` draws its title at weight 600 and
   switches size at `sm`; the `Section` title is `text-xl` to `text-2xl`; the `Card` title is
   `text-lg` at 600. The table above asks for weight 500 and smaller section titles. The fix is to
   move those three to the table's values. **Needed with the first app that aligns,** in one
   release, because it changes every app's headings.

No motion tokens, radius options or per-app font options are needed.
