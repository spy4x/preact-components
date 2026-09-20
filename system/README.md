# `@preact-components/system`

Application chrome and platform integration: SEO, PWA updates, and the progressive-enhancement
components that have to render without JavaScript.

Extracted from `antonshubin.com`, `mig` and `financy`.

## Rules this package follows

- **Props and ports, never a global store.** `SEOHead` takes the page head as props, `ThemeToggle`
  takes a `mode` and reports the next one, `SWUpdater` takes the reload and error ports. The only
  state a component owns is the state the browser handed it.
- **Server-renderable.** `document`, `navigator`, `location` and the clock are touched inside an
  effect, an event handler, or a pure function whose result the caller passes back in.
  `SWUpdater` renders `""` on the server, and `Calendar` takes `today` so a render is deterministic.
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the five glyphs
  these components draw (`IconChevronLeft`, `IconChevronRight`, `IconSun`, `IconMoon`,
  `IconThemeAuto`, `IconSpinner`, `IconXMark`) rather than duplicating SVG.

## Components

| Component           | Subpath               | Ports / key props                                                      |
| ------------------- | --------------------- | ---------------------------------------------------------------------- |
| `SEOHead`           | `seo-head`            | `title`, `description`, `canonical`, `ogImage?`, `jsonLd?`, `noindex?` |
| `Breadcrumb`        | `breadcrumb`          | `items`, `label?`, `separator?`                                        |
| `SWUpdater`         | `sw-updater`          | `scriptUrl?`, `reload?`, `onUpdate?`, `onError?`                       |
| `Calendar`          | `calendar`            | `monthAnchor`, `minDate`, `maxDate`, `slotsByDate`, `onSelectDate?`    |
| `ThemeToggle`       | `theme-toggle`        | `mode`, `onChange`, `placeholder?`                                     |
| `BlogImageEnhancer` | `blog-image-enhancer` | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `onOpen?`      |
| `BookingSubmit`     | `booking-submit`      | `label`, `fields?` \| `validate?`, `timeZoneField?`, `readTimeZone?`   |

Helpers, all pure: `head.ts` (breadcrumb derivation from a canonical URL, `createHeadStore`,
`humanizeSlug`), `date.ts` (ISO day and month arithmetic, weekday and month labels),
`flatten-routes.ts` (children-first, most-specific-first ordering for a `wouter` `<Switch>`),
`resolveImage` (click target → lightbox image), and `fieldProblem` / `emailProblem` / `gateSubmit`
/ `resolveTimeZone` for the submit gate.

```tsx
import { Breadcrumb, SEOHead } from "@preact-components/system"
import { breadcrumbsFromCanonical } from "@preact-components/system/head"

<SEOHead
  title="Widgets — Acme"
  description="Widgets for teams."
  canonical="https://acme.example/products/widgets"
  siteName="Acme"
  ogImage="https://acme.example/og/widgets.png"
/>
<Breadcrumb items={breadcrumbsFromCanonical(page.canonical, page.title)} />
```

`SEOHead` renders a fragment of `<title>`, `<meta>`, `<link>` and one `<script type=
"application/ld+json">`; the host framework decides where head tags go. `seoHeadTags()` returns the
same set as data for a head pipeline that is not a component tree, and it is what the tests assert
on.

The JSON-LD `@graph` always ends with a `BreadcrumbList` derived from the canonical URL, so
structured data and the visible trail cannot disagree. It is skipped when the trail would be the
root entry alone, and the whole script tag is skipped when the graph is empty.

## The dual-mode contract

`Calendar` renders `<button>` when the caller supplies a select handler and `<a href>` when it does
not. One definition therefore serves the hydrated island and the no-JS or embedded fallback, and
the URL stays the source of truth in both:

```tsx
<Calendar {...month} onSelectDate={(date) => navigate(`?date=${date}`)} />  // island
<Calendar {...month} dateHref={(date) => `?date=${date}`} />                // SSR / no JS
```

The same rule covers the month arrows, with one addition: a month with nothing to show renders an
inert `<span aria-disabled>`, because a `pointer-events-none` anchor is still focusable and still
navigable with Enter.

## Progressive enhancement beyond the forms

`BlogImageEnhancer` makes images inside rendered prose zoomable through a `<dialog>` lightbox. It
renders nothing but that empty dialog, so a reader without JavaScript loses only the zoom. The
click layer is delegated to the container: one listener instead of one per image, images that
arrive after hydration still work, and cleanup is complete.

`BookingSubmit` is the other half of the form story — a `type="submit"` button that validates
locally first, so the "Confirming…" spinner only ever appears for a request that is genuinely in
flight, moves focus to the first invalid control, sets `aria-busy`, and captures the visitor's
timezone from `Intl` into a hidden field for the server. Field rules, the validator, the timezone
field name and the copy are all props; the rules are checked with arktype, not a hand-rolled
regex.

## Decisions worth knowing

- **Timezone-free grid arithmetic.** `mig` did its day maths and weekday lookups through a host
  timezone (`lib/tz.ts`). An ISO date carries no zone, so day steps in UTC cannot drift across a
  DST boundary and a weekday computed in UTC is the same weekday everywhere. A `timeZone` prop
  survives for the one question that genuinely needs it — which date is _today_ — plus an
  injectable `today` for deterministic renders.
- **No `Shell`, `Nav`, `Auth`, `Menu`, `Header`, `ProfileDropdown`, `ImageGallery`, `StateInit`,
  `LeadForm` or `NewsletterForm`.** Each one is in the table below with a reason.
- **The submit gate is a pure function.** `gateSubmit()` takes a reader, a `prevent` and a
  `focus` callback, so the branch that matters — blocked vs let through, and which control gets
  focus — is tested without a DOM, and the component's `onClick` is a thin adapter over it.
- **`BookingSubmit` does not disable itself while busy.** A disabled submit control can stay
  disabled for the life of the page when the browser cancels the navigation, which is exactly the
  stuck-spinner state the pre-validation exists to prevent.
- **`BlogImageEnhancer` uses event delegation, not per-image listeners.** The source attached one
  listener per image and never removed them; delegation also survives images that appear after
  hydration. Escape needs no listener of its own: `<dialog>` closes natively and the `close` event
  clears the state, so the dialog and the state cannot disagree.
- **`ThemeToggle` holds no preference.** A `signals/theme.ts` store would have coupled the library
  to one app's storage; `mode` + `onChange` lets the app own persistence, and an absent `mode`
  means "not read yet", which is exactly the SSR case. The FOUC-free `<head>` bootstrap script
  stays app-side.

## Not in this package

| Left out                            | Why                                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Shell`, `Nav`, `Auth`              | Read app state (`state.auth`, `state.ws`), hardcode brand strings, and `gb`'s `Nav` runs an `effect()` at import time. Props-and-ports conversion is a redesign, not a port.                                                            |
| `Menu`, `Header`, `ProfileDropdown` | Two source implementations of the same responsive header, both shaped around one app's markup and brand. The pieces worth keeping are the dual-mode contract and the a11y fixes, which landed in `Calendar`.                            |
| `ImageGallery`                      | Snap-scroll strip plus an arrow-key lightbox. The lightbox half landed as `BlogImageEnhancer`; the strip is a horizontal scroller whose drag and snap behaviour needs a DOM test harness this repo does not have yet.                   |
| `StateInit`                         | An app's SSR→client hydration bridge, with that app's env keys hardcoded.                                                                                                                                                               |
| `LeadForm`, `NewsletterForm`        | Form chrome whose anti-bot fields (honeypot, page-load timestamp) and success states the host must render itself. `BookingSubmit` carries the generalisable half: pre-validation, focus-first-invalid, busy state and timezone capture. |
| `themeBootstrapScript()`            | The FOUC-free inline `<head>` script belongs with `ts-libs`, next to the other head-platform helpers.                                                                                                                                   |

## Tests

`deno task check` from the repository root runs this suite with the rest of the workspace. Every
component is rendered with `preact-render-to-string` and asserted on real markup: emitted head tag
sets, breadcrumb hiding and `aria-current`, the dual-mode swap, a 42-cell grid for a month that
starts on any weekday, the theme cycle, route ordering, and the submit gate's blocked/allowed
branches with the exact focus target each one produces.

Where a component only works against a browser API, that API is a sealed boundary the tests can
replace: `SWUpdater`'s listeners are driven by a fake registration, `gateSubmit` by a reader and
two callbacks, and `resolveImage` by an element stub. No jsdom, and no request that a test not
exist for a branch that only a browser reaches.
