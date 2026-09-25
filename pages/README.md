# `pages/` — the public demo deployment

The live catalogue on GitHub Pages: **<https://spy4x.github.io/preact-components/>**

Anyone can open that URL and touch every component — no clone, no build, no local setup. It is the
"try before you adopt" surface for the library, and the fastest way to show a component to someone in
a chat or an issue thread.

This directory is **demo infrastructure, not library code**. Nothing in it is published, nothing in it
is imported by a package, and it adds no dependency to the root `deno.jsonc` import map: it is a
workspace member only so it can import its sibling packages the way an app does.

## What runs at that URL

| Piece             | Where it comes from                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| The catalogue     | `UIGuide` from `@spy4x/preact-ui-guide`, unmodified — its navigation, one page at a time, and the deep links |
| The host page     | `src/app.tsx` — header, the colour-scheme switch, the footer, and the address handed to the guide            |
| The styles        | `theme/tokens.css` + `theme/preset.css`, compiled by Tailwind into one stylesheet                            |
| The interactivity | `src/+main.tsx`, one Preact island that hydrates the prerendered markup                                      |

Static files only. `index.html` ships the whole catalogue prerendered, so it reads with JavaScript
off; the island is what makes the dropdowns open, the switches toggle, the icon filter filter, the
usage blocks copy, the toasts fire and the deep links scroll.

## Files

| File                      | Contents                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `build.ts`                | Type-checks, compiles the stylesheet, bundles the island, prerenders, writes `dist/`                      |
| `styles.css`              | The app-order stylesheet an app writes, plus the `@source` rules the scanner reads                        |
| `verify.ts`               | Asserts the artefact's shape, then drives the built page in headless Chromium                             |
| `checks/`                 | One browser-check file per workspace package, plus the shared `Devtools`/`check` harness                  |
| `screenshots.ts`          | Writes the README's screenshots and the social preview to `docs/screenshots/` from the built site         |
| `serve.ts`                | Static server that mounts `dist/` at the deployed base (`deno task preview`)                              |
| `src/app.tsx`             | The host page — the app shell this library deliberately does not ship                                     |
| `src/+main.tsx`           | The island: `hydrate(<App />, #root)`                                                                     |
| `src/prerender.tsx`       | The server half: `renderToString(<App />)`, same component                                                |
| `src/document.tsx`        | The HTML document template, including the pre-paint colour-scheme script and the route echo               |
| `src/deep-link.ts`        | Fragment ⇄ component mapping (`#toggle-switch` ⇄ `ToggleSwitch`); the slug rule is `ui-guide/routes.ts`'s |
| `src/route-echo.ts`       | Emits the route table into the document and reads it back out, validated with `arktype`                   |
| `src/tailwind-sources.ts` | Rewrites the `@source` entries Tailwind hands back into what its scanner resolves                         |
| `src/site.ts`             | Base path, origin, title, description, favicon                                                            |
| `dist/`                   | The artefact. Gitignored, and excluded from the repo's fmt/lint/type-check walk                           |

## Commands

```bash
deno task --cwd pages build      # → pages/dist: index.html, assets/main.<hash>.{js,css}
deno task --cwd pages verify     # static checks, then the browser checks
deno task --cwd pages preview    # serve the built directory at /preact-components/
deno task --cwd pages screenshots  # retake docs/screenshots/ from the built directory
```

Before anything else, `verify` refuses a `dist/` that was not built from the working tree it is
running against: `build.ts` writes a fingerprint of every source the build reads into
`dist/.build-hash`, and `verify` recomputes it and compares before the static phase or the browser
touches anything. A missing or mismatched fingerprint fails as one named check and exits — run
`deno task --cwd pages build` and try again. This is what catches a `dist/` left over from before a
rebase or a branch switch (#280); `pages/build-fingerprint.ts` documents exactly what is hashed.

`verify` needs a Chromium binary (it looks for `chromium-browser`, `chromium`, `google-chrome`,
`google-chrome-stable`, `chrome`, or `$CHROME_PATH`). **Not finding one is a failure:** the run
records a failed check and exits non-zero, because the browser phase carries every assertion about
behaviour the markup cannot show, and a run that quietly dropped it reported green for code nothing
had executed. A `$CHROME_PATH` that does not run fails the same way, and says the configured path
did not run rather than falling back to some other browser on the machine.
`deno task --cwd pages verify --static` is the one explicit way to leave the browser phase out.

### Running one block alone

`deno task --cwd pages verify --only=system` restricts the browser phase to one workspace package's
own checks — `--only=system,ui` for more than one. It exists because reproducing a flake that only
shows up when the other blocks are _not_ run first needs the other blocks left out, and before
`#253` the only way to do that was to hand-edit `PACKAGE_BLOCKS` in `pages/verify.ts` and revert it
afterward; three separate reviews had already done exactly that.

This is a debugging tool, never a substitute for a full run, and the output says so loudly: a
filtered run's very last printed line reads `FILTERED: ran <blocks>, left out <blocks>` — passed to
`report()` as its `note`, so it prints after every check line and the summary, not somewhere earlier
a reader could mistake for part of the run's setup. CI never passes `--only`. An unknown block name
is a failed check (`--only names only known package blocks`) rather than a run that silently did
less than it was asked — `pages/checks/harness.test.ts`'s `selectBlocks` cases cover that and the
ordering and de-duplication `pages/verify.ts` relies on.

### Running under load

A check that waits a fixed time, or reads before the component has finished, passes on an idle
machine and fails on a busy one — on correct code. CI runners are sometimes busy, so a reviewer
should be able to make the page slow on purpose (#269). There are two ways, and the first is the
one that finds things:

```bash
deno task --cwd pages verify --cpu-throttle=6
```

runs the page's main thread six times slower through Chromium's own CPU throttling, the same on
every machine, and multiplies the browser phase's deadline by the same rate. Its last line starts
`THROTTLED:`; CI never passes it. A full run at `6` took six minutes here.

The second loads every core of the machine, with its own deadline and a cap on its processes, while
full runs go on in another terminal, noting `uptime` with each:

```bash
systemd-run --user --scope --quiet -p TasksMax=100 timeout 1200 stress-ng --cpu 0 --timeout 1100s
uptime && systemd-run --user --scope --quiet -p TasksMax=500 -p MemoryMax=8G timeout 900 deno task --cwd pages verify
```

On a 16-core machine that holds the load average near 20. It is what the issue asked for, and it is
worth running, but it is weak: ten full runs of unchanged code at load averages of 20 and 65 all
passed, while throttled runs found failures on the first try. A check that fails under either is a
check to fix, not to re-run: poll on the state it asserts, read in the same evaluate as the action,
or measure a duration with the page's own clock.

`verify` denies downloads for the whole run: right after it connects, it calls
`Browser.setDownloadBehavior` with `deny`, falls back to `Page.setDownloadBehavior`, and prints a note
and carries on if neither exists. A check that exports a file reads its bytes inside the page, so it
never needs the file on disk.

This is also the repository's browser test path, and CI runs it. `.github/workflows/pages.yml` runs
`deno task check`, `deno task publish:dry`, the build and `verify` on every pull request into
`main` and on every push to `main`, on a runner image that ships Google Chrome. The deploy job
waits for that job, so a red check, a red publish dry-run or a red `verify` blocks the publish.

## How a build works

1. **`deno check`** over `build.ts`, `serve.ts`, `verify.ts`, `src/prerender.tsx` and `src/+main.tsx`.
   Those sources reach the whole catalogue, so the page cannot ship a graph that does not compile:
   a demo whose component changed its props, a card that no longer type-checks, a prop record that
   went red when a variant was added. Whether every component _has_ a card is a different question,
   answered by `ui-guide/coverage.ts` at `deno task test`, which CI runs before this build.
2. **Tailwind** compiles `styles.css` with its own `compile()` API, over every class name its Rust
   scanner finds in the sources the stylesheet's `@source` rules name (every package the catalogue
   draws components from — `ui/`, `charts/`, `system/`, `crud/` — plus `signals/`, whose styles reach
   the demo page rather than a card, `ui-guide/`,
   `icons/` and this directory; `src/tailwind-sources.test.ts` fails when one is missing).
   `tokens.css` and `preset.css` are inlined, and the candidate list is scanned
   rather than listed, so a class inside a template string is emitted exactly as it would be for an
   app.
3. **`deno bundle --platform browser`** produces the island — one Preact copy, at the version the
   root import map pins. The catalogue demonstrates every component of every package it covers, and
   the charts section renders the d3 islands live, so the bundle carries those packages and d3 with
   them. The build prints the module count and the byte size it produced; read them there rather
   than here.
4. **Prerender**: `renderToString(<App />)` inside Deno, wrapped by `document.tsx`. Before writing
   anything, the build asserts that every name in `catalogueNames` — every card the sections render,
   across all covered packages — has a `demo-<Name>` card in the markup it is about to publish,
   because deep links are the one thing this page adds to the catalogue and a rename in `ui-guide`
   must fail the build rather than ship dead links.

Both assets are content-hashed (`main.2e09c12c.css`), so a redeploy cannot pair a new document with
a cached island.

## Routes: hash routing, not paths

The catalogue is multipage, and every page is a **hash route**:

```
https://spy4x.github.io/preact-components/#/ui                     a package's page
https://spy4x.github.io/preact-components/#/inputs                 a section, on its package's page
https://spy4x.github.io/preact-components/#/inputs/toggle-switch   a demo card, on its package's page
https://spy4x.github.io/preact-components/#toggle-switch           the legacy deep link, still resolved
https://spy4x.github.io/preact-components/#/all                    every page at once
```

The grammar and the shell both live in the library — `@spy4x/preact-ui-guide`, described in
`ui-guide/README.md` — because an app registering the guide inherits the same URLs and the same
navigation. The host page only reads the address: `src/app.tsx`'s `useHash()` reads `location.hash`
on load and on every `hashchange` and passes it to `UIGuide` as `hash`. The guide renders that
route's page, marks a demo's card with `data-deep-link` and scrolls it into view, scrolls a section
route to its section, and keeps the page showing for a hash that names no route, so the browser's own
anchors keep working. The host titles the document from the `onRouteChange` port, and hands the
signals page its two address-bound demos through `pageExtras`.

The served `index.html` is the guide's `all` page — every page at once — because the island reads
the address in an effect: before it has, the guide renders everything, which is also what a reader
without JavaScript gets and what the no-script checks under `checks/` submit forms on.

`styles.css` carries the host's side of the layout: `--ui-guide-top`, the height of the sticky header
the guide's own sticky navigation sits under, and `--sticky-stack`, what an anchored card has to
clear. The card grid, the prose measure and the navigation are the guide's own.

Why hash rather than per-route prerendered files:

- **Pages serves files only.** `/preact-components/inputs` would be a 404 — there is no rewrite rule
  that could point it at `index.html`. One prerendered document per route would work, but it needs a
  build-system change (a document per route plus a link-rewriting pass) to buy nothing a fragment
  does not already give, and it would leave the demo unable to move to a custom domain unchanged.
- **The cost, stated plainly:** uglier URLs, and one fragment namespace shared with the deep links
  that already shipped — which is also why those deep links were kept rather than rewritten.
- `src/deep-link.ts` keeps the card half of the mapping: `demo-<Name>` ids, and the names-explicit
  fragment lookup `#toggle-switch`, `#ToggleSwitch`, `#demo-ToggleSwitch`. Its `demoSlug` delegates
  to the route model's `routeSlug`, so there is one slug rule in the repository, not two.
- `uiGuideRoute.path` (`/ui-guide`) is still intentionally _not_ used: the descriptor is a route an
  app registers in its own router, and this page _is_ the app. The demo's URL is the site root.

Every link in the guide's navigation is such a route.

### The route echo

Under hash routing the one `index.html` **is** every route, so there is no per-route emission to
check. Instead `src/document.tsx` embeds the route table (`routeTable()`, from the route model) as
`<script type="application/json" id="ui-guide-routes">`, and `build.ts` reads it back out of the
rendered document and runs it through `routeTableDrift()`: every entry must resolve back to its own
section or demo, be canonical, appear once, and account for every section and demo in the catalogue.
A link the resolver would not accept fails the build rather than shipping, and it fails _before_
`dist/` is cleared. `src/route-echo.ts` owns the emit/read pair (validated with `arktype`), `verify.ts`
checks the same property on the artefact that is actually served, and `src/route-echo.test.ts`
exercises the reader against a missing echo, a malformed payload and a tampered href.

Nothing reads the echo at runtime: it is about ten kilobytes of JSON in a document that already
ships the whole catalogue prerendered, and is small next to it — the build's own printed byte size
is the number to trust, not one typed here.

## Deploy

`.github/workflows/pages.yml` — a GitHub workflow for two reasons. Pages cannot be deployed by
Woodpecker, and Woodpecker's image (`denoland/deno:2.9.7`) carries no browser, so it cannot run the
browser phase of `verify`. Woodpecker still runs `deno task check` on the same pull-request and
`main` events, and on a `v*` tag it also publishes to JSR (`docs/publishing.md`).

The workflow triggers on pull requests into `main`, on pushes to `main`, and on manual dispatch.

A `verify` job runs on all three: checkout → Deno 2.9.7 → print the browser version →
`deno task check` → `deno task publish:dry` → `deno task --cwd pages build` → `deno task --cwd
pages verify`, with `CHROME_PATH` naming the runner's Google Chrome so the browser reported in the
log is the browser that is driven. That job holds `contents: read` and nothing else.

Only on `main`, never on a pull request, the same job then runs `actions/upload-pages-artifact` over
`pages/dist`, and a separate `deploy` job runs `actions/configure-pages` and `actions/deploy-pages`.
`deploy` `needs` the `verify` job, so a red check, a failed build or a failed `verify` blocks the
publish. `pages: write` and `id-token: write` exist on `deploy` alone, which is also where
`configure-pages` lives — it is the step that needs them, and the build never read its outputs,
because the demo's base path is a constant in `src/site.ts`.

Two concurrency groups, because the two paths want opposite things. Deploys share the group `pages`
with `cancel-in-progress: false`: a half-published artefact is worse than a slightly stale one.
Pull-request runs get `pages-pr-<ref>` with `cancel-in-progress: true`, so a review run is never
queued behind a deploy, and a superseded commit's run is dropped.

Pages is enabled on the repository with **Source: GitHub Actions** (`build_type: workflow`), which is
what the workflow needs; a repository where that setting is still "Deploy from a branch" fails at the
deploy step and needs the owner to switch it once under _Settings → Pages_.

The demo tracks `main` rather than a versioned path (`/v0.1/`). A versioned path would keep pasted
links pointing at a frozen build, but it also needs a release step, a redirect or an index of
versions, and a stale catalogue is a worse advert than a moving one. Deep links stay valid because
they address component names, which are the library's public API.

## Decisions, and what they cost

| Decision                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deno only, no Vite**                   | Vite would need a `package.json`, a `node_modules` tree and a second lockfile in CI, plus hand-written aliases for every `@spy4x/preact-*` member it cannot resolve, to bundle everything the workspace's npm dependencies pull in and compile whatever CSS the classes need — see the build's own module count and byte size, printed each run ("How a build works" above). `deno bundle --platform browser` and Tailwind's `compile()` API do it from the workspace's existing pins, through the import map the packages already use. `template` and another app use Vite because they are apps with `node_modules`; this repo is not. The cost: `deno bundle` prints an experimental warning, and a swap to Vite/rolldown later means replacing one step of `build.ts`. |
| **`@tailwindcss/oxide` as a direct pin** | `build.ts` scans for class names with the same Rust scanner the Tailwind CLI uses. `@tailwindcss/cli` was tried first and cannot run here: it resolves `@import "tailwindcss"` through Node's `node_modules` resolution, which a Deno workspace does not have. The oxide pin must stay at the `tailwindcss` version the root `deno.jsonc` pins — 4.1.12.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **No `@tailwindcss/forms`**              | `theme/README.md` documents it as optional — an app adds the plugin itself if it wants its glyphs — and the guide renders no bare form control: the icon filter is an explicitly-styled `<input>`, and `preset.css` styles the controls the demos do show. Adding it would mean `@plugin`, which needs the `node_modules` tree this build avoids. An app that wants it can still add it — nothing here is part of the library's CSS contract.                                                                                                                                                                                                                                                                                                                              |
| **Theme inlined, not copied**            | The requirement is that the catalogue is styled, not that two raw files sit in `dist/`. `tokens.css` and `preset.css` are imported by `styles.css` and compiled _with_ the utilities the components use, which is the only form a browser can consume — a raw copy of `preset.css` alone would render the class names and none of Tailwind's utilities. `verify.ts` asserts the tokens and preset rules are in the emitted CSS, and the browser check reads computed styles off a real `Button`.                                                                                                                                                                                                                                                                           |
| **Prerender, then hydrate**              | A client-only render would leave a blank page until the bundle ran, and would make the page's content invisible to anything that does not execute JavaScript. Prerender-plus-hydrate costs one `preact-render-to-string` pin, shared through the root import map at the same version every package's test suite already uses, and `verify.ts` asserts the island actually hydrated rather than merely loaded.                                                                                                                                                                                                                                                                                                                                                              |
| **Root `deno.jsonc`: one line**          | `./pages` was added to `"workspace"`. That is the only root change in this PR: it is what lets the demo pin `@tailwindcss/oxide` in `pages/deno.json` instead of polluting the root import map. `preact-render-to-string` is no longer a pin this row can claim credit for keeping out of the root map — it moved there in #219, shared by every package's test suite — so the only demo-only pin left in `pages/deno.json` is the Tailwind scanner.                                                                                                                                                                                                                                                                                                                       |
| **The host page is not a package**       | No `name`, no `exports` in `pages/deno.json`: nothing imports the demo, so nothing should be able to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Verification

`deno task --cwd pages verify` runs both phases against the built artefact and prints its own total
on the last line — so read that rather than a number typed here, which would go stale the next time
a check is added. A run that finished every package block ends `<passed>/<total> checks passed —
all <n> package blocks ran to completion`; a run that lost one leads with `INCOMPLETE` and names the
blocks missing from the totals, because a lost block takes its checks out of the denominator as well
as the numerator; and `--static`, which commits no package blocks at all, instead ends
`— no package blocks were part of this run`. In short:

- **Static**: base-prefixed `href`/`src` that resolve to files that exist; `body.theme-base`; every
  card prerendered with a `demo-<Name>` id, every one of them carrying a `Usage` block and a
  labelled copy control; icon cells in the HTML; tokens and preset rules present in the compiled CSS;
  a bundle of the expected size carrying the host page.
- **Browser** (headless Chromium over the DevTools Protocol, page served at the deployed base):
  hydration, Dropdown open/close, ToggleSwitch, OnOffButtons, the icon filter over 119 glyphs,
  click-to-copy in the gallery, a click on every usage block's copy control putting that block's text
  on the clipboard, typing into a class-chapter `.input` and toggling its `.checkbox`/`.radio`, the
  `.scrollbar` scrolling, a toast pushed from the demo stack, a deep link marking/scrolling/titling,
  the canonical demo route, a section route and an unknown route falling back to the landing page —
  the three of which are the hash-routing grammar, driven in the browser because the resolver's own
  tests cannot prove the island wired it up — the palette toggle, computed styles proving `preset.css` is live (`h-12` input, `radius-primary`
  card, `text-2xl` KPI value, `0.375rem` bar), and zero console errors, page exceptions or failed
  requests.
- **Server and browser text** (`pages/checks/ui-guide.ts`, #303): Preact replaces text that differs
  from the server's while it hydrates and logs nothing, so the console check above cannot see a
  card that prints one thing without JavaScript and another with it. This check fetches the served
  `index.html`, parses it in the page, opens each package page, and compares the text of every card
  (`article[id^="demo-"]`, component and example cards alike) with the served card of the same id.
  Whitespace runs count as one space, and a `<textarea>` counts by its value. Only text is compared,
  not attributes or styles. A card that differs fails the run by id, with a short excerpt of each
  side. Some cards have a part an effect draws only in the browser: the d3 charts' `svg`, the
  Leaflet map's controls, `CrudEditor`'s form-level message above Save. `TEXT_DRAWN_IN_BROWSER`
  names each such part by a selector inside its card, with its reason; that part is left out on
  both sides and the rest of the card is compared like any other. A listed part whose text stops
  differing fails the run too.
- **Keyboard and focus** (the same browser phase, driven with real key events through
  `Input.dispatchKeyEvent` rather than a synthesised `KeyboardEvent`, which the browser treats as
  untrusted and does not act on): Modal's trigger opens a `:modal` dialog and moves focus into it,
  an Escape press closes it, and focus lands back on the same trigger element. Dropdown is a real
  menu with arrow keys and Escape; Toastr announces and pauses; Combobox stays quiet until it is
  used and keeps its highlight on screen; Tooltip dismisses on Escape and survives a pointer;
  Calendar is one tab stop with arrows, Home, End and the page keys; ImageLightbox opens with
  Enter and Space; SWUpdater registers and shows its bar; and the filter hook follows the address
  bar. DateRangePicker moves focus into its panel and hands it back to the trigger on every close
  driven from inside it, and leaves focus alone on the two driven from outside; Pagination keeps
  its end controls, and its focus, when you page to either end. Tabs is still to come.

## Not here

`map/` has its own `Map` card now — see `docs/not-building.md`'s "Reopened" note (#143) for the
dependency decision that changed. `theme/` is CSS, so its
classes get cards of their own in the catalogue's
`forms` and `surfaces` sections rather than component cards; `icons/` is the gallery rather than demo
cards; and the sections that were placeholders when this page was first deployed — `charts/`,
`system/`, `crud/` — now have a card per component, with any card still to be written up declared
in `ui-guide/coverage.ts`'s `EXPORTS_WITHOUT_DEMO` with its reason. `signals/` has no section at
all any more: it exports no component, so it is an excluded package with its reason recorded
beside the others, and the one piece of it this page shows — the filter hook — is demonstrated by
the host page rather than by a card.

Adding a card to a `ui-guide` section is still all a new component needs to appear here: the
coverage rule and the stylesheet's `@source` list are the only two things to touch, and both fail
when a package is added without them.
