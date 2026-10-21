# `@spy4x/preact-system`

Application chrome and platform integration: SEO, PWA updates and offline sync, and the
progressive-enhancement components that have to render without JavaScript.

Extracted from earlier source applications.

## Rules this package follows

- **Props and ports, never a global store.** `SEOHead` takes the page head as props,
  `SWUpdater` takes the service-worker container, the
  reload and the error ports. The only state a component owns is the state the browser handed it.
- **Server-renderable.** `document`, `navigator`, `location` and the clock are touched inside an
  effect, an event handler, or a pure function whose result the caller passes back in.
  `SWUpdater` renders its empty live region and nothing else on the server, and `Calendar` takes
  `today` so a render is deterministic.
- **A live region is always present and empty.** See below; it is a library-wide rule, not a
  `SWUpdater` one.
- **No `theme/` dependency.** Utilities are inlined, like `ui/`. `icons/` supplies the glyphs these
  components draw (`IconChevronLeft`, `IconChevronRight`, `IconXMark`, `IconBars3`, `IconDownload`,
  `IconShare`) rather than duplicating SVG.
- **`ui/` is a sibling dependency.** `Shell` and `AuthForm` already import individual `ui/`
  components (`Avatar`, `Dropdown`; `Button`, `Field`, `Input`). `crud/` imports `ui/` the same
  way. Zoomable images are `ui/`'s `ZoomableImages`: content, not application chrome.

## Components

| Component             | Subpath                 | Ports / key props                                                                                                                                                                           |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountMenu`         | `account-menu`          | `user`, `items?`, `theme?`, `onThemeChange?`, `signOut?`, `display?`, `tag?`, `header?`, `vertical?`, `horizontal?`, `navigate?`, `triggerClasses?`, `panelClasses?`, `dataE2E?`, `labels?` |
| `AccountTag`          | `account-menu`          | `tag` — the neutral role badge `AccountMenu` and `AppShell` draw for `tag`                                                                                                                  |
| `AppShell`            | `app-shell`             | `items`, `account`, `currentKey?`, `currentPath?`, `navigate?`, `switcher?`, `notifications?`, `connection?`, `banner?`, `width?`, `children`, `labels?`, `class?`                          |
| `AuthForm`            | `auth-form`             | `mode`, `step`, `onModeChange?`, `modeHrefs?`, `onSignIn?`, `onSignUp?`, `onOneTimeCode?`, `busy?`, `error?`, `labels?`, `names?`, `action?`, `passkeyAutofill?`, `footer?`                 |
| `SEOHead`             | `seo-head`              | `title`, `description`, `canonical`, `crumbs?`, `ogImage?`, `imageAlt?`, `imageWidth?`, `imageHeight?`, `jsonLd?`, `noindex?`, `twitterCard?`, `twitterCreator?`                            |
| `SWUpdater`           | `sw-updater`            | `scriptUrl?`, `container?`, `updateMessage?`, `reload?`, `onUpdate?`                                                                                                                        |
| `Calendar`            | `calendar`              | `monthAnchor`, `minDate`, `maxDate`, `availableByDate`, `onSelectDate?`                                                                                                                     |
| `SiteHeader`          | `site-header`           | `links?`, `currentPath?`, `brand`, `actions?`, `labels?`                                                                                                                                    |
| `SiteFooter`          | `site-footer`           | `groups`, `brand?`, `aside?`, `bottom?`, `class?`                                                                                                                                           |
| `Shell`               | `shell`                 | `navItems`, `currentPath?`, `brand`, `user`, `userMenuItems?`, `status?`, `navigate?`, `sidebarTop?`, `sidebarBottom?`, `collapsed?`, `onCollapsedChange?`, `children`, `labels?`, `class?` |
| `StateInit`           | `state-init`            | `data`, `id?` — paired with `readStateInit(id?, source?)`                                                                                                                                   |
| `Rail`                | `rail`                  | `variant?`, `items`, `currentKey?`, `currentPath?`, `primary?`, `navigate?`, `navigateLink?`, `top?`, `bottom?`, `moreTab?`, `tabBarNotice?`, `children`, `footer?`, `labels?`, `class?`    |
| `RailCell`            | `rail`                  | `tip`, `children`, `dataE2E?` — a slot's control with the rail's tooltip; `railFocusRing` is its ring                                                                                       |
| `RailEntry`           | `rail`                  | `item`, `place`, `variant?`, `current?`, `navigate?`, `navigateLink?`, `counterWords?` — a slot's link drawn exactly as a rail entry                                                        |
| `RailShell`           | `rail-shell`            | `items`, `currentKey?`, `currentPath?`, `primary?`, `navigate?`, `navigateLink?`, `sidebarTop?`, `sidebarBottom?`, `moreTab?`, `children`, `labels?`, `class?`                              |
| `SyncStatus`          | `sync-status`           | `online`, `pending`, `syncing?`, `failed?`, `onRetry?`, `labels?`, `class?`                                                                                                                 |
| `SavedCopyNotice`     | `saved-copy-notice`     | `savedAt`, `formatTime?`, `labels?`, `class?`, other `<div>` attributes                                                                                                                     |
| `ConflictChooser`     | `conflict-chooser`      | `conflicts`, `onKeepMine`, `onUseTheirs`, `labels?`, `class?`                                                                                                                               |
| `UnsentChangesDialog` | `unsent-changes-dialog` | `unsent`, `conflicts?`, `sent?`, `state?`, `onSend`, `onSignOut`, `onCancel`, `onReview`, `labels?`, `class?`                                                                               |
| `InstallPrompt`       | `install-prompt`        | `mode`, `onInstall`, `onDismiss`, `labels?`, `class?`                                                                                                                                       |
| `PushSettings`        | `push-settings`         | `status`, `busy?`, `failed?`, `sent?`, `onEnable`, `onDisable`, `onTest?`, `labels?`, `class?`                                                                                              |
| `SettingsLayout`      | `settings-layout`       | `title`, `href`, `sections`, `current`, `navigate?`, `headingLevel?`, `intro?`, `children?`, `labels?`                                                                                      |

`head.ts` exports `createHeadStore`, a factory that builds a fresh signal-backed store on every
call — see below. The pure address and breadcrumb helpers `SEOHead` runs (`normalizeCanonical`,
`canonicalUrl`, `breadcrumbItems`, `breadcrumbListJsonLd`, `jsonLdText`) and the `Crumb` type come
from `@spy4x/platform/universal/seo` in spy4x/ts-libs; import them from there. `Calendar`'s day and
month arithmetic and its `Intl` labels come from spy4x/ts-libs too: `@spy4x/time/date`,
`@spy4x/time/locale` and `addDays` from `@spy4x/time/tz`.

```tsx
import { SEOHead } from "@spy4x/preact-system"

<SEOHead
  title="Widgets — Acme"
  description="Widgets for teams."
  canonical="https://acme.example/products/widgets"
  siteName="Acme"
  ogImage="https://acme.example/og/widgets.png"
  imageAlt="Three blue widgets on a desk"
  imageWidth={1200}
  imageHeight={630}
  twitterCreator="@jane"
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

`imageWidth` and `imageHeight` publish the preview image's size in pixels as `og:image:width` and
`og:image:height`, right after `og:image`; LinkedIn and Facebook read them to lay out a link
preview before the image loads. Each is emitted only when it is set and an `ogImage` is given,
since a size with no image describes nothing. `imageAlt` describes the preview image for people who
cannot see it, as `og:image:alt` and `twitter:image:alt`, under the same rule: it is emitted only
with an `ogImage`. `twitterCreator` publishes the author's handle as
`twitter:creator`, right after `twitter:site`. Every tag in the set has its own `name`, `property`
or `rel`, so Fresh's `<Head>`, which identifies an unkeyed tag by those attributes, prints each one
once.

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

A fragment names a position inside a page rather than a page. Credentials in an address that a
search engine indexes are credentials published.

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

No crumb is derived from the path: a path segment is not always a page with a readable name. A
page that states fewer than two crumbs
gets no `BreadcrumbList` at all — a one-item trail is noise in a rich result — and the whole
script tag is skipped when the graph is empty.

The page title is not part of the structured data; it appears only where a caller puts it.

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

An app that keeps head fields of its own beside `PageHead` names the combined type, and the store
carries those fields through `head`, `setHead` and `resetHead` without a cast:

```ts
const store = createHeadStore<PageHead & { pageName: string }>({
  ...siteDefaults,
  pageName: "Home",
})
store.setHead({ pageName: "Widgets" })
```

## Route changes move focus and set the title

`useRouteAnnouncer({ path, title?, main?, keepPageFocus? })`, from the `route-announcer` subpath, does for a
client-side route change what a page load does by itself. Without it, focus stays on the link that
was pressed, the tab keeps the previous page's title, and a screen reader announces nothing.

```tsx
function Layout({ store, children }: { store: HeadStore; children: ComponentChildren }) {
  const [path, setLocation] = useLocation()
  useRouteAnnouncer({ path, title: store.head.value.title })
  return (
    <AppShell
      items={items}
      account={account}
      currentPath={path}
      navigate={setLocation}
    >
      {children}
    </AppShell>
  )
}
```

In a single-page app the two make one route change: `navigate` (or `Rail`'s `navigateLink`) hands
a plain click on a shell link to the router instead of loading a new page, the router's new `path`
reaches the hook, and the hook moves focus and sets the title the way the page load it replaced
would have.

- **`path` is the router's, and only its path counts.** The hook imports no router. Anything from
  the first `?` or `#` is ignored, so a filter written to the query string is not a new page.
- **Focus goes to the page's `<h1>`, or to `<main>` without one.** It looks inside `main`, the
  document's first `<main>` unless you pass a ref, and gives the target `tabindex="-1"` when it has
  no `tabindex`, so script can focus it and Tab still skips it. `Shell`, `Rail` and `AppShell` render
  that `<main>`.
- **`pageHeading(main?)` is that target without a route change.** It returns the same element,
  made focusable the same way, or `null` when there is no `main`. Pass it as `returnFocus` to a
  component that leaves the page while focus is inside it, such as `InstallPrompt`
  (`returnFocus={pageHeading}`), so the reader lands on the page's heading instead of the page
  body. It reads the document, so call it from a handler or an effect, not during a render.
- **A focused heading shows the browser's focus ring.** That is intended: after a keyboard press
  the ring shows a sighted keyboard user where they landed. `Shell` and `Rail` give their
  `<main>` `focus:outline-none`, so a page with no `<h1>` shows no ring when focus lands there.
- **The first render moves nothing.** On a page load the reader starts at the top of the document,
  where the skip link is; only a later path change moves focus.
- **`keepPageFocus` leaves focus where the new page put it.** A page may focus one of its own
  controls as it opens, such as a search field reached by a keyboard shortcut. With
  `keepPageFocus: true`, a route change during which focus moved to an element inside `main` sets
  the title and moves no focus, so the reader hears that control once and not the heading before
  it. Focus that stayed on the link that was pressed still goes to the heading. It is off by
  default.
- **The title comes from the head store.** Pass the same `title` that `SEOHead` publishes, so there
  is one source for it. It is written on mount and whenever it changes; leave it out when something
  else already writes `document.title`.

## The dual-mode contract

`Calendar` renders `<button>` when the caller supplies a select handler and `<a href>` when it does
not. One definition therefore serves the hydrated island and the no-JS or embedded fallback, and
the URL stays the source of truth in both:

```tsx
<Calendar {...month} onSelectDate={(date) => navigate(`?date=${date}`)} />  // island
<Calendar {...month} dateHref={(date) => `?date=${date}`} />                // SSR / no JS
```

The same rule covers the month arrows, with one addition: a month with nothing to show renders an
inert `<span aria-disabled>` in the arrow's role, because a `pointer-events-none` anchor is still focusable and still
navigable with Enter.

## The calendar's keyboard

The whole grid is one Tab stop, and the focus moves inside it:

| Key                 | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| Arrow left / right  | a day back or on                                                   |
| Arrow up / down     | a week back or on                                                  |
| Home / End          | the first and last day of the week on screen, clipped to the month |
| Page Up / Page Down | the neighbouring month, through `onSelectMonth`, same day number   |

Every key the grid answers is cancelled, so paging a month does not scroll the page. Without
`onSelectMonth`, Page Up and Page Down do nothing: in link mode the month lives in the URL, and the
arrows are links that Tab reaches.

**A month is asked for, never taken.** `onSelectMonth` is a request, and the reader keeps their
place whatever the owner answers:

| What the owner does to `monthAnchor`       | Where the reader ends up                       |
| ------------------------------------------ | ---------------------------------------------- |
| draws a new month, in that render or later | the same day number in the month now on screen |
| leaves it where it was                     | the day the press started from                 |

A press refused that way costs nothing: the focus goes back to the day it started from, so the next
arrow press moves a day. A late answer is read as a refusal first; when the month is drawn after
that, whichever month it is, the focus goes to the same day number in it, instead of falling to
the body with the cells it was on.

The month arrows above the grid ask through the same `onSelectMonth`, and the same two rules hold
for the grid's Tab stop. The day an arrow left it on is forgotten once another month or another
selection is on screen. The focus stays on the arrow.

**It never takes the focus from somewhere the reader chose.** A month arriving moves the focus only
when nothing in the document holds it and this grid is where it was. That move passes
`preventScroll`, because it is the one focus change the calendar makes on its own.

**A burst of presses travels further at a fast owner than at a slow one.** Each press asks for the
month after the one the cursor is in. An owner that answers before the next key arrives (in the
same render, or on a microtask) lets presses add up: two Page Downs move two months. An owner that
answers later has had the first press read as a refusal, so two Page Downs move one month, and
Page Down then Page Up leaves the reader one month before where they started. The calendar cannot
tell a slow yes from a no; rewinding keeps the cursor and the focus on the same day, which is the
cheaper mistake.

`pages/checks/system.ts` holds every rule above against two catalogue cards: an owner that refuses
every month change, and one that answers late, on a timer or on a microtask.

**The roving tabindex is applied by an effect, not rendered.** A page that has not hydrated keeps
the natural tab order, since nothing would answer the arrow keys.

A day that cannot be picked is still focusable, and its accessible name is the reason:
`19 August 2026 — not available`. The reason is one of `past` (before `minDate`), `after` (after
`maxDate`), `none-left` (`availableByDate` holds `0`; the cell is also struck through) and
`unavailable` (the day is not in `availableByDate`). The cells before the 1st and after the last
day are blank, and a week with no day of the month, such as the sixth week of most Februaries, is
hidden as a whole row, since a `row` with no cell breaks the grid. The day number is written as the
label writes it, `9` and not `09`. The same sentence shows under the grid while it has focus. The
grid is a `grid` of `row`s and `gridcell`s named after its month.

These accessibility claims are read back from the DOM in headless Chromium; no screen reader has
been run against them. The blank cells are kept out of the accessibility tree, so a row exposes
fewer cells than `aria-colcount` says; `aria-colindex` keeps the columns numbered.

## The locale decides the week

Two things about a month grid are not the component's to decide, and both come from `Intl`:

- **which day the week starts on** — Monday across most of Europe, Sunday in the United States,
  Saturday across much of the Middle East, read from `Intl.Locale`'s week info;
- **how a weekday is abbreviated** — `Intl` already has an abbreviation per locale, and cutting it
  to two characters left every Arabic column reading `ال` and six of seven Vietnamese ones reading
  `Th`.

The day labels are the locale's too: a screen reader is read `9 February 2026` rather than
`2026-02-09`.

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

**Each waiting worker is reported once.** `watchForUpdate(registration, { hasController, onUpdate })`
is the function underneath the bar, exported so a host that owns its registration logic can use it
alone: it calls `onUpdate` for a worker already waiting, and for one that reaches `installed` while
a worker controls the page, and stays silent on a first install. It reports a given worker at most
once, whatever order its events arrive in, asks only the worker whose `statechange` fired for its
state, and takes its listener off a worker a later `updatefound` superseded. That is what keeps a
dismissal meaning something: a second report of the same worker would bring back the bar the
visitor put away for it. It returns a function that removes every listener it added.

## The `AuthForm` contract

`AuthForm` draws the sign-in, sign-up and one-time-code screens and knows nothing about how
signing in works: `mode`, `step`, `busy` and `error` are read from props, and a credentials submit,
a code submit or a mode switch leaves through `onSignIn`, `onSignUp`, `onOneTimeCode` or
`onModeChange` rather than through a fetch this package makes for you.

`footer` is caller content drawn last, inside the `<form>`, so a "Back to sign in" link sits in
the same card as the form. Because it is inside the form, a `<button>` there needs `type="button"`
or it submits, and it cannot hold a form of its own.

**The submitted values are read from `FormData`, not from controlled state.** A controlled
`Input` needs the password sitting in a signal or a `useState` on every keystroke; reading
`new FormData(form)` inside the submit handler takes it from the input's own `value` at the one
moment it is needed and puts it nowhere else. It also means the hydrated path and the no-JavaScript
path read the same fields the same way — a browser building its own `FormData` for a real POST
sees what the handler would have read.

**`action` is the no-JavaScript path.** Before hydration nothing here has run, so a tap on Submit is
a native form submission to `action`, the same progressive-enhancement contract `Calendar`'s link mode
already uses. Once hydrated, the submit handler calls `event.preventDefault()`
and the callback matching the current `mode`/`step` — but only when the caller supplied one, so a
caller that wants the native post to keep happening even after hydration can simply leave that
callback out. **`method` is always `"post"`, and there is no `method` prop.** A GET submission puts
the password in the address bar, in browser history and in every access log the request passes
through, and the risk is not only a caller spelling `method="get"` on purpose: a card with
callbacks and no `action` — the ordinary shape of a hydrated app, and the catalogue's own
interactive card below — has no `method` attribute at all without an unconditional default, and a
browser reads a form with no `method` as GET. `pages/checks/system.ts` disables script execution, loads the page fresh and presses Submit on exactly that card to prove the password stays out of the URL.

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

**`modeHrefs` makes the mode switch a link.** Without it, the switch is a `<button>` that calls
`onModeChange`, and it is not rendered when `onModeChange` is missing, so a page served without
JavaScript, or not yet hydrated, has no way from the sign-in form to the sign-up page. With
`modeHrefs={{ "sign-in": "/sign-in", "sign-up": "/sign-up" }}`, the switch is an `<a href>` to the
other mode's page in the server-rendered HTML, with the same look and the same `data-e2e`, and it is
rendered whether or not `onModeChange` is given. Once hydrated, a plain click (the primary button,
no modifier key) calls `onModeChange` and cancels the navigation when that callback is given; a
Ctrl-, Meta-, Shift- or Alt-click is left to the browser, so the page opens in a new tab or window
as a reader expects of any link. The plain-click rule is the one `Shell` uses for its links.

**`passkeyAutofill` offers passkeys in the login field.** In sign-in mode it sets the login field's
`autocomplete` to `username webauthn`, the token a browser needs to list saved passkeys in that
field's autofill while a conditional WebAuthn request (`navigator.credentials.get` with
`mediation: "conditional"`) is pending. The component starts no request itself: the page does, since
that needs the server's challenge. Sign-up mode ignores the prop, because a passkey cannot sign a
person up, and it is off by default, so an app without passkeys keeps plain `username`.

**`names` renames the inputs without changing the callbacks.** By default the inputs are named
`login`, `password` and `code`. An app whose action validates other field names — `username` and
`otp`, say — passes `names={{ login: "username", code: "otp" }}`, and the native post then sends the
fields under the names that action's schema expects, so the same form works with and without
JavaScript. The submit handler reads `FormData` under the same names, and `onSignIn`, `onSignUp`
and `onOneTimeCode` still receive `{ login, password }` and the code string. `error.field` keeps
naming the field by its role (`"login"`, `"password"`, `"code"`), not by its `name`.

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

**Tests find a control by its fixed `data-e2e`, not by a prop.** Every control carries one value
that never changes: `auth-form` on the form, `auth-form-login`, `auth-form-password`,
`auth-form-password-toggle`, `auth-form-code`, `auth-form-submit` (in both steps) and
`auth-form-mode-switch`. This is how `Shell` marks its own parts (`shell-menu-button`,
`shell-sidebar`), and it holds whatever language the labels are in, which a lookup by label does
not. A prop for test attributes was not added: nothing varies per caller, and a page with two
forms tells them apart by the form's accessible name (`Sign in`, `Sign up`). Finding a field by
its label still works, since every field has a real `<label for>`.

## The `SiteHeader` contract

`SiteHeader` draws a public-site top bar: `brand` on the left; `links` on the right from `lg` up,
and in a `<details>` disclosure below it; an optional `actions` slot and the menu button always in
view, beside whichever form `links` is currently taking. It is the public-site sibling of the app
shell's side navigation (#135) — that one is a signed-in app's frame, this one is a landing page's
top bar — and the two share the mobile-panel open/close behaviour rather than each writing their
own; see `mobile-panel.ts` below.

**No links, no navigation.** With `links` empty or left out, the bar draws neither `<nav>` nor the
menu button, because a button that opens an empty panel is a dead control. What remains is `brand`
on the left and `actions` on the right: the top bar of a single-page tool, in the design language's
shell table.

**Every link, and every word of `brand`, is the caller's.** `links` is `{ label, href, Icon?, external?, externalHint? }`, and
nothing here writes a `href`, a label or a brand string of its own — `brand` is rendered exactly as
given, with no anchor of this component's own wrapped around it, because inventing one would mean
inventing the `href` it points at.
`external` and `externalHint` work as on `SiteFooter`'s links: an icon after the label, and the
hint as screen-reader-only text.

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
than sitting in normal flow beside the menu button. A panel in flow would grow the header and shove `brand` and `actions` down when it opens; `pages/checks/system.ts` reads the header's own height and the brand's vertical position before the panel opens and asserts neither one moves once it does.

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

## The `SiteFooter` contract

`SiteFooter` is `SiteHeader`'s counterpart at the bottom of a public page: an optional `brand` on
top, then `groups` of links with an optional `aside` beside them, then an optional `bottom` line
under a top border. It has no JavaScript at all, no hook and no handler, so it renders the same on a
server-only page and with scripts off.

**Each group is its own landmark.** A group is `{ title, links }` and renders as
`<nav aria-label={title}>` holding an `<h2>` with the title and a `<ul>` of plain `<a href>` links.
A link with `external: true` gets an `IconExternalLink`, hidden from assistive tech, after its label.
Its `externalHint` ("(opens example.com)") follows as screen-reader-only text, since the icon says
nothing to a screen reader.
It still opens in the same tab: leaving the page is the visitor's choice.

**Layout.** On a phone the groups sit two to a row and `aside` takes the full width below them;
from `lg` up the groups share one row and `aside` takes its last third, or the groups take the whole
row when there is no `aside`. Each link is `py-3` around a `text-sm` line on a phone, 44 px tall,
and `py-1` from `lg` up. Colours are the theme's tokens, the same as `SiteHeader`'s bar.

**Every word is the caller's**, and a slot that is not given draws no element at all.

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

**The user menu is `AccountMenu`, drawn as its avatar alone (#756).** `AccountMenu` is `ui/`'s
`Dropdown`, not a second implementation; see "The `AccountMenu` contract". `user: null` renders no menu at
all — a signed-out visitor draws no trigger for an account that has not signed in. Given a user, the
trigger is an `Avatar` named from `user.name`, and `Dropdown`'s `triggerNamedByContent` is what turns
that computed name into the trigger button's own accessible name, the same mechanism
`DateRangePicker` uses for its own trigger.

**A user menu item is a link, a button or a form post (#457).** `href` draws a link, neither field
draws a button, and `action` draws a `<form method="post" action>` whose submit button is the item.
"Sign out" is the reason: it must be a POST, never a link a crawler or a cross-site page can follow,
and a form posts in a server-rendered app before hydration. The form carries `role="none"`, so the
accessibility tree still lists the button as an item of the menu. The button is a `DropdownItem`
with `type="submit"`, so it follows its `Dropdown` like every other item: once the page hydrates it
is a `role="menuitem"` with `tabindex="-1"`, which the arrow keys, Home, End, Escape and the
close-on-activate reach the same way; before that, or with scripts off, `Dropdown` is a plain
disclosure, and the button is an ordinary submit button that Tab reaches and Enter posts (#535,
#537). Given `onClick` too, a hydrated submit calls it and cancels the browser's own post, as
`AuthForm` does. `action` wins over `href`.

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

**`navigate` is the client-router port, shaped like `Rail`'s `navigateLink`.** Without it, every link is an
ordinary link. With it, a plain left click on a nav link, on an action that has an `href`, or on a
link item of the user menu (passed on to `AccountMenu`), calls `navigate(href)` and cancels the
browser's own navigation. A click with Ctrl, Meta, Shift or Alt held, or with another button, is
left to the browser, so "open in a new tab" still works, and such a click leaves the drawer open. A link to another origin is always the browser's, since a router
cannot open another site. A click something earlier already cancelled (a capture listener of
the app's own router, say) does not call the port twice; in the drawer it still closes the drawer.
Enter on a focused link fires the same plain click, so the keyboard takes the same path.

**The sidebar slots are functions, called once per place.** `sidebarTop` is drawn above the
navigation and `sidebarBottom` below it, in the desktop sidebar and again in the drawer, each
outside the `<nav>` landmark. Both exist because the apps need both: a workspace switcher belongs
above the links, and filters or a theme control sit below them. They are functions for the same
reason `navItems` is data: one element can only be mounted once. The `place` argument
(`"sidebar"` or `"drawer"`) lets the caller keep ids unique across the two copies. The desktop
column sticks under the header and is at most one screen tall, so `sidebarBottom` stays in view
on a long page and the column scrolls on its own when it overflows.

**A nav item's `action` is a sibling of its link, never inside it.** It is a second Tab stop, named
by the caller's required `action.label`, drawn as a link when it has an `href` (following
`navigate` like the item's own link) and as a button otherwise. In the drawer, a link action closes
the drawer like any link. A button action leaves the drawer open and focus on the button: it
usually opens something on the page, such as a create form, and closing the drawer under the
focused button would drop keyboard focus to `<body>`. The visitor closes the drawer as usual,
with Escape, the scrim or a link. Its icon defaults to `IconPlus`, the common "create" control.

**Collapsing hides the desktop sidebar; it does not shrink it to icons.** The slots hold content
with no icon form, and an item may have no icon; `Rail` is the frame for a navigation of
icons. `collapsed` and `onCollapsedChange` are a controlled pair: the collapse button is drawn in
the header, from `lg` up, only when `onCollapsedChange` is given, and reports its state with
`aria-expanded` and `aria-controls`. Where the value is stored is the caller's choice; the guide's
card keeps it in `localStorage` through `makeStorage` from `@spy4x/platform/browser/storage`, read
in an effect after mount. That read comes after the first paint, so a remembered collapse shows the
sidebar for a moment on load; an app that wants no flash reads the value before its first render,
from a cookie on the server for instance. The drawer below `lg` is not affected by `collapsed`.

**Every string beyond the caller's own data has an English default and a `labels` override**: the
menu button's name, the shared `aria-label` on both navigation landmarks, the skip link's text, the
user menu panel's `aria-label`, and the collapse button's name (`"Toggle sidebar"`).

### A control in a slot shows no band around its focus ring

A `Button` and the other controls that draw a focus ring leave a 2px gap between the control and
the ring, drawn in `--color-focus-offset`, which is the page colour unless a container sets it.
`SiteHeader`'s bar and `Shell`'s header and drawer are white in light while the page is grey, so a
caller's `Button` in `actions`, `status`, `sidebarTop` or `sidebarBottom` showed a grey band around
its ring there. Both bars now set the gap to their own colour in each palette, with the class string
`barFocusOffset` in `mobile-panel.ts`: `pc-focus-offset-surface` in light, the canvas colour in dark,
where the bars are drawn in the page colour. `Shell`'s drawer and `SiteHeader`'s menu panel are
drawn inside their bar's `<header>`, so they inherit the same gap.
`Calendar` needs neither: its panel is the surface colour in both palettes, and its cells draw their
gap with `ring-offset-surface` directly.

### Reusing `mobile-panel.ts`

`Shell`'s drawer wires the same `detailsRef`, `triggerRef` and `onToggle={handleToggle}` from
`useMobilePanel` that `SiteHeader` does, against its own `<details>`/`<summary>` markup. Nothing in
`Shell` reimplements Escape handling, the mount-time DOM read, or the client-navigation close — see
`useMobilePanel`'s own section above for what all three of those buy a visitor. Reusing the hook
unchanged, rather than writing a second one shaped like it, is what keeps the SiteHeader-vs-Modal
Escape-scoping proof and the Shell-vs-Dropdown one testing the same code path.

## The `AccountMenu` contract

`AccountMenu` (#756) is the signed-in person's menu, taken out of `Shell` so `AppShell`'s rail
carries the same one at its foot. It is `ui/`'s `Dropdown`, so the keyboard, the no-JavaScript
fallback and the focus moves are that component's. The menu holds, in order: the caller's `items`
(a link, a button, or a form post through `action`), the theme choice when `onThemeChange` is
given, and `signOut` after a divider.

**`navigate` is the client-router port, as on `DropdownItem`.** Without it, a link item is an
ordinary link and choosing it loads the page. With it, a plain left click on a link item (an `href`
and no `action`) calls `navigate(href)` and cancels the browser's own navigation, so "Profile" does
not reload the app. A click with Ctrl, Meta, Shift or Alt held, a click with another button, and a
link to another origin are left to the browser. Form posts and buttons never call it.

**Two triggers.** `display="full"`, the default, is one wide button with the avatar, the name and
the e-mail, named by that text (the avatar is `alt=""`, since the name is printed beside it); its
menu opens upward and spans the button's width. `display="avatar"` is the avatar alone, named by
`Avatar`'s label, the person's name: `Shell`'s header and the 72 px rail use it. `labels.trigger`
replaces either name.

**The theme choice is three radio items** (System, Light, Dark), each a `menuitemradio` with
`aria-checked`, in a `role="group"` named by the visible "Theme" heading. Choosing one calls
`onThemeChange` and closes the menu; the component stores nothing.

**`tag` marks a second app of the same product,** such as `"Admin"` for its admin panel. It draws
`AccountTag`, a neutral gray badge at the control radius: under the avatar in the avatar trigger,
after the name in the full one. The tag is part of the trigger's name ("Account: Uma Lee, Admin"
when `labels.trigger` says so), never colour alone. It is gray on purpose: an accent badge would be
a second accent beside the brand hue.

**`header` adds a row at the menu's top** with the avatar, the name, the tag and the e-mail, for the
avatar trigger, which shows none of them. The row is `aria-hidden`, because the trigger's name
already says who is signed in. `triggerClasses` and `panelClasses` are merged over the trigger's
and the panel's own classes, so a frame such as `AppShell` can size the trigger to its cell and open
the panel beside its column.

**`headerHref` makes that row a link,** such as to the profile, because a row that shows who is
signed in reads as a way to their settings. Given, the row is the menu's first item, drawn whether
or not `header` is set, named by its text and followed through `navigate` like the other link
items. `AppShell` passes `account.headerHref` on, and links its phone sheet's header row the same
way. Without it the row stays hidden from assistive technology and does nothing.

**The panel sits at `z-30`,** above `Shell`'s drawer (`z-20`) and `Rail`'s tab bar (`z-10`).
Inside an `overflow` container, such as the phone overlay, the panel can be clipped; a caller that
puts `AccountMenu` in a scrolling overlay leaves room below or above it.

## The `SettingsLayout` contract

`SettingsLayout` (#932) is a settings page split into sub-pages, such as a profile with Account,
Sign-in and security, and Delete account. It draws the page's `PageHeader`, a sub-navigation and
the open section's heading; the section's content is `children`.

**From `md` up** a 200 px sticky nav sits left of a `max-w-2xl` section column. The current item
has `aria-current="page"` and the accent tint the rail's current cell wears. Sections with
`tone: "danger"` come last, after a divider, in danger text, wherever they are in `sections`.

**Below `md` the list comes first, then one section.** With `current` set to `null` the nav is the
page: 44 px rows in a card, each with a chevron and its optional muted `value` ("Two-factor off").
With a section open, only that section shows, under a "Back to {title}" link to `href`
(`labels.back` replaces the words). The title stays in the document as screen-reader text. From
`md` up, `null` shows the nav and `children` with no section heading and no current item, so an
app draws an overview there or sends that address to its first section.

**Focus follows the change of section.** When `current` becomes a section, focus moves to its
heading (`tabindex="-1"`); when it goes back to `null`, to the nav item of the section that was
open. The first render moves nothing. `useRouteAnnouncer` runs after this, in the app's layout, and
moves focus on to the page's `<h1>` unless the app passes it `keepPageFocus: true`.

**Pure.** Every item is a real link through the `navigate` port, so the page works before any
script and a modified click opens a new tab. It reads no `location`; the app maps its route to
`current`. An id in `current` that names no section throws.

## The `StateInit` contract

`StateInit` (#135) is a generic SSR→client hydration bridge: the server renders `<StateInit data=
{value} />` once, and the browser reads the same value back with `readStateInit()`. Which keys
`data` holds is entirely the caller's business — this file never reads a field of it — which is what
makes it portable where the source applications' own versions were not: each of those hard-coded
that app's own environment keys directly into the component.

**The escaping is `SEOHead`'s own, reused rather than reimplemented.** `stateInitText` calls
`jsonLdText` from `@spy4x/platform/universal/seo`, the same function that already protects
`SEOHead`'s own JSON-LD script tag: `<` becomes the six characters `\u003c`, which keeps a value
containing the literal text
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
- **Structured data cannot close its script tag.** `jsonLdText` escapes `<`, so a `</script>` in
  the page title, in the caller's own JSON-LD entities or in a crumb name stays text.
- **Timezone-free grid arithmetic.** An ISO date carries no zone, so day steps in UTC cannot drift across a
  DST boundary and a weekday computed in UTC is the same weekday everywhere. A `timeZone` prop
  exists for the one question that genuinely needs it — which date is _today_ — plus an
  injectable `today` for deterministic renders.
- **No `Nav`, `Auth`, `Menu`, `Header`, `ProfileDropdown`, `LeadForm` or `NewsletterForm`.** Each
  one is in the table below with a reason. `ImageGallery` is in `ui/`.
- **A month anchor the calendar does not have is refused, not clipped.** `2026-02-30` throws
  rather than drawing March, as the helpers refuse `10/08/2026`: a caller who computed an
  impossible date is better told than quietly agreed with. A time zone the platform cannot resolve is the opposite case and gets
  the opposite answer: which zones exist is a property of the build's `Intl` data rather than of the
  caller's code, so an unknown one falls back to UTC instead of throwing out of the render.

## The screen boundary rule

`@spy4x/preact-system/boundary` is a development tool, not a component: a lint rule for an app
that keeps a folder of pure screens apart from its state and transport. A pure screen takes props
and reports through callbacks; the rule reports a module that imports a signals store, a router or
the app's own code, or that reads `fetch`, `window`, `document` or another browser global.

- `checkModule(source, options)` runs the rule over one module's text and returns every
  `BoundaryViolation` (`message`, `range`) Deno reports. Pass `filename`, the module's absolute
  path, so relative imports resolve and a `.ts` file is not parsed as `.tsx`. It calls
  `Deno.lint.runPlugin`, which Deno provides only under `deno test`, so call it from a test that
  walks the folder.
- `boundaryPlugin(options)` builds the Deno lint plugin itself (rule `ui/boundary`). Export its
  result as the default export of a module of your own to run it with `deno lint`.
- `forbiddenImport(source, filename, options)` is the import half on its own: why a specifier is
  forbidden, or `null`.
- `BoundaryLintPlugin`, `BoundaryRuleContext` and `BoundaryLintNode` type the slice of Deno's lint
  API the rule uses. Deno declares the full API only in its unstable library, which a published
  module may not reference. `boundary-types.test.ts`, which is not published, holds
  `boundaryPlugin()` to Deno's own `Deno.lint.Plugin` type, so the result passes straight to
  `Deno.lint.runPlugin` or a plugin module's default export.
- `BoundaryOptions` holds four lists. `forbiddenPackages` defaults to
  `DEFAULT_FORBIDDEN_PACKAGES` (`@preact/signals`, `@preact/signals-core`,
  `@spy4x/preact-signals`, `wouter-preact`); a subpath, a version or a `jsr:`/`npm:` prefix of one
  is forbidden too. `forbiddenGlobals` defaults to `DEFAULT_FORBIDDEN_GLOBALS` (`fetch`,
  `XMLHttpRequest`, `WebSocket`, `EventSource`, `window`, `document`, `location`, `history`,
  `navigator`, `localStorage`, `sessionStorage`). `appAliases` (import prefixes such as `"@api/"`)
  and `appDirectories` (directory names such as `"apps"` that a relative import must not resolve
  into) default to none, because only the app knows them.
- `forbiddenNames` lists exports an app must not import by name, each with the package it comes
  from and the reason the message prints. It defaults to `DEFAULT_FORBIDDEN_NAMES`, which holds
  `RailShell` from `@spy4x/preact-system`, any subpath of it included: an app draws `AppShell`, and
  `RailShell` stays only so an app can move in its own time. An `import { RailShell }` and an
  `export { RailShell } from` both fail; a dynamic `import()` is not checked by name. Pass `[]` to
  turn it off. `forbiddenName(source, names, options)` is that half on its own: the message for one
  imported name, or `null`.

`@spy4x/preact-system/boundary-runner` is that test, ready to register. It imports no test
framework: you pass your own `test` function, and a failure is a thrown `Error` that lists every
violation. [`docs/app-checks.md`](../docs/app-checks.md) has every option.

- `registerBoundaryTests(options)` registers a test that runs the rule over every module in
  `options.directories`, and fails too when a directory is missing or holds no module. With
  `boundary.appAliases`, `refusedImports` or `allowedImports` set, it registers a second test that
  checks those lists: each alias and refused import must be refused, each allowed import must pass.
- `BoundaryRunnerOptions` types the options; `DEFAULT_BOUNDARY_EXTENSIONS` is `.ts` and `.tsx`.

```ts
// tests/ui-boundary.test.ts
import { registerBoundaryTests } from "@spy4x/preact-system/boundary-runner"

registerBoundaryTests({
  test: Deno.test,
  root: new URL("../", import.meta.url),
  directories: ["libs/ui"],
  boundary: { appAliases: ["@api/"], appDirectories: ["apps"] },
  requiredFiles: ["libs/ui/auth-screen.tsx"],
  refusedImports: ["../../apps/spa/src/state/auth.ts"],
  allowedImports: ["./progressive.tsx"],
})
```

Run it from a test rather than listing the plugin under `lint.plugins` in a workspace's
`deno.json`: with a lint plugin in the workspace config, the `deno info` calls a Vite plugin makes
at startup stalled on the `node_modules` lock, and the app never started.

This library's own components are not pure screens in that sense: several keep local state in a
signal and touch `document` inside an effect, which "Component rules" in `AGENTS.md` allows.
`boundary.test.ts` holds `ui/` and `system/` to the narrower part that does apply: no router, no
`@spy4x/preact-signals` store, no network call and no `history` or storage access.

## The Playwright base configuration

`@spy4x/preact-system/playwright` is a development tool too: the Playwright options every app
shares, so an app's `playwright.config.ts` holds only its own values.

- `playwrightBaseConfig(options)` takes the app's `baseURL`, whether the run is in CI (`ci`), the
  device from the app's own Playwright (`chromium: devices["Desktop Chrome"]`) and optional extra
  `use` options. It returns `testDir` (`./e2e`), `testMatch` (any `*.e2e.ts`), `outputDir`, the CI
  switches (`forbidOnly`, two `retries`), one worker, the timeouts, the HTML and list reporters, a
  trace kept for each failed test, `data-e2e` as the test id attribute and one `chromium` project.
- `PlaywrightBaseOptions`, `PlaywrightBaseConfig`, `PlaywrightBaseUse` and `PlaywrightReporter` type
  what goes in and what comes out.

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test"
import { playwrightBaseConfig } from "@jsr/spy4x__preact-system/playwright"

export default defineConfig({
  ...playwrightBaseConfig({
    baseURL: "http://app.localhost",
    ci: !!Deno.env.get("CI"),
    chromium: devices["Desktop Chrome"],
  }),
  webServer: { command: "deno task start", url: "http://app.localhost/health" },
})
```

The import is the package's npm name, `@jsr/spy4x__preact-system`: Playwright loads its
configuration file itself and finds only packages in `node_modules`, so the JSR name fails there
with `Cannot find module`. [`docs/app-checks.md`](../docs/app-checks.md) has the one-time setup (two lines
in `deno.jsonc`), lists every shared value, says how to override one, and has
the CI step that installs Deno into the Playwright image.

The module imports nothing, `@playwright/test` included, so this package pins no Playwright version.

## Not in this package

| Left out                            | Why                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Menu`, `Header`, `ProfileDropdown` | Two source implementations of the same responsive header, both shaped around one app's markup and brand. Their dual-mode contract and accessibility fixes are in `Calendar`. |
| `LeadForm`, `NewsletterForm`        | Form chrome whose anti-bot fields (honeypot, page-load timestamp) and success states the host must render itself.                                                            |
| `themeBootstrapScript()`            | The FOUC-free inline `<head>` script belongs with `ts-libs`, next to the other head-platform helpers.                                                                        |

## Offline sync and install

Components for an offline-first app. None of them imports a queue or a store: they take
plain values and callbacks, so they work with any outbox and ship on their own.

- **`SyncStatus`** is one compact line for a header or a status bar: offline, "3 changes waiting
  to sync", syncing, "Sync failed" with a Retry button, or "All changes synced" (`labels.synced: ""`
  hides that one). The words sit in a `role="status"` region that is always in the page, so every
  change is announced politely, and the component never moves focus on its own. A shape beside the
  words tells the states apart without colour. `syncState(input)` is the precedence it uses, most
  urgent first: offline, failed, syncing, waiting, synced. `DEFAULT_SYNC_STATUS_LABELS` holds its
  English words.
- **`SavedCopyNotice`** is the banner above a list that says the list is a copy saved on this
  device, and when: "The server is out of reach. This copy was saved on this device: 12/10/2026
  14:05." `SyncStatus` says whether this person's changes went out; this says how old what they are
  reading is, and an app often shows both. Render it always and pass `savedAt` (a `Date` or epoch
  milliseconds) only while a saved copy is on screen: with `null` it is an empty `role="status"`
  region that takes no room, so the notice is announced when the copy arrives. It is announced
  once for each copy, because the time is worded when `savedAt` changes and not on every render.
  For the same reason `formatTime` should return a clock time, which stays true, and not "5
  minutes ago", which would stay on screen as it was. The default is the date and the time in the
  host's time zone from `formatTime` in `@spy4x/platform/universal/time`, with the date even for
  today. `labels.title` and `labels.body(time)` replace the words, and
  `DEFAULT_SAVED_COPY_NOTICE_LABELS` holds the English ones. `data-saved-at` on the element is
  the time as an ISO string. Any other attribute, such as `id` or `data-e2e`, lands on the element
  in both states, so a test selects the notice by its own hook and reads whether it is empty. Make
  it a direct child of the layout: empty, it is out of the flow and adds no gap, and a wrapper
  element around it would add one. Only `null`, `undefined` and an invalid date mean "no copy";
  `0` is 1 January 1970 and shows a banner. The banner has the look of a warning `Notice`, and a
  test fails when the two drift apart.
- **`ConflictChooser`** lists the changes the server did not take. Each says in plain words what
  happened, changed elsewhere (`version`), deleted elsewhere (`gone`) or refused by the server
  (`rejected`), and offers the choices that make sense: "Keep mine" and "Use theirs" for a change
  made elsewhere, and only "Discard mine" for a deleted item or a refusal. `offersKeepMine(item)`
  is that rule. An item opts in with `canKeepMine: true`: on a `gone` item the button then reads
  "Restore mine", for an outbox whose `keepMine` re-creates a deleted item. It renders inline, which
  suits a phone; for a dialog, put it inside `Modal` from `@spy4x/preact-ui` and set
  `headingLevel` to fit the dialog's own title. When a choice removes the item whose button had
  focus, focus moves to the next item, or to the heading once none is left. "All conflicts
  resolved" is said once: by that heading taking focus, or else by a polite live region. A
  callback may return a promise: its item's buttons stay busy until it settles, and a rejection
  shows `labels.failed` under the item and announces it, with nothing left uncaught.
  `DEFAULT_CONFLICT_CHOOSER_LABELS` holds its English words; `labels` replaces any of them, per
  reason inside the records.
- **`UnsentChangesDialog`** asks before a person signs out while changes wait to reach the
  server: "Send, then sign out" (the one primary action, focused on open), "Sign out anyway", or
  "Cancel" (also Escape, the close control and the backdrop). Mount it to open it, as
  `ConfirmDialog`. The caller owns the waiting: on `onSend` it starts sending and passes `state`
  (`sending`, `offline` or `retrying`) and the counts as they drop, then signs out itself once
  nothing sendable is left. The same dialog shows the wait: the primary stays focused and busy, and
  one polite `role="status"` line with a progress bar ("1 of 3 sent") changes only when the state
  or a count does. Changes the server refused never send alone: pass them as `conflicts`. Once
  every change left is one (`unsent` equals `conflicts`), the title says they need a choice and the
  primary becomes "Review changes" on the same button, so focus stays. The default words say that
  signing out keeps the changes on this browser, to send at the next sign-in there; replace
  `labels.kept` if your app does something else with them. `DEFAULT_UNSENT_CHANGES_DIALOG_LABELS`
  holds its English words, and every control has a fixed `data-e2e` (`unsent-dialog`,
  `unsent-wait`, `unsent-review`, `unsent-sign-out-anyway`, `unsent-cancel`, `unsent-status`).
- **`InstallPrompt`** offers to install the app: an Install button where the browser has an
  install dialog (`mode: "prompt"`), and "Tap Share, then Add to Home Screen" on an iPhone or iPad
  (`mode: "ios"`). It renders nothing for `installed` and `unavailable`. `createInstallPrompt` in
  `@spy4x/preact-signals` supplies the mode and remembers a dismissal through a port. When the card
  leaves while focus is inside it, after "Not now" or an accepted install, focus moves to the
  element `returnFocus` returns, which must be focusable: a button, or an element with
  `tabIndex={-1}`; `pageHeading` from the `route-announcer` subpath is the page's heading, for a
  card above the page. Without one, focus falls to the page body. A rejected `onInstall` shows `labels.failed` in the card.
  `DEFAULT_INSTALL_PROMPT_LABELS` holds its English words.
- **`PushSettings`** is the block in an app's settings that says whether this device gets
  notifications and turns them on or off. It shows one state: `checking`, `unsupported`,
  `needs-install` (an iPhone or iPad in a browser tab: add the app to the home screen first),
  `unavailable` (the server has no keys), `blocked` (how to allow them, in words that hold in a
  browser tab and in an installed app, and no button, because none could work), `off` (Turn on) or `on` (Turn off and, with `onTest`, Send a
  test notification). It touches no browser API and never asks for permission: `onEnable` does,
  so the browser's prompt opens only after the press. `usePushSubscription` in
  `@spy4x/preact-signals` returns exactly these props. `busy` names the action whose button shows
  a spinner, and `failed` the one whose message shows under the buttons. An always-present
  `role="status"` region announces "turned on", "turned off", a failure and a sent test, and
  nothing on page load. Turn on and Turn off are one button, so focus stays on it; when the
  button leaves because the browser blocked notifications, focus moves to the explanation, and
  the region stays empty then so the explanation is heard once. The
  block has no frame of its own: pass `class="pc-card p-4"` for a card.
  `DEFAULT_PUSH_SETTINGS_LABELS` holds its English words.
- The update banner is `SWUpdater`, above; there is no second one.

### Wiring them to an `Outbox`

The outbox in `@spy4x/realtime/outbox` (spy4x/ts-libs) fits these props as follows. This package
does not import it.

```tsx
import { createInstallPrompt, createOnlineStatus } from "@spy4x/preact-signals"
import {
  ConflictChooser,
  InstallPrompt,
  SavedCopyNotice,
  SyncStatus,
  UnsentChangesDialog,
} from "@spy4x/preact-system"

const connection = createOnlineStatus()
const install = createInstallPrompt({ dismissed: localFlag("install-dismissed") })
// In the client entry point: connection.watch(); install.watch()

// `entries` is a signal the app refreshes from `outbox.entries()` after every change, and
// `syncing` and `failed` come from whatever runs `outbox.flush()`.
const pending = entries.value.filter((entry) => !entry.conflict).length
const conflicts = entries.value.filter((entry) => entry.conflict).map((entry) => ({
  id: String(entry.seq),
  label: entry.payload.title,
  reason: entry.conflict!.reason,
  message: entry.conflict!.reason === "rejected" ? entry.conflict!.message : undefined,
}))
const byId = (id: string) => entries.value.find((entry) => String(entry.seq) === id)!

<SyncStatus
  online={connection.online.value}
  pending={pending}
  syncing={syncing.value}
  failed={failed.value}
  onRetry={() => runSync()}
/>
// `savedAt` is when the list on screen was saved, or null once the server has answered.
<SavedCopyNotice savedAt={savedAt.value} />
<ConflictChooser
  conflicts={conflicts}
  onKeepMine={(id) => outbox.keepMine(byId(id)).then(refresh)}
  onUseTheirs={(id) => outbox.useTheirs(byId(id)).then(refresh)}
/>
// At sign-out, when the outbox holds anything. `sent` counts what left since "Send" was pressed.
{asking.value && (
  <UnsentChangesDialog
    unsent={entries.value.length}
    conflicts={conflicts.length}
    sent={sent.value}
    state={!asking.value.sending ? "ask" : !connection.online.value ? "offline"
      : failed.value ? "retrying" : "sending"}
    onSend={() => (asking.value = { sending: true })}
    onSignOut={signOut}
    onCancel={() => (asking.value = null)}
    onReview={() => (asking.value = null)}
  />
)}
<InstallPrompt mode={install.visible.value ? install.mode.value : "unavailable"}
  onInstall={install.install} onDismiss={install.dismiss}
  returnFocus={() => document.getElementById("app-menu")} />
```

A `gone` conflict offers only "Discard mine" here, because the outbox's `keepMine` does nothing for
a deleted item today. Once it re-creates one, map `canKeepMine: true` for `gone` entries and the
item offers "Restore mine" too.

## Helpers

Helpers the sections above do not already name, each importable from the package root or from its
component's subpath.

- `describeCalendarDay(day)` is `Calendar`'s default description of one day cell: the date as the
  locale writes it, then why it cannot be picked (`past`, outside the allowed range, none left, not
  available). A selectable day adds how many are available when it has a count, and only "available"
  when it has none. A `labels.day` of your own can call it and add to its text.
- `seoHeadJsonLd(head)` builds the JSON-LD `@graph` `SEOHead` prints: the caller's `jsonLd`
  entities, then a `BreadcrumbList` when there are at least two `crumbs`. It returns `[]` when there
  is nothing to print. Use it to put the same structured data somewhere other than the head.
- `isCurrentLink(href, currentPath)` answers whether a link is the current page. It is exact string
  equality, so `/docs` is not current while `/docs/intro` is on screen; normalise `currentPath`
  first if your routes want a prefix match. `SiteHeader` and `Shell` use it for `aria-current`;
  `Rail` adds the section match described in its contract.
- `TAB_BAR_SLOTS` is `5`, the number of slots in `Rail`'s phone tab bar, "More" included, and
  `tabBarSlots(items, primary?, reserveMore?)` splits the entries between the bar and the sheet.
- `serviceWorkerContainer(host)` returns `host.serviceWorker`, by default from
  `globalThis.navigator`, or `undefined` where there is none, such as on the server.
- `skipWaiting(registration, message)` posts `message` (by default `DEFAULT_UPDATE_MESSAGE`,
  `{ action: "skipWaiting" }`) to the registration's waiting worker, and returns `false` when no
  worker is waiting. `reloadOnControllerChange(container, reload)` calls `reload` once a new worker
  takes control and returns a function that removes the listener. Together with `watchForUpdate`
  they are what `SWUpdater` does, for a host that owns its registration and draws its own prompt;
  arm the reload only when the visitor asks for it (see "The service-worker contract" above).

## Tests

`deno task check` from the repository root runs this suite with the rest of the workspace. Every
component is rendered with `preact-render-to-string` and asserted on real markup: emitted head tag
sets, the dual-mode swap, and a 42-cell grid for a month that starts on any weekday.

Where a component only works against a browser API, that API is a sealed boundary the tests can
replace: `SWUpdater`'s listeners are driven by a fake registration, its registration by a fake
container through `startUpdates`, and `resolveImage` by an element stub. No jsdom, and no request
that a test not exist for a branch that only a browser reaches.

What a fake cannot prove is that the component finds a real browser's container at all. The proof
lives in `pages/checks/system.ts` and
runs under `deno task --cwd pages verify`: headless Chromium registers the demo worker, a second
script at the same scope leaves a worker waiting, and the bar has to appear.

The same file carries the proof of everything on this page that is a key press, a focus change or a
click landing somewhere: no test here can reach any of them, because every one of them renders a
component to an HTML string. What a string render _can_ show — which element carries which role,
which column header holds which text, that a month anchor is refused — is asserted in
`calendar.test.tsx` and `date.test.ts`; everything else is in the browser file or is unproven.

`auth-form.test.tsx` is the same split again: markup, `autocomplete`, `name`, `required`, `method`
being `"post"` with and without `action`, the error shape and every fixed `data-e2e` hook are all a
string render can show, and are asserted there. The focus move to the code field, the mode switch pressed with a real pointer,
the show/hide toggle's real click and Space press, the error arriving as a change to the
already-present live region, a busy `requestSubmit()` calling no callback, and a submit surviving
disabled script execution with no query string added to the URL are effects, key presses, a focus
change and a real navigation — none reachable from a string render — and are proven in
`pages/checks/system.ts` instead.

`site-footer.test.tsx` covers all of `SiteFooter`, since it has no behaviour beyond its markup: each
group as a `<nav>` named by its title with its heading and links, the external marker, the
phone-width padding of a link, each slot rendered as given and no element drawn for a slot that is
not, and the full set of visible words, so a hard-coded string has nowhere to hide.

`site-header.test.tsx` is the markup half of `SiteHeader`: every link's `href` present once inline
and once in the panel, `aria-current` on the one link matching `currentPath` and on no other, `brand`
rendered with no anchor of the component's own around it, `actions` rendered exactly once, the menu
button starting with `aria-expanded` omitted rather than a hard-coded `"false"` and a fixed name, its
`aria-controls` pointing at the panel's own id, no `<nav>` and no menu button when `links` is empty
or left out, the panel positioned to overlay rather than sit in
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
other link and wired to a focusable `#`-targeted `<main>`, a `labels` override replacing every default, an item's `action`
drawn beside its link rather than inside it (as a button, or as a link of its own with an `href`),
`sidebarTop` and `sidebarBottom` drawn in both places around the `<nav>` and told which place, the
collapse button absent without `onCollapsedChange` and otherwise reporting `aria-expanded` against
the sidebar it controls, and a caller's `class`
merged onto the root without losing its own — checked, as `site-header.test.tsx` is, against the full
set of visible words the render produces. Opening the drawer with a real click, a real Escape closing
it, an Escape aimed at the drawer landing in the same task as the click that opened it, Tab order
through the drawer's links, the header holding still (byte-identical screenshots) while the drawer
opens at phone width and while the user menu opens at desktop width, the skip link moving focus to
the content area rather than only the hash, and the two-directions Escape-scoping proof between the
drawer and the user menu, a plain click going through `navigate` while a Ctrl-click does not, a
drawer link going through `navigate` and closing the drawer, an item's action reached by Tab and
pressed with Enter, a button action in the drawer leaving it open with focus kept, the sidebar
column staying under the header with its bottom slot in view on a page taller than the screen,
and the collapse surviving a fresh load are
effects, key presses, a focus change, layout and real pointer/keyboard input — none reachable from a
string render — and are proven in `pages/checks/system.ts` instead.

`state-init.test.tsx` is everything `StateInit` has that a string render can prove: `stateInitText`
round-tripping `</script>`, `<!--` and both line separators unchanged through `JSON.parse`, its
escaping matching `SEOHead`'s own byte for byte, the rendered `<script type="application/json">`
matching exactly, the `id` default and override, and `readStateInit` reading a fake `{
getElementById }` source correctly — including the three ways there is nothing to read: no matching
`id`, no text content, and text that fails to parse. There is nothing left for `pages/checks/system.ts`
to prove for this component: it touches no listener, no focus and no timer, so nothing about it is
unreachable from a string render.

## The `Rail` contract

`Rail` (#798) is the house frame's navigation: a column from `md` at every desktop width, and
below `md` a bottom tab bar of at most five slots whose last slot opens a sheet with the rest. Apps
draw `AppShell`, which builds on it; a site whose first-time visitors do not know the icons draws
`Rail` with `variant="labels"` itself. `Shell` (a header, a sidebar and a `<details>` drawer) and
`SiteHeader` (a public site's top bar) are different in kind: neither has a rail or a tab bar.

**Two variants, two widths.** The column is 72 px (`w-18`) in the icons variant and 88 px
(`w-22`) in the labels variant, plus the device's left safe-area inset (`pl-safe`), so a landscape
phone's notch never covers a cell. The page beside it is the rest of the row, so it follows either
width. `"icons"`, the default, draws a 48 px square per destination with the label as visually
hidden text. `"labels"` draws an 80 × 56 px cell with 4 px of side padding and a `text-xs` label
under the icon, 72 px wide at most and clamped to two lines, and no tooltip, so it renders on the
server and works with no script. On a screen whose pointer cannot hover (`(hover: none)`, such as
a tablet), the icons variant draws the labels too, in 64 px cells, because a tooltip cannot appear
there; its width does not change.

**Three zones, one scrolls.** The column is an `<aside>` named by `labels.sidebar` ("Sidebar" by
default), so the zones' controls sit inside a landmark. `top` is above the `<nav>`, `bottom` at the
column's foot, and only the `<nav>` between them scrolls, on its own, when the window is too short,
as on a phone held sideways. The column sticks at the window's full height (`--rail-height`,
`100dvh` by default, which a bounded container sets to its own height). `top` and `bottom` are
render props called with the place they are drawn in, `"rail"` or `"sheet"`, so a slot can draw a
compact form in the column.

**Tooltips in the icons variant** are `aria-hidden` copies of the label, beside the cell rather than
inside it, so the cell's name is its hidden text alone. One shows 8 px past the column 300 ms after
the pointer rests on a cell, so moving the pointer down the rail flashes nothing, and at once on
keyboard focus (`:focus-visible`). Each is `position: fixed`, so the scrolling list does not clip
it; the cell's own box, read on hover and focus, places it, so it shows only after hydration, and it
follows its cell when the list scrolls. An invisible bridge joins the cell to its tooltip, so the
pointer can cross the gap. An ancestor with a `transform` or `filter` becomes a fixed element's
containing block and would misplace it. Escape hides them while the pointer or focus stays in the
column, without moving focus or consuming the key; the next hover or focus brings them back. A
cell whose menu is open (`aria-expanded="true"`) shows none.

**A slot's control draws as a cell with `RailCell`.** `<RailCell tip="Acme">` wraps a caller's
control in `top` or `bottom` the way the rail wraps an entry, so `Rail` places its tooltip and it
shows, hides and waits exactly as an entry's. `railFocusRing` is the entries' focus ring as a class
string, for the caller's own control, such as a `Dropdown` trigger. `AppShell`'s connection and
account cells are drawn with it. In the labels variant, whose cells print their label, a `RailCell`
draws no tooltip: `Rail` hands its variant to the cells in its slots.

**A slot's link draws as an entry with `RailEntry`.** `<RailEntry item={home} place="rail"
variant="labels" current="page" />` draws a `RailItem` exactly as `Rail` draws its own: in the
column a cell of the variant (with its tooltip in the icons variant), in the sheet a 44 px row, with
the same fill, hover, focus ring and `aria-current`. `current` is the caller's answer for its page.
The `Icon` may draw any element, such as a site's portrait photo. In the sheet, a `RailEntry` with
no `href` carries `data-rail-close`, so choosing it closes the sheet.

**Key shortcuts.** An item's `keyshortcuts`, such as `["mod+k", "/"]`, names the combinations the
app binds to what the entry does, written the way `useHotkeys` takes them. The rail binds nothing:
the entry announces every combination in `aria-keyshortcuts`, in every place, and the icons
variant's tooltip shows the first after the label as the platform writes it, "Search (Ctrl K)" or
"Search (⌘K)". `labels.kbd` overrides the words, such as "Ctrl". The phone's tab and sheet row show
no hint.

**Sheet-only items.** An item with `sheetOnly: true` is drawn only as a row of the phone sheet,
never in the column or as a tab, such as a site's Home, which the column reaches through the
portrait. Any such item gives the bar its sheet slot; the sheet lists the items that did not fit
and the sheet-only ones in the caller's order, and the last slot is marked current while any of
them is the page or holds it.

**A slot that renders nothing draws nothing.** A place for which `top` or `bottom` returns `null`,
`undefined`, a boolean, `""` or a list of those gets no zone in the column and no section in the
sheet, so no empty `<div>` takes a margin. A component that renders `null` is not detected.

**`footer`** is drawn after `<main>` and outside it, under the page in the content column at every
width, such as a site's `<footer>`, which keeps its `contentinfo` landmark there. With a footer,
`<main>` and the footer share one column wrapper (`data-e2e="rail-shell-page"`).

**The current entry is a filled cell.** It is tinted with the accent and drawn in the selected text
colour; there is no bar on its edge. Under forced colours, where a fill disappears, a 2 px outline
in `CanvasText` marks it. `currentKey` marks an item by key. `currentPath` marks the item whose
`href` equals it with `aria-current="page"`; with no exact match, the item whose `href` is the
longest prefix of the path followed by `/` gets `aria-current="true"`, so a note's page shows its
section as current without claiming to be the list. `"/"` never claims a section.

**The primary action** is the one accent-filled cell, pinned first in the column, and in the tab
bar's centre slot (the left of the two middle slots in an even bar), so a thumb reaches it. Apps
pass none.

**Which entries become tabs.** Items and the primary action together fill the bar when they number
five or fewer and there is nothing else for the sheet. Past five, or with `top` or `bottom`
given, the last slot opens the sheet, and the first items fill the rest. The sheet then
holds `top("sheet")`, the items that did not fit and `bottom("sheet")`, with a hairline between
them. `moreTab` sets the last slot's `icon` and `counter`; its words are `labels.more`.
`tabBarSlots(items, primary, reserveMore)` is that rule as a pure function.

**The sheet is a modal `<dialog>`,** for Escape, an inert page and the top layer from the browser.
`showModal()` moves focus to the close button. Escape closes it natively. A backdrop click closes
it natively too where the browser honours `closedby="any"` (Chrome and Edge 134+, Firefox 141+; no
shipping Safari, the support floor `Modal` documents), and through a click handler elsewhere. The
close button, choosing an entry, a plain click on any link inside it and a click on an element
marked `data-rail-close` close it too. Every way of closing ends in the `close` event, which
returns focus to the last slot. With no JavaScript every entry that has an `href` is a link, and the
last slot and the close button carry `command`/`commandfor`, so a browser that supports invoker
commands still opens and closes the sheet.

**Counters.** `RailItem.counter` draws an `aria-hidden` badge on the icon's top-right corner, and
the entry is named by an `aria-label` of its label and `labels.counter(count)`, "Notes, 3" by
default, so a screen reader hears "Notes, 3 unread" with `counter: (n) => \`${n} unread\``. Past 99
the badge shows "99+" and the name keeps the exact count. A counter of 0 draws nothing.

**Nothing covers the page.** The column is a column in the layout. The tab bar sticks to the bottom
but keeps its place in the flow, pads itself by the bottom safe-area inset, and below `md` gives the
root element the tab bar's scroll padding, so a control tabbed to near the bottom scrolls into view
above it. `tabBarNotice` is drawn right above the bar, such as an offline strip. Inside a bounded,
scrolling container, pass `class="min-h-full"` in place of the default `min-h-dvh`, and that
container becomes what both stick to.

**Links reach a client router through `navigateLink`.** An entry with an `href` is a real link.
With `navigateLink`, a plain left click on a same-origin link calls `navigateLink(key, href)` and
cancels the browser's navigation; every other click is left to the browser. The rule is
`followLinkClick` from `ui/`'s `link`. `navigate` is the port for an entry with no `href`, which is
a button. `RailItem.attributes` passes `data-*` attributes to an entry's link or button, for
analytics or a test hook.

**Colours are theme tokens read through `var()`,** each with the default palette's value as its
fallback, so the rail follows whichever palette the page sets. The focus ring is `--color-ring`;
the primary action is `Button`'s primary fill, with a 1 px border in the dark palettes, where the
fill alone stands too close to the rail; a counter's badge is the accent, or accent step 400 with
dark text in the dark palettes.

**Icons come from the caller** as a component (`Icon`), not an element, because every entry is drawn
twice, in the column and in the tab bar or the sheet, and one element can only be mounted once.

`rail.test.tsx` proves what a string render can: the split and the centre slot, `aria-current` by
key, by exact path and by section, the fill and the forced-colours outline, the hidden name and the
tooltip beside the cell, both variants' cells, the column's width and inset, the attributes, the
labels and their overrides, the counter's badge and name, `RailEntry` matching an entry's cell and
sheet row, sheet-only items and the current More slot, `RailCell` without a tooltip in the labels
variant, the footer after `<main>`, `closedby` on the sheet and no wrapper for an empty slot. A
backdrop tap closing the sheet with no script is proven in `pages/e2e/system.spec.ts`. The
tooltip's delay, focus and
Escape, the sheet's focus return, the centre slot on a phone and axe in light and dark at 390 and
1440 px are proven in `pages/e2e/system.spec.ts`; the breakpoint switch, the dialog's keyboard and
pointer behaviour, the skip link and which link clicks `navigateLink` takes in
`pages/checks/system.ts`, through the `RailShell` card.

## The `AppShell` contract

`AppShell` (#798) is all the chrome around an app's page, the same for every product and its admin
panel. An app passes data, never markup: its destinations, the signed-in person, the unread count,
the connection and the page. It is `Rail`'s icons variant with the bottom zone filled in, and it
draws no brand mark and no top bar: the page starts with its own `PageHeader`.

- **The bottom zone,** in order: the connection while it is news (`"idle"`, `"closed"` or `"reconnecting"`), a
  warning cell with a tooltip; the bell, a link named with its count ("Notifications, 3 unread");
  and the account, `AccountMenu` drawn as the avatar with its `header` row, opening beside the
  column. While `account.user` is unknown, a plain placeholder stands in its place and no menu is
  drawn; it fades in only after 300 ms, so a fast load shows nothing.
- **The admin's mark** is `account.tag`, `"Admin"` in an admin panel: the neutral badge under the
  avatar, part of the account button's name ("Account: Uma Lee, Admin"), and the phone's last tab's
  label in place of "Account". The admin panel passes no `switcher`.
- **One live region.** A `role="status"` span (`data-e2e="shell-ws-status"`) is always in the page,
  outside the rail, and speaks the connection's word when it changes; it is empty without a
  `connection`. The warning cell and the phone strip are `aria-hidden`, so the state is announced
  once.
- **The phone.** At most four destinations reach the tab bar; the last slot is the account, the
  avatar with the unread count, opening a sheet with the switcher, the destinations that did not
  fit, Notifications, then the account: the header row, the menu's items, the theme as three
  pressed buttons, and **Sign out** last. While the connection is news, a strip above the tab bar
  shows it.
- **The page column** is centred in the space beside the rail, `px-4 md:px-8` and `py-6 sm:py-8`
  outside it: 48 rem by default, 64 rem with `width="wide"`, for tables. `banner` sits above the
  page in the same column. Nothing else sets a width.
- **Ports:** `navigate(href)` receives a plain click on any shell link, the destinations, the bell
  and the account's links. Every label has an English default and an override in `labels`.

`app-shell.test.tsx` proves the bell's name, the account's name with and without a tag, the badge's
neutral colour in the column, the tab and the sheet, the one live region, the connection cell and
strip, the bottom zone's order, the column widths and the banner, the phone split and the sheet's
order, the theme buttons, the placeholder, the absence of a top bar, and every label's override.

## `RailShell`, kept for the move

`RailShell` is `<Rail variant="icons">` under its earlier name: `sidebarTop` and `sidebarBottom` are
`top` and `bottom`, and their place, `RailShellSidebarPlace`, is `"rail"` or `"overlay"` (the
sheet). It keeps the `rail-shell-*` test hooks, which `Rail` draws too, so an app's page objects
keep working; it has no `header` slot and no `rail-shell-header` hook, and its height is
`--rail-height`. `tabBarSlots` keeps the primary action in the tab bar's centre slot, and the items
give way when they overflow. App code draws `AppShell`; the boundary rule fails a
test that imports `RailShell` (see "The screen boundary rule").
