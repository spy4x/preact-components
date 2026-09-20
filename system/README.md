# `@preact-components/system`

Application chrome and platform integration: SEO, PWA updates, and the progressive-enhancement
components that have to render without JavaScript.

Extracted from `antonshubin.com`, `mig` and `financy`.

## Rules this package follows

- **Props and ports, never a global store.** `SEOHead` takes the page head as props,
  `BlogImageEnhancer` takes an `onOpen` port, `SWUpdater` takes the reload and error ports. The
  only state a component owns is the state the browser handed it.
- **Server-renderable.** `document`, `navigator`, `location` and the clock are touched inside an
  effect, an event handler, or a pure function whose result the caller passes back in.
  `SWUpdater` renders `""` on the server, and `Calendar` takes `today` so a render is deterministic.
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the three glyphs
  these components draw (`IconChevronLeft`, `IconChevronRight`, `IconXMark`) rather than
  duplicating SVG.

## Components

| Component           | Subpath               | Ports / key props                                                      |
| ------------------- | --------------------- | ---------------------------------------------------------------------- |
| `SEOHead`           | `seo-head`            | `title`, `description`, `canonical`, `ogImage?`, `jsonLd?`, `noindex?` |
| `SWUpdater`         | `sw-updater`          | `scriptUrl?`, `reload?`, `onUpdate?`, `onError?`                       |
| `Calendar`          | `calendar`            | `monthAnchor`, `minDate`, `maxDate`, `slotsByDate`, `onSelectDate?`    |
| `BlogImageEnhancer` | `blog-image-enhancer` | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `onOpen?`      |

Helpers, all pure: `head.ts` (breadcrumb derivation from a canonical URL, `createHeadStore`,
`humanizeSlug`), `date.ts` (ISO day and month arithmetic, weekday and month labels), and
`resolveImage` (click target → lightbox image).

```tsx
import { SEOHead } from "@preact-components/system"

<SEOHead
  title="Widgets — Acme"
  description="Widgets for teams."
  canonical="https://acme.example/products/widgets"
  siteName="Acme"
  ogImage="https://acme.example/og/widgets.png"
/>
```

`SEOHead` renders a fragment of `<title>`, `<meta>`, `<link>` and one `<script type=
"application/ld+json">`; the host framework decides where head tags go. `seoHeadTags()` returns the
same set as data for a head pipeline that is not a component tree, and it is what the tests assert
on.

The JSON-LD `@graph` always ends with a `BreadcrumbList` derived from the canonical URL, so
structured data agrees with a breadcrumb trail the host renders from the same
`breadcrumbsFromCanonical` helper (`head.ts`). It is skipped when the trail would be the root entry
alone, and the whole script tag is skipped when the graph is empty.

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

## Progressive enhancement

`BlogImageEnhancer` makes images inside rendered prose zoomable through a `<dialog>` lightbox. It
renders nothing but that empty dialog, so a reader without JavaScript loses only the zoom. The
click layer is delegated to the container: one listener instead of one per image, images that
arrive after hydration still work, and cleanup is complete.

## Decisions worth knowing

- **Timezone-free grid arithmetic.** `mig` did its day maths and weekday lookups through a host
  timezone (`lib/tz.ts`). An ISO date carries no zone, so day steps in UTC cannot drift across a
  DST boundary and a weekday computed in UTC is the same weekday everywhere. A `timeZone` prop
  survives for the one question that genuinely needs it — which date is _today_ — plus an
  injectable `today` for deterministic renders.
- **No `Shell`, `Nav`, `Auth`, `Menu`, `Header`, `ProfileDropdown`, `ImageGallery`, `StateInit`,
  `LeadForm` or `NewsletterForm`.** Each one is in the table below with a reason.
- **`BlogImageEnhancer` uses event delegation, not per-image listeners.** The source attached one
  listener per image and never removed them; delegation also survives images that appear after
  hydration. Escape needs no listener of its own: `<dialog>` closes natively and the `close` event
  clears the state, so the dialog and the state cannot disagree.

## Not in this package

| Left out                            | Why                                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Shell`, `Nav`, `Auth`              | Read app state (`state.auth`, `state.ws`), hardcode brand strings, and `gb`'s `Nav` runs an `effect()` at import time. Props-and-ports conversion is a redesign, not a port.                                                            |
| `Menu`, `Header`, `ProfileDropdown` | Two source implementations of the same responsive header, both shaped around one app's markup and brand. The pieces worth keeping are the dual-mode contract and the a11y fixes, which landed in `Calendar`.                            |
| `ImageGallery`                      | Snap-scroll strip plus an arrow-key lightbox. The lightbox half landed as `BlogImageEnhancer`; the strip is a horizontal scroller whose drag and snap behaviour needs a DOM test harness this repo does not have yet.                   |
| `StateInit`                         | An app's SSR→client hydration bridge, with that app's env keys hardcoded.                                                                                                                                                               |
| `LeadForm`, `NewsletterForm`        | Form chrome whose anti-bot fields (honeypot, page-load timestamp) and success states the host must render itself.                                                                                                                       |
| `themeBootstrapScript()`            | The FOUC-free inline `<head>` script belongs with `ts-libs`, next to the other head-platform helpers.                                                                                                                                   |

## Tests

`deno task check` from the repository root runs this suite with the rest of the workspace. Every
component is rendered with `preact-render-to-string` and asserted on real markup: emitted head tag
sets, the dual-mode swap, and a 42-cell grid for a month that starts on any weekday.

Where a component only works against a browser API, that API is a sealed boundary the tests can
replace: `SWUpdater`'s listeners are driven by a fake registration, and `resolveImage` by an
element stub. No jsdom, and no request that a test not exist for a branch that only a browser
reaches.
