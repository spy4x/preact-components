# `@preact-components/system`

Application chrome and platform integration: SEO, PWA updates, and the progressive-enhancement
components that have to render without JavaScript.

Extracted from `antonshubin.com`, `mig` and `financy`.

## Rules this package follows

- **Props and ports, never a global store.** `SEOHead` takes the page head as props,
  `ImageLightbox` takes an `onOpen` port, `SWUpdater` takes the service-worker container, the
  reload and the error ports. The only state a component owns is the state the browser handed it.
- **Server-renderable.** `document`, `navigator`, `location` and the clock are touched inside an
  effect, an event handler, or a pure function whose result the caller passes back in.
  `SWUpdater` renders `""` on the server, and `Calendar` takes `today` so a render is deterministic.
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the three glyphs
  these components draw (`IconChevronLeft`, `IconChevronRight`, `IconXMark`) rather than
  duplicating SVG.

## Components

| Component       | Subpath          | Ports / key props                                                               |
| --------------- | ---------------- | ------------------------------------------------------------------------------- |
| `SEOHead`       | `seo-head`       | `title`, `description`, `canonical`, `ogImage?`, `jsonLd?`, `noindex?`          |
| `SWUpdater`     | `sw-updater`     | `scriptUrl?`, `container?`, `updateMessage?`, `reload?`, `onUpdate?`            |
| `Calendar`      | `calendar`       | `monthAnchor`, `minDate`, `maxDate`, `slotsByDate`, `onSelectDate?`             |
| `ImageLightbox` | `image-lightbox` | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `zoomLabel?`, `onOpen?` |

Helpers, all pure: `head.ts` (breadcrumb derivation from a canonical URL, `createHeadStore`,
`humanizeSlug`) and `resolveImage` (click target → lightbox image). `date.ts`'s ISO day and month
arithmetic is private to this package — `Calendar`'s own dependency, kept out of the barrel and out
of `exports`.

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

## The calendar's keyboard

The whole grid is one Tab stop, and the focus moves inside it:

| Key                 | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| Arrow left / right  | a day back or on                                                   |
| Arrow up / down     | a week back or on                                                  |
| Home / End          | the first and last day of the week on screen, clipped to the month |
| Page Up / Page Down | the neighbouring month, through `onSelectMonth`, same day number   |

Every key the grid answers is cancelled with it, so paging a month does not scroll the page
underneath. A key it does not answer keeps the page's own behaviour: Page Up and Page Down do
nothing without `onSelectMonth`, because in link mode the month lives in the URL and a key press
that navigated the page is not something the dual-mode contract promises — the arrows are links
there, and Tab reaches them.

**The roving tabindex is applied by an effect, not rendered.** Taking Tab away from twenty-eight
cells is only safe once a key handler is there to give the movement back, so a page that has not
hydrated — no JavaScript, or an embedded render — keeps the natural tab order it always had.

A day that cannot be picked is still focusable and its accessible name is the reason it cannot be:
`19 August 2026 — no times available`. The same sentence is shown under the grid while it has
focus, for the reader who has no screen reader to read the cell out and no mouse to hover a
`title` with. The grid itself is a `grid` of `row`s and `gridcell`s named after the month it shows.

## The locale decides the week

Two things about a month grid are not the component's to decide, and both come from `Intl`:

- **which day the week starts on** — Monday across most of Europe, Sunday in the United States,
  Saturday across much of the Middle East, read from `Intl.Locale`'s week info;
- **how a weekday is abbreviated** — `Intl` already has an abbreviation per locale, and cutting it
  to two characters left every Arabic column reading `ال` and six of seven Vietnamese ones reading
  `Th`.

The day labels are the locale's too: a screen reader is read `9 February 2026` rather than
`2026-02-09`.

## Progressive enhancement

`ImageLightbox` makes the images inside a container zoomable through a `<dialog>` lightbox. It
renders nothing but that empty dialog, so a reader without JavaScript loses only the zoom. The
layer is delegated to the container: one listener instead of one per image, images that arrive
after hydration still work, and cleanup is complete.

**A zoomable image behaves like a button**, because that is what it has become. The component
gives every image it marks a tab stop, a button's role and a name saying what activating it does,
and both Enter and Space open the lightbox. Space is cancelled with them, exactly as a real button
cancels it, so the page does not scroll away under a reader who has just pressed it. A click and an
Enter press are cancelled too, which is what lets an image inside a link open the lightbox instead
of following the link.

The defaults name no particular kind of page: the container is `[data-lightbox]`, an attribute the
host puts where it wants the zoom layer, and an image with no `alt` is described as `Image`. What
the component puts on the host's images it takes off again when it unmounts.

## The service-worker contract

`SWUpdater` registers the worker and shows one bar: "New version available", with Reload and
Dismiss. Three things about it are the host's business rather than this package's.

**The container comes from `navigator`.** `globalThis.navigator.serviceWorker` is where a browser
keeps it; there is no `globalThis.serviceWorker` in a page. A host that already owns its
registration passes its own container as the `container` prop, which is also how a test drives the
component without a browser.

**The message is a contract with the worker.** Pressing Reload posts `{ action: "skipWaiting" }` to
the waiting worker, and the worker has to recognise it:

```js
self.addEventListener("message", (event) => {
  if (event.data?.action === "skipWaiting") self.skipWaiting()
})
```

A worker that speaks another dialect — `{ type: "SKIP_WAITING" }` is the other common one — takes
the message it expects through the `updateMessage` prop. Get this wrong and the button is silently
dead: nothing takes over, so nothing reloads.

**Only the tab that asked reloads.** `controllerchange` fires in every tab the new worker takes
over, so the listener that reloads is armed by the Reload button and not by the registration.
Without that, one visitor pressing Reload reloads every open tab, including the one with a
half-filled form, and a first install reloads the page mid-visit.

## Decisions worth knowing

- **Timezone-free grid arithmetic.** `mig` did its day maths and weekday lookups through a host
  timezone (`lib/tz.ts`). An ISO date carries no zone, so day steps in UTC cannot drift across a
  DST boundary and a weekday computed in UTC is the same weekday everywhere. A `timeZone` prop
  survives for the one question that genuinely needs it — which date is _today_ — plus an
  injectable `today` for deterministic renders.
- **No `Shell`, `Nav`, `Auth`, `Menu`, `Header`, `ProfileDropdown`, `ImageGallery`, `StateInit`,
  `LeadForm` or `NewsletterForm`.** Each one is in the table below with a reason.
- **`ImageLightbox` uses event delegation, not per-image listeners.** The source attached one
  listener per image and never removed them; delegation also survives images that appear after
  hydration. Escape needs no listener of its own: `<dialog>` closes natively and the `close` event
  clears the state, so the dialog and the state cannot disagree. A `MutationObserver` keeps the tab
  stops in step with images that arrive later, which delegation alone cannot do — a tab stop is an
  attribute on the image itself.
- **The lightbox image is positioned inside the dialog, not stretched across it.** A child that
  fills the dialog is a backdrop no click can ever land on, which is how the documented
  "click outside to close" went years without being true.
- **A month anchor the calendar does not have is refused, not clipped.** `Date.parse` rolled
  `2026-02-30` over into 2 March and said nothing, so the grid drew a month its caller never asked
  for. Clipping to 28 February would have been the other defensible answer; refusing is what the
  helpers already do for `10/08/2026`, and a caller who computed an impossible date is better told
  than quietly agreed with. A time zone the platform cannot resolve is the opposite case and gets
  the opposite answer: which zones exist is a property of the build's `Intl` data rather than of the
  caller's code, so an unknown one falls back to UTC instead of throwing out of the render.

## Not in this package

| Left out                            | Why                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Shell`, `Nav`, `Auth`              | Read app state (`state.auth`, `state.ws`), hardcode brand strings, and `gb`'s `Nav` runs an `effect()` at import time. Props-and-ports conversion is a redesign, not a port.                                      |
| `Menu`, `Header`, `ProfileDropdown` | Two source implementations of the same responsive header, both shaped around one app's markup and brand. The pieces worth keeping are the dual-mode contract and the a11y fixes, which landed in `Calendar`.      |
| `ImageGallery`                      | Snap-scroll strip plus an arrow-key lightbox. The lightbox half landed as `ImageLightbox`; the strip is a horizontal scroller whose drag and snap behaviour needs a DOM test harness this repo does not have yet. |
| `StateInit`                         | An app's SSR→client hydration bridge, with that app's env keys hardcoded.                                                                                                                                         |
| `LeadForm`, `NewsletterForm`        | Form chrome whose anti-bot fields (honeypot, page-load timestamp) and success states the host must render itself.                                                                                                 |
| `themeBootstrapScript()`            | The FOUC-free inline `<head>` script belongs with `ts-libs`, next to the other head-platform helpers.                                                                                                             |

## Tests

`deno task check` from the repository root runs this suite with the rest of the workspace. Every
component is rendered with `preact-render-to-string` and asserted on real markup: emitted head tag
sets, the dual-mode swap, and a 42-cell grid for a month that starts on any weekday.

Where a component only works against a browser API, that API is a sealed boundary the tests can
replace: `SWUpdater`'s listeners are driven by a fake registration, its registration by a fake
container through `startUpdates`, and `resolveImage` by an element stub. No jsdom, and no request
that a test not exist for a branch that only a browser reaches.

What a fake cannot prove is that the component finds a real browser's container at all — which is
exactly the bug every fake here was blind to. The proof lives in `pages/checks/system.ts` and
runs under `deno task --cwd pages verify`: headless Chromium registers the demo worker, a second
script at the same scope leaves a worker waiting, and the bar has to appear.

The same file carries the proof of everything on this page that is a key press, a focus change or a
click landing somewhere: no test here can reach any of them, because every one of them renders a
component to an HTML string. What a string render _can_ show — which element carries which role,
which column header holds which text, that a month anchor is refused — is asserted in
`calendar.test.tsx` and `date.test.ts`; everything else is in the browser file or is unproven.
