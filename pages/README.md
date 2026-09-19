# `pages/` — the public demo deployment

The live catalogue on GitHub Pages: **<https://spy4x.github.io/preact-components/>**

Anyone can open that URL and touch every component — no clone, no build, no local setup. It is the
"try before you adopt" surface for the library, and the fastest way to show a component to someone in
a chat or an issue thread.

This directory is **demo infrastructure, not library code**. Nothing in it is published, nothing in it
is imported by a package, and it adds no dependency to the root `deno.jsonc` import map: it is a
workspace member only so it can import its sibling packages the way an app does.

## What runs at that URL

| Piece             | Where it comes from                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The catalogue     | `UIGuide` from `@preact-components/ui-guide`, unmodified — instructions, every section of the catalogue, the icon gallery |
| The host page     | `src/app.tsx` — header, a component index with deep links, the colour-scheme switch, the footer                           |
| The styles        | `theme/tokens.css` + `theme/preset.css`, compiled by Tailwind into one stylesheet                                         |
| The interactivity | `src/+main.tsx`, one Preact island that hydrates the prerendered markup                                                   |

Static files only. `index.html` ships the whole catalogue prerendered, so it reads with JavaScript
off; the island is what makes the dropdowns open, the switches toggle, the icon filter filter, the
usage blocks copy, the toasts fire and the deep links scroll.

## Files

| File                      | Contents                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `build.ts`                | Type-checks, compiles the stylesheet, bundles the island, prerenders, writes `dist/` |
| `styles.css`              | The app-order stylesheet an app writes, plus the `@source` rules the scanner reads   |
| `verify.ts`               | Asserts the artefact's shape, then drives the built page in headless Chromium        |
| `serve.ts`                | Static server that mounts `dist/` at the deployed base (`deno task preview`)         |
| `src/app.tsx`             | The host page — the app shell this library deliberately does not ship                |
| `src/+main.tsx`           | The island: `hydrate(<App />, #root)`                                                |
| `src/prerender.tsx`       | The server half: `renderToString(<App />)`, same component                           |
| `src/document.ts`         | The HTML document template, including the pre-paint colour-scheme script             |
| `src/deep-link.ts`        | Fragment ⇄ component mapping (`#toggle-switch` ⇄ `ToggleSwitch`)                     |
| `src/tailwind-sources.ts` | Rewrites the `@source` entries Tailwind hands back into what its scanner resolves    |
| `src/site.ts`             | Base path, origin, title, description, favicon                                       |
| `dist/`                   | The artefact. Gitignored, and excluded from the repo's fmt/lint/type-check walk      |

## Commands

```bash
deno task --cwd pages build      # → pages/dist: index.html, assets/main.<hash>.{js,css}
deno task --cwd pages verify     # static checks, then the browser checks
deno task --cwd pages preview    # serve the built directory at /preact-components/
```

`verify` needs a Chromium binary (it looks for `chromium-browser`, `chromium`, `google-chrome`,
`google-chrome-stable`, `chrome`, or `$CHROME_PATH`). Without one it runs the static phase only and
says so; `deno task --cwd pages verify --static` skips the browser on purpose.

## How a build works

1. **`deno check`** over `build.ts`, `serve.ts`, `verify.ts`, `src/prerender.tsx` and `src/+main.tsx`.
   The catalogue's drift guard _is_ a type error, one report per covered package — a component
   exported with no demo and no pending entry, a demo for a component that no longer exists, a
   rename that only reached one side — so the Pages build inherits it instead of shipping a page the
   guide would have refused to compile.
2. **Tailwind** compiles `styles.css` with its own `compile()` API, over every class name its Rust
   scanner finds in the sources the stylesheet's `@source` rules name (every package the catalogue
   draws components from — `ui/`, `charts/`, `system/`, `crud/`, `signals/` — plus `ui-guide/`,
   `icons/` and this directory; `src/tailwind-sources.test.ts` fails when one is missing). `tokens.css` and `preset.css` are inlined, and the candidate list is scanned
   rather than listed, so a class inside a template string is emitted exactly as it would be for an
   app.
3. **`deno bundle --platform browser`** produces the island — one Preact copy, at the version the
   root import map pins. The registry reads each covered package's barrel at runtime to derive its
   component names, so a bundled package's whole graph is retained: 774 modules and 431 kB minified
   against 39 and 136 kB while `ui/` was the only source, most of the difference being d3 behind the
   charts barrel. Splitting the runtime name lists from the component imports is the follow-up.
4. **Prerender**: `renderToString(<App />)` inside Deno, wrapped by `document.ts`. Before writing
   anything, the build asserts that every name in `catalogueNames` — every card the sections render,
   across all covered packages — has a `demo-<Name>` card in the markup it is about to publish,
   because deep links are the one thing this page adds to the catalogue and a rename in `ui-guide`
   must fail the build rather than ship dead links.

Both assets are content-hashed (`main.2e09c12c.css`), so a redeploy cannot pair a new document with
a cached island.

## Deep links

A fragment, not a path:

```
https://spy4x.github.io/preact-components/#toggle-switch
```

- **Pages serves files only.** `/preact-components/toggle-switch` would be a 404 — there is no rewrite
  rule that could point it at `index.html`. A fragment needs no server behaviour at all, and it
  survives a move to a custom domain.
- The catalogue already renders `id="demo-<Name>"` per component. `deep-link.ts` maps between that id
  and a kebab-case slug, and accepts `#toggle-switch`, `#ToggleSwitch` and `#demo-ToggleSwitch`
  alike. `src/deep-link.test.ts` pins the mapping down.
- On load and on every `hashchange` the host page marks the card with `data-deep-link` (outlined by
  `styles.css`), scrolls it into view and rewrites `document.title`.
- `uiGuideRoute.path` (`/ui-guide`) is intentionally _not_ used: the descriptor is a route an app
  registers in its own router, and this page _is_ the app. The demo's URL is the site root.

Every chip in the component index is such a link, and the `copy` button beside it puts that
component's JSX on the clipboard — the same snippets the catalogue shows under "Usage".

## Deploy

`.github/workflows/pages.yml` — the one place a GitHub workflow is the right tool, because Pages
cannot be deployed by Woodpecker. The repository's normal CI stays in `.woodpecker.yml`.

On every push to `main` (and on manual dispatch): checkout → Deno 2.9.7 → `deno task --cwd pages
build` → `actions/upload-pages-artifact` (`pages/dist`) → `actions/deploy-pages`. Only the default
`GITHUB_TOKEN` is used, with `contents: read`, `pages: write`, `id-token: write`.

Pages is enabled on the repository with **Source: GitHub Actions** (`build_type: workflow`), which is
what the workflow needs; a repository where that setting is still "Deploy from a branch" fails at the
deploy step and needs the owner to switch it once under _Settings → Pages_.

The demo tracks `main` rather than a versioned path (`/v0.1/`). A versioned path would keep pasted
links pointing at a frozen build, but it also needs a release step, a redirect or an index of
versions, and a stale catalogue is a worse advert than a moving one. Deep links stay valid because
they address component names, which are the library's public API.

## Decisions, and what they cost

| Decision                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deno only, no Vite**                   | Vite would need a `package.json`, a `node_modules` tree and a second lockfile in CI, plus hand-written aliases for every `@preact-components/*` member it cannot resolve, to bundle 39 modules and 68 kB of CSS. `deno bundle --platform browser` and Tailwind's `compile()` API do it from the workspace's existing pins, through the import map the packages already use. `template` and `gb` use Vite because they are apps with `node_modules`; this repo is not. The cost: `deno bundle` prints an experimental warning, and a swap to Vite/rolldown later means replacing one step of `build.ts`. |
| **`@tailwindcss/oxide` as a direct pin** | `build.ts` scans for class names with the same Rust scanner the Tailwind CLI uses. `@tailwindcss/cli` was tried first and cannot run here: it resolves `@import "tailwindcss"` through Node's `node_modules` resolution, which a Deno workspace does not have. The oxide pin must stay at the `tailwindcss` version the root `deno.jsonc` pins — 4.1.12.                                                                                                                                                                                                                                                |
| **No `@tailwindcss/forms`**              | `theme/README.md` lists it as a peer, and the guide renders no bare form control: the icon filter is an explicitly-styled `<input>`, and `preset.css` styles the controls the demos do show. Adding it would mean `@plugin`, which needs the `node_modules` tree this build avoids. An app that wants it can still add it — nothing here is part of the library's CSS contract.                                                                                                                                                                                                                         |
| **Theme inlined, not copied**            | The requirement is that the catalogue is styled, not that two raw files sit in `dist/`. `tokens.css` and `preset.css` are imported by `styles.css` and compiled _with_ the utilities the components use, which is the only form a browser can consume — a raw copy of `preset.css` alone would render the class names and none of Tailwind's utilities. `verify.ts` asserts the tokens and preset rules are in the emitted CSS, and the browser check reads computed styles off a real `Button`.                                                                                                        |
| **Prerender, then hydrate**              | A client-only render would leave a blank page until the bundle ran, and would make the page's content invisible to anything that does not execute JavaScript. Prerender-plus-hydrate costs one `preact-render-to-string` pin, already used by `ui/` and `ui-guide/` at the same version, and `verify.ts` asserts the island actually hydrated rather than merely loaded.                                                                                                                                                                                                                                |
| **Root `deno.jsonc`: one line**          | `./pages` was added to `"workspace"`. That is the only root change in this PR: it is what lets the demo pin `preact-render-to-string` and `@tailwindcss/oxide` in `pages/deno.json` instead of polluting the root import map, exactly as `ui/` and `ui-guide/` do with their own renderer pins. No demo dependency reaches the library's import map.                                                                                                                                                                                                                                                    |
| **The host page is not a package**       | No `name`, no `exports` in `pages/deno.json`: nothing imports the demo, so nothing should be able to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Verification

`deno task --cwd pages verify` runs both phases against the built artefact; a full run is 41 checks.
See the PR for the transcript. In short:

- **Static**: base-prefixed `href`/`src` that resolve to files that exist; `body.theme-base`; every
  card prerendered with a `demo-<Name>` id, every one of them carrying a `Usage` block and a
  labelled copy control; icon cells in the HTML; tokens and preset rules present in the compiled CSS;
  a bundle of the expected size carrying the host page.
- **Browser** (headless Chromium over the DevTools Protocol, page served at the deployed base):
  hydration, Dropdown open/close, ToggleSwitch, OnOffButtons, the icon filter over 101 glyphs,
  click-to-copy in the gallery, a click on every usage block's copy control putting that block's text
  on the clipboard, typing into a class-chapter `.input` and toggling its `.checkbox`/`.radio`, the
  `.scrollbar` scrolling, a toast pushed from the demo stack, a deep link marking/scrolling/titling,
  the palette toggle, computed styles proving `preset.css` is live (`h-12` input, `radius-primary`
  card, `text-2xl` KPI value, `0.375rem` bar), and zero console errors, page exceptions or failed
  requests.

## Not here

`map/` does not exist yet. `theme/` is CSS, so its classes get cards of their own in the catalogue's
`forms` and `surfaces` sections rather than component cards; `icons/` is the gallery rather than demo
cards; and the four sections that were placeholders when this page was first deployed — `charts/`,
`system/`, `crud/`, `signals/` — now have a card each, with the components still to be written up
declared in `ui-guide/registry.ts`'s `PENDING_DEMOS` and printed on the page.

Adding a section to `ui-guide` is still all a new component needs to appear here: the registry's
guard and the stylesheet's `@source` list are the only two things to touch, and both fail the build
when a package is added without them.
