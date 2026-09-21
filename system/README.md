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
  `SWUpdater` renders its empty live region and nothing else on the server, and `Calendar` takes
  `today` so a render is deterministic.
- **A live region is always present and empty.** See below; it is a library-wide rule, not a
  `SWUpdater` one.
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the three glyphs
  these components draw (`IconChevronLeft`, `IconChevronRight`, `IconXMark`) rather than
  duplicating SVG.

## Components

| Component       | Subpath          | Ports / key props                                                                 |
| --------------- | ---------------- | --------------------------------------------------------------------------------- |
| `SEOHead`       | `seo-head`       | `title`, `description`, `canonical`, `crumbs?`, `ogImage?`, `jsonLd?`, `noindex?` |
| `SWUpdater`     | `sw-updater`     | `scriptUrl?`, `container?`, `updateMessage?`, `reload?`, `onUpdate?`              |
| `Calendar`      | `calendar`       | `monthAnchor`, `minDate`, `maxDate`, `slotsByDate`, `onSelectDate?`               |
| `ImageLightbox` | `image-lightbox` | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `zoomLabel?`, `onOpen?`   |

Helpers, all pure: `head.ts` (`normalizeCanonical`, `canonicalUrl`, `breadcrumbItems`,
`breadcrumbListJsonLd`, `createHeadStore`) and `resolveImage` (click target → lightbox image).
`date.ts`'s ISO day and month arithmetic is private to this package — `Calendar`'s own dependency,
kept out of the barrel and out of `exports`.

```tsx
import { SEOHead } from "@preact-components/system"

<SEOHead
  title="Widgets — Acme"
  description="Widgets for teams."
  canonical="https://acme.example/products/widgets"
  siteName="Acme"
  ogImage="https://acme.example/og/widgets.png"
  crumbs={[
    { name: "Home", href: "/" },
    { name: "Products", href: "/products" },
    { name: "Widgets" },
  ]}
/>
```

`SEOHead` renders a fragment of `<title>`, `<meta>`, `<link>` and one `<script type=
"application/ld+json">`; the host framework decides where head tags go. `seoHeadTags()` returns the
same set as data for a head pipeline that is not a component tree, and it is what the tests assert
on.

Every string the component prints came in as a prop — the title, the description, the site name,
each crumb's name. It has no user-visible string of its own and therefore no label to default or
to override.

## The canonical address is cleaned before it is published

Search engines and social networks read what this component emits, so the address is parsed rather
than trusted. `normalizeCanonical` keeps the three parts that identify a page — the origin, the
path and the query — and drops the rest:

| Handed in                           | Published                       |
| ----------------------------------- | ------------------------------- |
| `https://acme.example/a#reviews`    | `https://acme.example/a`        |
| `https://user:pw@acme.example/a`    | `https://acme.example/a`        |
| `https://ACME.Example:443/a?page=2` | `https://acme.example/a?page=2` |
| `https://acme.example`              | `https://acme.example/`         |

A fragment names a position inside a page rather than a page, and it used to produce a
`BreadcrumbList` identifier of `…#frag#breadcrumb`, which nothing could ever match. Credentials in
an address that a search engine indexes are credentials published.

**An address that is not an `http`/`https` page throws**, and so does a relative one:
`javascript:alert(1)`, `data:…` and `/products/widgets` are all refused before a single tag
exists. This is the same split `Calendar` makes between an impossible month anchor and an unknown
time zone. A canonical address is the route's own arithmetic — it built the address out of an
origin and a path — so a wrong one is a caller error and is better told than quietly agreed with.
A time zone the platform cannot resolve is the opposite case, a property of the build, and falls
back. The two alternatives here are worse in a way nobody would notice: omitting the tag publishes
a page with no canonical address, and there is no origin to fall back to that would not be
invented.

## Breadcrumbs are the caller's

The JSON-LD `@graph` ends with a `BreadcrumbList` built from the `crumbs` prop: root first, the
current page last with no `href`. Every `item` is absolute, so a crumb `href` may be relative to
the page and is normalised exactly as the canonical address is.

Nothing derives a crumb from the path any more. Deriving one assumed every path segment is a page
with a readable name, so `/section/24/title` published a crumb named `24` linking to
`/section/24`, and a route had no way to say otherwise. A page that states fewer than two crumbs
gets no `BreadcrumbList` at all — a one-item trail is noise in a rich result — and the whole
script tag is skipped when the graph is empty.

One consequence worth knowing: the page title is no longer part of the structured data. It used to
arrive there as the name of the last derived crumb, and now it appears only where a caller puts
it.

## The head store is per request

`createHeadStore(defaults)` is a factory, and on a server it is called **where a request is
handled** — not at module level. A module-level store is one signal shared by every request the
process serves, so one visitor's title can be rendered onto another visitor's page. It is the same
bug as a shared theme store, and it only appears under concurrency, which is to say in production
and not in a test.

```ts
function handler(request: Request) {
  const { head, setHead } = createHeadStore(siteDefaults)
  setHead({ title: "Widgets", canonical: new URL(request.url).href })
  return renderPage(head.value)
}
```

In a browser there is one document and one store, created where the app is created and handed to
the layout and to any island that changes the title.

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

**What that evidence is, and is not.** Every accessibility claim in this file is a claim about
markup and focus order, read back from the DOM in headless Chromium by `pages/checks/system.ts`.
No screen reader has been run against any of it. The one place where the markup and what a reader
would actually hear can plausibly come apart is the decision below to keep the peek days out of the
accessibility tree: a row then exposes fewer cells than `aria-colcount` promises, and `aria-colindex`
is there to keep the columns numbered, unverified by ear.

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

## A live region is always present and empty

**Every component in this library that announces something renders its live region from the first
render, empty, and puts the message into it later.** This is a library-wide decision rather than a
detail of one component, and the reason is the same everywhere: assistive technology announces a
_change_ to a region it is already watching, and commonly says nothing at all about a region that
arrives with its message already inside it. Marking an element that only exists once it has
something to say therefore buys nothing.

Two components follow it today. `SWUpdater` is below, and `Toastr` in `ui/` keeps its stack in the
page with zero toasts in it. `Combobox` in `ui/` is the third place the rule applies and **does not
follow it yet**: the paragraph that reports "No matches" is rendered only when there are no answers,
so that region is created carrying its message, which is the shape this section exists to remove.
`ui/README.md` records it as a known limit and issue #186 is open to fix it — this section is not
saying the combobox is already done.

**Where to mount it.** `SWUpdater`'s region carries no class, so it is an ordinary in-flow element
with no padding, no border and no minimum height: empty, it is zero pixels tall and paints nothing.
That is not the same as costing nothing everywhere, because a parent can space a child that has no
height. Measured in Chromium, against a column of two 24px paragraphs that is 64px tall on its own:

| Parent                     | Empty region in it | Cost |
| -------------------------- | ------------------ | ---- |
| plain block flow           | 64px               | 0px  |
| Tailwind `space-y-4`       | 64px               | 0px  |
| `flex` column with `gap-4` | 80px               | 16px |
| `grid` with `gap-4`        | 80px               | 16px |

A `gap` is allocated for every child, height or no height, so a gapped flex or grid parent pays one
whole gap for an element nobody can see. `space-y-*` costs nothing because it works by margins, and
the margin it puts on the region collapses with the one on the element above it. **So mount
`<SWUpdater />` where its parent does not use `gap`** — as a direct child of `<body>`, or of a plain
layout container. `Toastr`'s stack never faces this question, because it is laid out `fixed` and is
out of flow wherever it is mounted.

What an always-present region costs everywhere is one more node in the accessibility tree, which is
the trade being made.

**No screen reader has been run against this repository.** What is demonstrated is markup and the
order in which the DOM changes — the region is in the page first, and the message arrives as a
mutation of that same element — which is the footing this decision rests on. It is not a
demonstration that any particular screen reader speaks. `pages/checks/system.ts` parks a reference
to the region and a `MutationObserver` on it before an update is made ready, so a check cannot pass
by finding a region that arrived carrying text.

## The service-worker contract

`SWUpdater` registers the worker and shows one bar: "New version available", with Reload and
Dismiss. Four things about it are the host's business rather than this package's.

**The live region is always there; the bar is not.** The component renders one unstyled
`role="status"` element with `aria-live="polite"` and `aria-atomic="true"` on every render, on the
server included, and that is its entire output until a worker is waiting. The bar, its Reload
button and its Dismiss control appear inside that element when there is an update and leave it
again when there is not, so the message is a change to a region rather than a region carrying a
message. `aria-atomic` is set although `role="status"` already implies it, so a reader announces
the whole sentence and its two controls rather than the one text node that changed.

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

**A dismissal covers one update, not the component.** Pressing Dismiss empties the live region and
takes the bar off the page; the next update to be reported puts it back, so the message leaves the
region and later arrives in it again as a fresh change. A permanent dismissal would mean a visitor
who put one version away was never told about any version after it.

## Decisions worth knowing

- **A canonical address that is not a web page is refused, not printed and not omitted.** Throwing
  puts the failure where the mistake is, in the route that built the address, at the moment it
  renders. Omitting `<link rel="canonical">` would publish a page that looks finished and tells a
  search engine nothing, and there is no origin this package could fall back to without inventing
  one. Credentials and a fragment are dropped rather than refused, because both are meaningless on
  a published address and the page behind them is perfectly real.
- **The structured-data escaping was left exactly as it was.** `jsonLdText` escapes `<` to
  `<`, and it was attacked with `</script>` payloads in the page title, in the caller's own
  JSON-LD entities and in a crumb name. The rendered markup kept exactly one opening and one
  closing script tag every time. There was nothing to fix, so nothing was changed.
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
