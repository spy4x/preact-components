# preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.

Extracted from real products so the same button, table, chart and CRUD scaffold is written once.

Demo: https://spy4x.github.io/preact-components

## Status

Pre-1.0, not yet published to JSR. `deno task publish:dry` runs `deno publish --dry-run` for
every package that ships, and it passes for all ten — the publishability sweep in #223 is done.
"Published" will mean each package below resolves as
`jsr:@preact-components/<name>` and installs with `deno add`. Until then there is nothing on JSR
for `deno add` to find.

No published file names a private application (#237). `deno task private-names <names-file>`
re-checks that against every package's dry-run file list; the owner runs it before each publish —
see [`docs/pre-publish-checks.md`](./docs/pre-publish-checks.md).

## Install

Every package is published at the same version every time, so the caret range a package puts on
its siblings (`^0.1.N`) always resolves to the set published with it — see
[`docs/publishing.md`](./docs/publishing.md). Once published, each package below installs on its
own:

```bash
deno add jsr:@preact-components/cn        # class-name join + Tailwind conflict resolution
deno add jsr:@preact-components/icons     # merged icon set
deno add jsr:@preact-components/signals   # stores and state helpers; no components
deno add jsr:@preact-components/theme     # design tokens + Tailwind preset
deno add jsr:@preact-components/charts    # server-rendered SVG charts + d3 islands
deno add jsr:@preact-components/system    # app-level pieces: auth form, calendar, shells, SEO head
deno add jsr:@preact-components/ui        # the component set
deno add jsr:@preact-components/crud      # list and editor scaffold for one collection
deno add jsr:@preact-components/map       # map on Leaflet (resolves leaflet)
deno add jsr:@preact-components/ui-guide  # the live component catalogue, as a component your app renders
```

Which package imports which sibling, read from the sources: `ui` imports `cn`, `icons` and
`signals`; `system` imports `cn`, `icons` and `ui`; `crud` imports `cn`, `icons`, `signals` and
`ui`; `map` imports `cn`; `ui-guide` imports every other package except `theme`, for its catalogue.
`cn`, `icons`, `signals`, `theme` and `charts` import no sibling. JSR resolves a package's own
dependencies, so installing `ui` also resolves `cn`, `icons` and `signals` — none needs adding by
hand. `charts`, `crud`, `signals`, `system` and `ui` also import helpers from `spy4x/ts-libs`
(`@spy4x/platform`, `@spy4x/time`, `@spy4x/validation`), which JSR resolves the same way.

For the compiled Tailwind stylesheet — the tokens and design-system classes every component here
renders against — see [`theme/README.md`](./theme/README.md): JSR cannot export a CSS file
directly, so getting it is a short build-script recipe, not a plain `@import`.

## Usage

```tsx
import { Badge } from "@preact-components/ui/badge"

<Badge text="Active" color="green" />
```

Every component's own README under the directories below lists its full prop surface.

## Accessibility

Roles, labels, keyboard handling and focus are written by hand — this repository uses no
third-party component library — and proven in a real browser for the behaviours `pages/checks/`
covers; a package's own README says which behaviours that is. No screen reader has been run
against this repository (#210): what is demonstrated is markup and the order in which the DOM
changes, not what any assistive technology actually speaks.

## Credits

The design system, the component styling and the original markup in this repository come from
Eirene — https://github.com/Eirene, https://isorokina.com/. This repository turned that work into a
reusable Preact + signals package. See [`CREDITS.md`](./CREDITS.md).

## Scope

| Directory   | Contents                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/`    | design-system CSS + Tailwind preset, also as strings (`TOKENS_CSS`, `PRESET_CSS`)                                                        |
| `icons/`    | merged icon set: one component per glyph, all listed by the guide's icon gallery                                                         |
| `ui/`       | `Badge`, `Button`, `Table`, `DataTable`, `Dropdown`, `Combobox`, `Modal`, `Tooltip`, `Toastr` — and the rest                             |
| `system/`   | `AuthForm`, `Calendar`, `ImageLightbox`, `RailShell`, `SEOHead` + `head` store, `Shell`, `SiteHeader`, `StateInit`, `SWUpdater`          |
| `charts/`   | server-rendered SVG charts (`LineChart`, `Bars`, `DonutChart`, `Kpi`), axis maths (`scales`), d3 islands (`D3LineChart`, `CompareChart`) |
| `cn/`       | `cn()` — class-name join + Tailwind conflict resolution                                                                                  |
| `signals/`  | `buildModelStore`, `useUrlFilters`, `table-state`, `createThemeStore`, `createToastStore`, `patchSignal` — and the rest; no components   |
| `crud/`     | `CrudList`, `CrudEditor`, `AssociationEditor`, `DeletionValidation`, field rows                                                          |
| `map/`      | `Map` on Leaflet — its own package, so only an app that imports it resolves Leaflet                                                      |
| `ui-guide/` | live component catalogue (`UIGuide`) and its route descriptor (`uiGuideRoute`)                                                           |
| `pages/`    | demo app (GitHub Pages site and the browser checks under `pages/checks/`), not published                                                 |

## Rules

- **Preact + Tailwind only.** No React.
- **No third-party component library.** No shadcn, Radix, Headless UI, Material, Chakra, Ark UI or
  React Aria — and no vendored copies of them. Components are implemented here, on our own stack,
  with roles, labels, keyboard handling and focus written by hand. Nothing mechanical enforces this;
  review does, and CI does not check it. Full policy, allowed set and the exact limits of the check:
  [`docs/no-third-party-components.md`](./docs/no-third-party-components.md). What the policy rules
  out and why: [`docs/not-building.md`](./docs/not-building.md).
- **Props and ports, not global stores.** Components take what they need; they do not import an
  app's state singleton.
- **The icon gallery is the self-documenting piece** — a new icon appears in the catalogue with no
  maintenance.
- **MIT.**

## Relationship to other repos

- `spy4x/ts-libs` — framework-agnostic TypeScript, published on JSR as `@spy4x/*`. No workspace
  coupling: packages import `@spy4x/platform`, `@spy4x/time` and `@spy4x/validation` from JSR at
  one exact version, pinned in the root `deno.jsonc`.
- `spy4x/template` — the SaaS app template, imports both.

## Naming policy

Three repos, not a monorepo. Third-party dependencies publish at the exact versions pinned here,
and the lockfile is committed. Sibling packages publish as caret ranges, which is why every package
is released at one version — see [`docs/publishing.md`](./docs/publishing.md).
