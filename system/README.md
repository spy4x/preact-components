# `@spy4x/preact-system`

Application chrome and platform integration: SEO, PWA updates, and the progressive-enhancement
components that have to render without JavaScript.

Extracted from earlier source applications.

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
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the four glyphs
  these components draw (`IconChevronLeft`, `IconChevronRight`, `IconXMark`, `IconBars3`) rather
  than duplicating SVG.
- **`ui/` is a sibling dependency.** `Shell` and `AuthForm` already import individual `ui/`
  components (`Avatar`, `Dropdown`; `Button`, `Field`, `Input`); `ImageLightbox` now does too,
  opening `@spy4x/preact-ui`'s shared `Lightbox` instead of rendering its own dialog. `crud/`
  imports `ui/` the same way.

## Components

| Component       | Subpath          | Ports / key props                                                                                                    |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AuthForm`      | `auth-form`      | `mode`, `step`, `onModeChange?`, `onSignIn?`, `onSignUp?`, `onOneTimeCode?`, `busy?`, `error?`, `labels?`, `action?` |
| `SEOHead`       | `seo-head`       | `title`, `description`, `canonical`, `crumbs?`, `ogImage?`, `jsonLd?`, `noindex?`, `twitterCard?`                    |
| `SWUpdater`     | `sw-updater`     | `scriptUrl?`, `container?`, `updateMessage?`, `reload?`, `onUpdate?`                                                 |
| `Calendar`      | `calendar`       | `monthAnchor`, `minDate`, `maxDate`, `availableByDate`, `onSelectDate?`                                              |
| `ImageLightbox` | `image-lightbox` | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `zoomLabel?`, `previousLabel?`, `nextLabel?`, `onOpen?`      |
| `SiteHeader`    | `site-header`    | `links`, `currentPath?`, `brand`, `actions?`, `labels?`                                                              |
| `Shell`         | `shell`          | `navItems`, `currentPath?`, `brand`, `user`, `userMenuItems?`, `status?`, `children`, `labels?`, `class?`            |
| `StateInit`     | `state-init`     | `data`, `id?` — paired with `readStateInit(id?, source?)`                                                            |
| `RailShell`     | `rail-shell`     | `items`, `currentKey?`, `currentPath?`, `primary?`, `navigate?`, `children`, `labels?`, `class?`                     |

Helpers, all pure: `head.ts` (`normalizeCanonical`, `canonicalUrl`, `breadcrumbItems`,
`breadcrumbListJsonLd`) and `resolveImage` (click target → lightbox image). `head.ts` also exports
`createHeadStore`, a factory that builds a fresh signal-backed store on every call, so it is not
one of the pure ones — see below. `date.ts`'s ISO day and month arithmetic is private to this
package — `Calendar`'s own dependency, kept out of the barrel and out of `exports`.

```tsx
import { SEOHead } from "@spy4x/preact-system"

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

## `twitter:card` is derived, not fixed

A page with no preview image should not claim a large one. `twitter:card` is `summary_large_image`
when `ogImage` is given and `summary` when it is not; `twitterCard` overrides the derivation for a
caller who knows better — an `ogImage` too small for a large card, or a page with no `ogImage` that
still wants `summary_large_image` for a reason of its own. Both directions are allowed: nothing
here checks that an overridden `summary_large_image` has an image to go with it, the same way
nothing here second-guesses a caller-supplied `title`.

`app` and `player` are Twitter/X card types too, but each needs data `PageHead` has no field for —
per-platform app ids, or a player iframe URL and its pixel size — so they are left out of
`TwitterCard`; a caller who wants one renders it beside `SEOHead` rather than through it.

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

That browser store outlives a page, and `resetHead()` exists for it. `setHead` merges a patch into
the current head, so it clears only a field the patch names, with the value `undefined`. The next
page a client-side navigation shows does not know what the previous page set — its `noindex`, its
`crumbs` — so it cannot name those fields, and whatever it leaves unnamed it inherits. A reset is
the one call that clears them without that list: reset first, then patch. A store created per
request is thrown away with the request and never needs a reset.
The defaults are copied when the store is created, so changing the object afterwards does not
change what a reset restores.

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

`Calendar`'s props, its reason value and its default labels were renamed before the first publish,
which is a breaking change: `availableByDate`, `lowAvailabilityThreshold`,
`CalendarDay.availableCount` and the reason `none-left` replace the earlier names, and
[#295](https://github.com/spy4x/preact-components/pull/295) has the old-to-new table.

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

**A month is asked for, never taken.** `onSelectMonth` is a request, and the reader keeps their
place in the grid whatever the owner answers. Page Up and Page Down are the only two keys this can
happen to: the arrows refuse to leave the month they are in and Home and End are clipped to it, so
neither ever asks for a month.

Two rules cover every answer there is:

| What the owner does to `monthAnchor`       | Where the reader ends up                       |
| ------------------------------------------ | ---------------------------------------------- |
| draws a new month, in that render or later | the same day number in the month now on screen |
| leaves it where it was                     | the day the press started from                 |

The second rule is the one to design a caller around, because a calendar clamping the month to a
range the reader may not leave does it on purpose. A press refused that way costs the reader
nothing: the month on screen does not change, and the focus goes back to the day it started from
instead of staying on the grid container, so their next arrow press moves a day rather than being
spent walking back to where they already were.

The first rule needs no cooperation from the caller and does not care why the month changed. An
owner that checks or fetches before it answers gets it, and so does an owner that changes the month
for reasons of its own while the reader happens to be standing in the grid. A refusal can only be
judged by the render that follows the call, so a late answer is read as a refusal first and the
reader is put back on their day; when a month is drawn afterwards, whichever month it is, the focus
goes to the same day number in it. Without that the new cells would replace the one the focus was on
and the focus would fall to the document body, which no key can recover from.

**It never takes the focus from somewhere the reader chose.** A month arriving moves the focus only
when nothing in the document holds it and this grid is where it was; a reader who has blurred,
tabbed away or moved to another control keeps their place, and the month changes under a calendar
they are no longer in. That move is also the one focus change the calendar makes on its own
initiative rather than in answer to a key pressed inside the grid, so it passes `preventScroll`:
scrolling the page to a calendar nobody is looking at is not something to do unasked.

**A burst of presses travels further at a fast owner than at a slow one, and this is a trade.**
Every press asks for the month after the one the _cursor_ is in, and the cursor is wherever the
last press left the reader. What a burst does therefore depends on whether the owner has answered
by the time the next key arrives, and both of the catalogue's late owners are reachable from the
card:

- **An owner that answers before the next key is delivered** — in the render the call triggers, or on a
  microtask — has moved the reader before the next key is delivered, so the presses accumulate:
  two Page Downs move two months, three move three, and Page Down then Page Up brings the reader
  back to the month they started on.
- **An owner that answers later than that** has not, so its press has already been read as a
  refusal and the cursor rewound to the day on screen. The next press is asked from there and asks
  for the same month again: two Page Downs move **one** month and so do three, and Page Down then
  Page Up leaves the reader **one month before** the month they started on, because the calendar
  asked for the month after and then for the month before, in that order, and the owner drew both.

Every press is delivered and every press is answered either way; what changes is how far the burst
travels, and the focus always lands on the same day number in whatever month ends up on screen.

**Why it is that way.** The rewind is what the refusal handling _is_: the calendar cannot tell a
slow yes from a no, so it assumes a no and puts the reader back where they were, cursor and focus
together. Keeping the cursor in the month the press asked for would make a burst travel a month per
press again, at the cost of a cursor sitting in a month nothing is drawing while the focus is on a
day of the month that is — the two disagreeing about where the reader is, which is the defect this
whole section exists to remove. A burst that travels less far is the cheaper mistake, and it is the
one that was chosen.

**What holds all of this.** Every rule above is held by browser checks in `pages/checks/system.ts`,
driven against two catalogue cards — one whose owner refuses every month change, one whose owner
answers late, either on a timer or on a microtask as a reader picks. Removing any part of the
handling turns at least one of them red. One case is measured rather than checked, and is written
here for that reason: an owner that answers late with a month _nobody asked for_ — measured with a
disposable owner that replies September to every request — lands the reader on 19 September when
they pressed from the 19th, which is the first rule doing its job.

**The roving tabindex is applied by an effect, not rendered.** Taking Tab away from twenty-eight
cells is only safe once a key handler is there to give the movement back, so a page that has not
hydrated — no JavaScript, or an embedded render — keeps the natural tab order it always had.

A day that cannot be picked is still focusable and its accessible name is the reason it cannot be:
`19 August 2026 — not available`. The reason is one of `past` (before `minDate`), `after` (after
`maxDate`), `none-left` (`availableByDate` holds `0` for the day; the cell is also struck through)
and `unavailable` (the day is not in `availableByDate`, or belongs to a neighbouring month). The
same sentence is shown under the grid while it has focus, for the reader who has no screen reader
to read the cell out and no mouse to hover a `title` with. The grid itself is a `grid` of `row`s
and `gridcell`s named after the month it shows.

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

`ImageLightbox` makes the images inside a container zoomable, opening `@spy4x/preact-ui`'s
shared `Lightbox` — the same dialog `ImageGallery` opens on a thumbnail (`ui/README.md`'s
`Lightbox` section). It renders nothing but that empty dialog, so a reader without JavaScript loses
only the zoom. The layer is delegated to the container: one listener instead of one per image,
images that arrive after hydration still work, and cleanup is complete. Previous and next page
through the container's other zoomable images, snapshotted at the moment one opens; an image that
arrives afterward becomes zoomable but is not spliced into a sequence already being viewed. An image
with no `alt` attribute is unchanged from before `Lightbox` existed: it still opens, named by
`fallbackAlt` (default `"Image"`), and is now also shown as a visible caption — new here, since the
old dialog had none. Only a caller who sets `fallbackAlt=""` turns the substitution off, and only
then can an image genuinely have no description; that image is then refused the way `ImageGallery`'s
own `images` prop is, and refused early — never marked a zoom control in the first place, so it
keeps no Tab stop and no name it cannot act on, and a click on it inside a link still follows the
link.

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

Four components follow it today. `SWUpdater` is below, `Toastr` in `ui/` keeps its stack in
the page with zero toasts in it, `Combobox` in `ui/` renders one empty `role="status"` region
with every field and puts its answers — the count of matching options, or the empty message —
inside it, and `AuthForm` below renders one empty `role="alert"` region with the form and puts an
error message into it. Where they differ is what the region costs a host, and that turns on where
it sits: `SWUpdater`'s region is its whole output and lands in the host's own container, so the
table below applies to it; `Toastr`'s stack is laid out `fixed` and is out of flow wherever it is
mounted; `Combobox`'s and `AuthForm`'s are each a child of the component's own root, so a host
lays out one combobox- or form-shaped box whether the region is there or not. See `ui/README.md`
for the combobox's measurements.

**Where to mount it.** `SWUpdater`'s region carries no class, so it is an ordinary in-flow element
with no padding, no border and no minimum height: empty, it is zero pixels tall and paints nothing.
That is not the same as costing nothing everywhere, because a parent can space a child that has no
height. Measured in Chromium, against a column of two 24px paragraphs that is 64px tall on its own:

| Parent                         | Empty region in it | Cost |
| ------------------------------ | ------------------ | ---- |
| block flow, no spacing         | 64px               | 0px  |
| block flow with `space-y-4`    | 64px               | 0px  |
| `flex` column with `gap-4`     | 80px               | 16px |
| `flex` column with `space-y-4` | 80px               | 16px |
| `grid` with `gap-4`            | 80px               | 16px |
| `grid` with `space-y-4`        | 80px               | 16px |

**It is the parent's layout mode that decides, not which spacing utility it uses.** A `gap` is
allocated for every child, height or no height. `space-y-*` spaces by margins instead, and a margin
collapses through a zero-height element in block flow — which is why the second row costs nothing —
but margins never collapse between flex or grid items, so the same utility costs a full 16px in the
fourth and sixth rows. Spacing a flex or grid container by margins rather than by `gap` therefore
buys a host nothing here.

**So mount `<SWUpdater />` where its parent is neither a `flex` nor a `grid` container** — as a
direct child of `<body>`, or of a plain block-flow container, spaced or not. Anywhere else it costs
one gap or one margin: a visible hole in the layout, for an element nobody can see.

The zero cost depends on the region having no border, no padding and no height, and a host cannot
take that away: the region carries no class of its own and the `class` prop goes to the bar inside
it, so there is no way to style the region from outside the package. `Toastr`'s stack never faces
this question at all, because it is laid out `fixed` and is out of flow wherever it is mounted.

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

## The `AuthForm` contract

`AuthForm` draws the sign-in, sign-up and one-time-code screens and knows nothing about how
signing in works: `mode`, `step`, `busy` and `error` are read from props, and a credentials submit,
a code submit or a mode switch leaves through `onSignIn`, `onSignUp`, `onOneTimeCode` or
`onModeChange` rather than through a fetch this package makes for you.

**The submitted values are read from `FormData`, not from controlled state.** A controlled
`Input` needs the password sitting in a signal or a `useState` on every keystroke; reading
`new FormData(form)` inside the submit handler takes it from the input's own `value` at the one
moment it is needed and puts it nowhere else. It also means the hydrated path and the no-JavaScript
path read the same fields the same way — a browser building its own `FormData` for a real POST
sees what the handler would have read.

**`action` is the no-JavaScript path.** Before hydration nothing here has run, so a tap on Submit is
a native form submission to `action`, the same progressive-enhancement contract `ImageLightbox` and
`Calendar`'s link mode already use. Once hydrated, the submit handler calls `event.preventDefault()`
and the callback matching the current `mode`/`step` — but only when the caller supplied one, so a
caller that wants the native post to keep happening even after hydration can simply leave that
callback out. **`method` is always `"post"`, and there is no `method` prop.** A GET submission puts
the password in the address bar, in browser history and in every access log the request passes
through, and the risk is not only a caller spelling `method="get"` on purpose: a card with
callbacks and no `action` — the ordinary shape of a hydrated app, and the catalogue's own
interactive card below — has no `method` attribute at all without an unconditional default, and a
browser reads a form with no `method` as GET. A visitor who submits in the gap between the page
painting and hydration finishing, or with JavaScript off, sent the password into the URL under an
earlier version of this component; `pages/checks/system.ts` disables script execution, loads the
page fresh and presses Submit on exactly that card to prove it no longer does.

**A busy submit calls no callback, including one started with `form.requestSubmit()`.** The submit
handler checks `busy` before it picks a callback or reads a single field, and `requestSubmit()`
dispatches the same `submit` event a click does, so it is caught by the same check. The submit
button is also `disabled` while busy, and a visually hidden, always-present `role="status"` region
announces it — the same always-present pattern as the error region below, applied to a fact that
is not an error.

**The one-time-code step moves the focus to its field, and nowhere else does this component take
focus on its own initiative** — the same rule `Calendar` follows for the one focus move it makes
without a key press behind it. The effect fires on `step` becoming `"one-time-code"` and on no
other render, whether that transition comes from a real round trip through an app's server or from
a caller flipping the prop in a demo.

**`error` accepts a plain string or `{ message, field? }`.** Most auth errors — a wrong password, a
network the app could not reach — are not more about one field than the other, so a string is the
ordinary case. Naming a `field` is for the error that really is about one, an unregistered login
say: that field's own `Field` gets the message and `aria-invalid`, on top of the message reaching
the always-present region every error reaches regardless of whether it names a field. The two are
different jobs — the region is what makes the message announced at all, `Field`'s own wiring is
what links it to a control — so a field-named error does both rather than one instead of the other.

**A field-named error is announced twice, and that is accepted rather than fixed.** Once from the
assertive `role="alert"` region, and again from `Field`'s own `aria-live="polite"` paragraph under
the control — some assistive technology reads both. `Field` has no way to keep the
`aria-describedby`/`aria-invalid` wiring without its own live paragraph, so avoiding the second
announcement means dropping the always-present region's promptness or the field-level link, and a
message heard twice costs less than a message a reader who tabs to the field later never hears.

**`login` and `password` are passed to the callback exactly as typed** — not trimmed, not cased,
not otherwise normalised. `FormData` hands back the input's raw string and this component passes it
straight through; an app's own auth code, with the rules of its account store behind it, is better
placed to decide whether a login is trimmed than a component that has never seen that store.

**`Field`'s `required` does not yet put `required` on the control it wraps (#116)**, so every field
here passes `required` to both: to `Field`, for the visible `*`, and to the `Input` directly, for
the native constraint validation a password manager and a browser's own "please fill this in" both
rely on.

**The show/hide password control is a real, named button.** It is an eye icon, not a word: a
32 px square sits inside the field's on-scale `pr-12`, while a "Show password" label was 105 px
wide and ran over a shown password. Its accessible name is `labels.showPassword` or
`labels.hidePassword` (English defaults), `type="button"` keeps it from
submitting the form, `aria-pressed` reports whether the password is showing, and it moves the focus
to itself on activation rather than leaving a click's default focus behaviour to decide — that
behaviour is not the same in every engine.

**`mode` and `step` are string unions**, the same shape every other prop union in this library uses
(`ButtonVariant`, `CalendarDayReason`) rather than a TypeScript `enum`. An `enum` earns its place in
this codebase for a value that is internal bookkeeping and never crosses a serialisation boundary —
`ValidationType` in `@spy4x/validation/model`, say. `mode` and `step` are the opposite: an app's server hands one back
after a real round trip, so the value has to survive JSON without a second lookup table translating
an integer back into a string.

## The `SiteHeader` contract

`SiteHeader` draws a public-site top bar: `brand` on the left; `links` on the right from `lg` up,
and in a `<details>` disclosure below it; an optional `actions` slot and the menu button always in
view, beside whichever form `links` is currently taking. It is the public-site sibling of the app
shell's side navigation (#135) — that one is a signed-in app's frame, this one is a landing page's
top bar — and the two share the mobile-panel open/close behaviour rather than each writing their
own; see `mobile-panel.ts` below.

**Every link, and every word of `brand`, is the caller's.** `links` is `{ label, href, Icon? }`, and
nothing here writes a `href`, a label or a brand string of its own — `brand` is rendered exactly as
given, with no anchor of this component's own wrapped around it, because inventing one would mean
inventing the `href` it points at.

**`actions` is rendered once, `links` is redrawn.** A caller's own element can only ever be mounted
in one place — Preact tracks it by identity, and a second placement would move it rather than copy
it — so `actions` stays exactly where it is at every width, next to the menu button. `links` has no
such limit: both the desktop row and the panel call the same internal renderer over the array, so
each gets its own markup built from data rather than the same element mounted twice.

**The active link is decided by exact string equality**, `href === currentPath`, and marked with
`aria-current="page"`. A prefix match would be right for some route trees and wrong for others —
`/docs` current while `/docs/intro` is on screen — and this component has no way to know which, so a
caller whose routes want prefix matching normalises `currentPath` or a link's `href` before handing
it in.

**The mobile panel is a `<details>`, so its links are reachable with no JavaScript at all.** A click
on `<summary>` opens and closes the native disclosure with nothing running, which is what keeps every
link in `links` reachable before hydration and with scripts off — `pages/checks/system.ts` proves it
by disabling script execution and pressing the button. **Chromium exposes that open/closed state to
assistive tech on its own**, through the accessibility tree's `expanded` property, regardless of
whatever `aria-expanded` this component also writes — proved by reading that property directly off
`Accessibility.getPartialAXTree` rather than off the attribute this file controls. `useMobilePanel`
(`mobile-panel.ts`) layers three things on top of the platform's own behaviour: Escape closes the
panel and returns focus to the button, a client-side navigation on a link inside the panel closes it
too, and `aria-expanded` is kept in step with the disclosure's own state as an explicit, redundant
signal. None of the three is needed to open the panel or reach a link inside it.

**The panel overlays the page instead of pushing it down.** Its content is positioned `absolute`
against the `<header>` (`position: relative`), spanning the header's own width and left edge, rather
than sitting in normal flow beside the menu button. A panel back in flow grows the header and shoves
`brand` and `actions` down when it opens — the bug `pages/checks/system.ts`'s layout checks were
written against, reading the header's own height and the brand's vertical position before the panel
opens and asserting neither one moves once it does.

**Closing for a click and closing for Escape return focus differently, on purpose.** Escape is the
visitor asking the panel to close, so focus returns to the button that opened it. A link inside the
panel is the visitor asking to go somewhere else — under a client-side router, that click never
leaves the page, but `close(false)` still runs, and it does not pull focus back to a button the
visitor has already moved past. `mobile-panel.ts`'s own doc names this as the reason `close` takes a
`returnFocus` argument instead of always returning it.

**Escape closes the menu only while focus is inside it.** The listener lives on `document` so it
can hear a press from anywhere in the panel, but it acts only when the key event's own target sits
inside this disclosure — a dialog opened on top of the menu keeps its Escape to itself, and a stray
press once a wide viewport has hidden the panel entirely does nothing. On Safari, a mouse click does
not focus the `<summary>`, so a mouse user there closes the menu with the button itself rather than
with Escape.

**A menu opened before the bundle has finished loading still ends up correct.** `useMobilePanel`
reads `detailsRef.current.open` once on mount, which is what catches a visitor's click landing in
the gap between paint and hydration — without it, the hook only ever learns the open state from a
`toggle` event it is already listening for, so a panel opened before that listener existed stayed
invisible to it: `aria-expanded` stuck, Escape doing nothing, both forever. Proved in
`pages/checks/system.ts` by holding the island bundle's own request with the Fetch domain, clicking
the button while it is held, then releasing it and pressing Escape once hydration has caught up.

**`aria-expanded` is omitted rather than server-rendered as a hard-coded `"false"`.** The server
always renders the panel closed, so `"false"` would even be true at that instant — the risk is a
value baked into the response staying `"false"` forever for a visitor whose only click landed before
this hook ever read the DOM. Omitting the attribute until the hook has actually read the element's
state, rather than printing a value that can go stale, is what keeps it from ever contradicting the
element it describes; once mounted, it is always kept in sync, in both directions, from there on.

**One fixed accessible name, not a pair that swaps with the state.** An earlier version of this
component named the button `"Open menu"` or `"Close menu"` depending on `open`. Two things followed
from that, both worse than the fix: `aria-expanded` and the name were announcing the same state
twice once both were correct, and for as long as no script had run — the SSR response, or a visitor
with scripts off entirely — the name stayed `"Open menu"` for a panel a visitor had already opened
with a plain click. A single name, `"Menu"` by default and overridable through `labels.menu`, is
correct in every one of those states without needing to know which one it is in.

**The icon swap costs no JavaScript either.** The hamburger and the close glyph are both always in
the markup, and `group-open:` — a Tailwind variant compiled from the `<details>` element's own
`[open]` attribute — is what shows one and hides the other. The browser flips it the moment it opens
the disclosure, whether or not the bundle has run.

**The desktop row and the mobile panel never coexist in the accessibility tree.** Both render the
same `links` through one `aria-label`d `<nav>`, once `hidden` below `lg` and once inside a `<details>`
that is `lg:hidden`, so exactly one is ever `display`ed at a time — the other is removed from the
tree entirely rather than merely dimmed behind `aria-hidden`. That is what keeps two landmarks
sharing one accessible name from ever being announced together, and what keeps Tab from ever
reaching a link twice at one viewport width.

**Every string this component prints beyond `links` and `brand` has an English default and a
`labels` override**: the menu button's one name, and the `aria-label` shared by both `<nav>`s.

### The shared mobile-panel hook

`mobile-panel.ts`'s `useMobilePanel` is `SiteHeader`'s half of the piece both #139 and #135 asked to
be written once: track a `<details>`-based disclosure's open state — synced from the DOM on mount, so
a click that landed before this hook existed is not invisible to it — close it on Escape or on a
navigating link inside it, and return focus to the element that opened it when, and only when, the
visitor asked the panel itself to close. It holds no markup of its own — a caller supplies the
`<details>`/`<summary>` and wires `detailsRef`, `triggerRef` and `onToggle={handleToggle}` onto them
— so the app shell's side navigation can reuse the same hook against its own markup without either
component reaching into the other.

There is no pure logic in it to unit test: every behaviour is a `document` listener, a focus move or
a mount-time DOM read, none of which a string render executes. `pages/checks/system.ts` drives all of
it in a real browser instead.

## The `Shell` contract

`Shell` (#135) is the signed-in app's own frame: a sticky header (menu button, `brand`, `status`,
user menu), a side navigation that is a plain sidebar from `lg` up and a `<details>`-built drawer
below it, and a content area with a skip link in front of everything. It is the app-shell sibling of
`SiteHeader` — that one is a public page's top bar, this one is what wraps every page once a visitor
is signed in — and the two share `mobile-panel.ts`'s open/close behaviour rather than each writing
their own.

**`navItems` is redrawn from data in both places; `brand` and `status` are each rendered exactly
once.** The same vnode-identity rule `SiteHeader`'s `links`/`actions` split follows: `navItems` is an
array, so the sidebar and the drawer each build their own markup from it and neither steals the
other's copy, but `brand` and `status` are the caller's own elements and can only ever be mounted in
one place — both live in the header alone. A nav item with no `href` renders as a plain heading, and
its `children` are drawn nested beneath it, always visible; there is no collapse/expand per group.

**The user menu is `ui/`'s `Dropdown`, not a second implementation.** `user: null` renders no menu at
all — a signed-out visitor draws no trigger for an account that has not signed in. Given a user, the
trigger is an `Avatar` named from `user.name`, and `Dropdown`'s `triggerNamedByContent` is what turns
that computed name into the trigger button's own accessible name, the same mechanism
`DateRangePicker` uses for its own trigger.

**The header and the drawer coexist without overlapping, and Escape stays scoped to whichever one is
actually open.** The drawer's panel is positioned to start below the header's own height (`top-16`
matching the header's `h-16`) and sits at a lower `z-index`, so the menu button, `status` and the
user menu stay reachable while the drawer is open. `Dropdown` answers its own Escape and stops it
from bubbling further — the same "innermost open layer wins" rule that already keeps a dropdown
inside a dialog from also closing the dialog — so a real Escape pressed with focus in the open user
menu closes only the user menu, and `mobile-panel.ts`'s own `contains` guard is what would still
catch it if that stopped being true, exactly as it already does for `SiteHeader` against a `Modal`.
Opening the drawer moves real focus to its own button, which is outside the user menu's root, so
`Dropdown`'s own focus-out handling closes an open user menu on its own, before any Escape is ever
pressed. `pages/checks/system.ts`'s `shellEscapeScopingCheck` proves both directions with real clicks
and a real Escape, not a scripted event aimed at a mismatched target.

**The user menu's own panel needs a higher `z-index` than the drawer's, and the header's `panelClasses`
override is why.** `Dropdown`'s panel defaults to `z-10`; the drawer's panel is `z-20`. Both are
descendants of the header's own `sticky z-30`, so their `z-index` values are compared against each
other inside that one stacking context, not against the header's own `z-30` — left at the default,
the drawer painted over an open user menu at phone width, and a tap meant for a menu item landed on
the drawer instead and closed the menu through `Dropdown`'s own outside-click handling before the
item's own click ever ran. `Shell` passes `panelClasses="z-30"` to raise the menu above the drawer;
`shellEscapeScopingCheck`'s first direction now also asserts, with `elementFromPoint` and a real
click, that the item is genuinely reachable by a pointer, not only by focus.

**The drawer's scrim closes it on a tap, without returning focus to the menu button.** The scrim
exists so a pointer user has a target to dismiss the drawer with — the panel is 288px wide and the
scrim is everything beside it — and it calls `close(false)`, the same call `onNavigate` makes for a
link inside the panel, rather than `close(true)`, the call Escape makes. A tap on the scrim is a
dismiss by pointer: nothing the visitor touched needs keyboard focus handed back to it, and pulling
focus onto the now-hidden menu button, which the tap never came near, would be a surprise rather than
a courtesy.

**The skip link is the first focusable element on the page**, targeting a `<main>` this component
gives `tabindex="-1"` — activating it moves focus into the content area itself, not only the address
bar's hash, which is what lets a visitor skip the whole navigation with one key press rather than
tabbing past every link in it first.

**A drawer link click closes the drawer under a client-side router, exactly as `SiteHeader`'s panel
links do.** `ShellNavLink` wires the identical `onNavigate={() => close(false)}`, reusing the same
`close(false)`-not-`close(true)` reasoning: a navigating link, like the scrim, is not the menu button
asking to close, so it must not fight wherever the click actually sends focus next.

**Every string beyond the caller's own data has an English default and a `labels` override**: the
menu button's name, the shared `aria-label` on both navigation landmarks, the skip link's text, and
the user menu panel's `aria-label`.

### Reusing `mobile-panel.ts`

`Shell`'s drawer wires the same `detailsRef`, `triggerRef` and `onToggle={handleToggle}` from
`useMobilePanel` that `SiteHeader` does, against its own `<details>`/`<summary>` markup. Nothing in
`Shell` reimplements Escape handling, the mount-time DOM read, or the client-navigation close — see
`useMobilePanel`'s own section above for what all three of those buy a visitor. Reusing the hook
unchanged, rather than writing a second one shaped like it, is what keeps the SiteHeader-vs-Modal
Escape-scoping proof and the Shell-vs-Dropdown one testing the same code path.

## The `StateInit` contract

`StateInit` (#135) is a generic SSR→client hydration bridge: the server renders `<StateInit data=
{value} />` once, and the browser reads the same value back with `readStateInit()`. Which keys
`data` holds is entirely the caller's business — this file never reads a field of it — which is what
makes it portable where the source applications' own versions were not: each of those hard-coded
that app's own environment keys directly into the component.

**The escaping is `SEOHead`'s own, reused rather than reimplemented.** `stateInitText` calls
`seo-head.tsx`'s `jsonLdText`, the same function that already protects `SEOHead`'s own JSON-LD
script tag: `<` becomes the six characters `\u003c`, which keeps a value containing the literal text
`</script>` (or `<!--`) from ending the element early — the HTML parser watches for that sequence
case-insensitively to close _any_ `<script>`, regardless of its `type`, before either JSON or
JavaScript ever parses the content. U+2028 and U+2029 need nothing extra here: `StateInit` renders
`type="application/json"`, which the browser never executes, and `readStateInit` reads it back with
`JSON.parse`, which has always accepted both characters inside a JSON string. `state-init.test.tsx`
proves a value carrying all three — `</script>`, `<!--` and both separators — survives the round
trip through `stateInitText` and back through `readStateInit` unchanged, rather than resting on the
reasoning alone.

**`readStateInit` takes an injectable source, defaulted to the real `document`.** The default is
evaluated inside the function, never at module load, which is what lets `state-init.test.tsx` import
this file and call `readStateInit` with a fake `{ getElementById }` in Deno's test runtime, where no
`document` global exists at all — the same seam `SWUpdater`'s `container` prop gives its own tests.
`undefined` is the answer for every way there is nothing to read: no element with the given `id`, an
element with no text, or text that fails `JSON.parse` — a page that never rendered a `StateInit`
reads the same as one whose `id` was mistyped, rather than throwing either way.

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
- **Timezone-free grid arithmetic.** A source application did its day maths and weekday lookups
  through a host timezone module. An ISO date carries no zone, so day steps in UTC cannot drift across a
  DST boundary and a weekday computed in UTC is the same weekday everywhere. A `timeZone` prop
  survives for the one question that genuinely needs it — which date is _today_ — plus an
  injectable `today` for deterministic renders.
- **No `Nav`, `Auth`, `Menu`, `Header`, `ProfileDropdown`, `LeadForm` or `NewsletterForm`.** Each
  one is in the table below with a reason. `Shell` (#135) and `StateInit` are built as of this
  package's own commit — see their sections above — and are no longer in that table.
  `ImageGallery` was in it too, and is no longer: it is built, in `ui/` rather than here — see
  `ui/README.md`'s `ImageGallery` section.
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

| Left out                            | Why                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Menu`, `Header`, `ProfileDropdown` | Two source implementations of the same responsive header, both shaped around one app's markup and brand. The pieces worth keeping are the dual-mode contract and the a11y fixes, which landed in `Calendar`. |
| `LeadForm`, `NewsletterForm`        | Form chrome whose anti-bot fields (honeypot, page-load timestamp) and success states the host must render itself.                                                                                            |
| `themeBootstrapScript()`            | The FOUC-free inline `<head>` script belongs with `ts-libs`, next to the other head-platform helpers.                                                                                                        |

The source applications' own `Shell`/`Nav` and `StateInit` used to be in this table too: each read
straight out of a global app store, hardcoded a brand string or an env key, and one ran an `effect()`
at import time. Props-and-ports conversion for those was a redesign, not a port — `AuthForm` needed
the same redesign and got it first. `Shell` (#135) and `StateInit` are that redesign, and their own
sections above describe what changed.

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

`auth-form.test.tsx` is the same split again: markup, `autocomplete`, `name`, `required`, `method`
being `"post"` with and without `action`, and the error shape are all a string render can show, and
are asserted there. The focus move to the code field, the mode switch pressed with a real pointer,
the show/hide toggle's real click and Space press, the error arriving as a change to the
already-present live region, a busy `requestSubmit()` calling no callback, and a submit surviving
disabled script execution with no query string added to the URL are effects, key presses, a focus
change and a real navigation — none reachable from a string render — and are proven in
`pages/checks/system.ts` instead.

`site-header.test.tsx` is the markup half of `SiteHeader`: every link's `href` present once inline
and once in the panel, `aria-current` on the one link matching `currentPath` and on no other, `brand`
rendered with no anchor of the component's own around it, `actions` rendered exactly once, the menu
button starting with `aria-expanded` omitted rather than a hard-coded `"false"` and a fixed name, its
`aria-controls` pointing at the panel's own id, the panel positioned to overlay rather than sit in
flow, and a `labels` override replacing every default — checked against the full set of visible words
the render produces, so a hard-coded brand, button or link label has nowhere to hide. Opening the
panel with a real click, Escape closing it and returning focus to the button, a client-side navigation
closing it without returning focus, `aria-expanded` tracking the open state once mounted, the header's
own height and the brand's position holding still while the panel opens, the disclosure's expanded
state reaching the accessibility tree natively, Tab order at phone width, a menu opened before the
bundle finishes loading still ending up correct once it does, and every link staying reachable with
script execution disabled are effects, key presses, a focus change, layout and a mount-time DOM
read — none reachable from a string render — and are proven in `pages/checks/system.ts` instead.
`mobile-panel.ts` has no test file of its own for the same reason: it holds no logic that is not one
of those things.

`shell.test.tsx` is the markup half of `Shell`: every nav item's `href` present once in the sidebar
and once in the drawer, `aria-current` on the one item matching `currentPath` and on no other, an
item's icon and counter badge rendered in each copy and the badge omitted for zero, a negative
number or no counter at all, an item with no `href` rendered as a heading with its `children` beneath
it, `brand` and `status` each rendered exactly once with no anchor of the component's own, no user
menu when `user` is `null`, the user menu named from the user's own name and every `userMenuItems`
entry rendered as a link or a button carrying its `dataE2E`, the skip link positioned before any
other link and wired to a focusable `#`-targeted `<main>`, a `labels` override replacing every default, and a caller's `class`
merged onto the root without losing its own — checked, as `site-header.test.tsx` is, against the full
set of visible words the render produces. Opening the drawer with a real click, a real Escape closing
it, an Escape aimed at the drawer landing in the same task as the click that opened it, Tab order
through the drawer's links, the header holding still (byte-identical screenshots) while the drawer
opens at phone width and while the user menu opens at desktop width, the skip link moving focus to
the content area rather than only the hash, and the two-directions Escape-scoping proof between the
drawer and the user menu are effects, key presses, a focus change, layout and real pointer/keyboard
input — none reachable from a string render — and are proven in `pages/checks/system.ts` instead.

`state-init.test.tsx` is everything `StateInit` has that a string render can prove: `stateInitText`
round-tripping `</script>`, `<!--` and both line separators unchanged through `JSON.parse`, its
escaping matching `SEOHead`'s own byte for byte, the rendered `<script type="application/json">`
matching exactly, the `id` default and override, and `readStateInit` reading a fake `{
getElementById }` source correctly — including the three ways there is nothing to read: no matching
`id`, no text content, and text that fails to parse. There is nothing left for `pages/checks/system.ts`
to prove for this component: it touches no listener, no focus and no timer, so nothing about it is
unreachable from a string render.

## The `RailShell` contract

`RailShell` (#257) is a third frame beside `Shell` and `SiteHeader`, for a site whose navigation is
a short list of destinations with one primary action. From `md` up it draws a vertical rail: each
item an icon above a short label, and the primary action pinned at the top in the primary colour.
Below `md` the rail gives way to a bottom tab bar of at most five slots. `Shell` is different in
kind — a header, a sidebar, a user menu and a `<details>` drawer for a signed-in app — and so is
`SiteHeader`, a public site's top bar that collapses into the same kind of `<details>` panel.
Neither has a rail or a tab bar, which is why this is a new component rather than a mode of either.

**Which entries become tabs.** Items and the primary action together fill the bar when there are
five or fewer of them, and then there is no "More". Past five, the first four items are tabs and
the fifth slot is "More", which holds the primary action first and then every remaining item.
Counting the primary action is a deliberate step past the plain "five items or fewer" rule: with
five items and a primary action, a bar that showed all five items would leave the primary action
unreachable on a phone. `tabBarSlots(items, primary)` is that rule as a pure function.

**"More" opens a modal `<dialog>`,** the pattern `ImageLightbox` already uses through `ui/`'s
`Lightbox`, rather than the `<details>` disclosure the other two shells share: a modal gets Escape,
an inert page behind it and the top layer from the browser. `showModal()` moves focus to the first
control inside, which is the close button. Escape closes it natively, a click on the backdrop closes
it, and choosing an entry or the close button closes it. Every way of closing ends in the `close`
event, whose handler returns focus to "More". Chromium also returns focus to "More" by itself when a
modal dialog closes, so in Chromium no check can prove the component's part; the handler is there
for engines that do not. With no JavaScript every entry that has an `href` is a plain link, and
"More" and the close button carry `command`/`commandfor`, so a browser that supports invoker
commands still opens and closes the overlay — `pages/checks/system.ts` proves that in Chromium with
script execution disabled.

**Nothing covers the page.** The rail is a column in the layout, and its contents stick to the top
while the page scrolls. The tab bar sticks to the bottom but keeps its place in the flow, so the
page's last line always ends above it; it pads itself by the bottom safe-area inset. Inside a
bounded, scrolling container, pass `class="min-h-full"` in place of the default `min-h-dvh`, and
that container becomes what both stick to.

**Colours are theme tokens read through `var()`,** each with the default palette's value as its
fallback — the same pattern `theme/preset.css` uses — so the shell follows whichever palette the
page sets and draws without the preset too.

**Icons come from the caller** as a component (`Icon`), not an element, because every entry is drawn
twice — in the rail, and in the tab bar or the overlay — and one element can only be mounted once.
The "More" glyph is three dots drawn inline, so the package gains no icon.

`rail-shell.test.tsx` proves what a string render can: the split at five, the primary action's
place in it, `aria-current` from either `currentKey` or `currentPath`, the "More" button pointing at
the dialog, and every label's English default and override. The breakpoint switch, the layout, the
dialog's keyboard and pointer behaviour and the focus moves are proven in `pages/checks/system.ts`.
