# Maintaining

Rules and bookkeeping for people changing this repository, moved out of the
[README](../README.md): release status, how the screenshots are made, what each directory holds,
the rules every package follows, and how this repository relates to the others.

## Status

Pre-1.0. Every package is published on JSR at `0.1.5` as `jsr:@spy4x/preact-<name>`, released
together from a `v*` tag by Woodpecker (#150) — see [`docs/publishing.md`](./publishing.md).

No published file names a private application (#237). `deno task private-names <names-file>`
re-checks that against every package's dry-run file list, before each release tag is pushed — see
[`docs/pre-publish-checks.md`](./pre-publish-checks.md).

## Scope

| Directory   | Contents                                                                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/`    | CSS text (`TOKENS_CSS`, `PRESET_CSS`, opt-in dark `INK_CSS`), every class the components render (`COMPONENT_CLASSES`), the spacing scale (`SPACING_STEPS`, `SPACING_GAPS`, `findOffScaleSpacing`), and Vite plugins (`preactThemeCss`, `requireComponentCss`, `npmSpecifiers`, `NpmVersionMismatchError`) |
| `icons/`    | merged icon set: one component per glyph, all listed by the guide's icon gallery                                                                                                                                                                                                                          |
| `ui/`       | `Stack`, `Cluster`, `Grid`, `Page`, `Section`, `Badge`, `Button`, `Table`, `DataTable`, `Dropdown`, `Combobox`, `Modal`, `Tooltip`, `Toastr` — and the rest                                                                                                                                               |
| `system/`   | `AuthForm`, `Calendar`, `RailShell`, `SEOHead` + `head` store, `Shell`, `SiteHeader`, `StateInit`, `SWUpdater`                                                                                                                                                                                            |
| `charts/`   | server-rendered charts with browser tooltips (`LineChart`, `Bars`, `DonutChart`, `Kpi`), axis maths (`scales`)                                                                                                                                                                                            |
| `cn/`       | `cn()` — class-name join + Tailwind conflict resolution                                                                                                                                                                                                                                                   |
| `signals/`  | `buildModelStore`, `useUrlFilters`, `table-state`, `createThemeStore`, `createToastStore`, `patchSignal` — and the rest; no components                                                                                                                                                                    |
| `crud/`     | `CrudList`, `CrudEditor`, `AssociationEditor`, `DeletionValidation`, field rows                                                                                                                                                                                                                           |
| `map/`      | `Map` on Leaflet — its own package, so only an app that imports it resolves Leaflet                                                                                                                                                                                                                       |
| `ui-guide/` | live component catalogue: an overview and one page per package behind a side navigation (`UIGuide`, `uiGuideRoute`)                                                                                                                                                                                       |
| `pages/`    | demo app (GitHub Pages site and the browser checks under `pages/checks/`), not published                                                                                                                                                                                                                  |

## Rules

- **Preact + Tailwind only.** No React.
- **No third-party component library.** No shadcn, Radix, Headless UI, Material, Chakra, Ark UI or
  React Aria — and no vendored copies of them. Components are implemented here, on our own stack,
  with roles, labels, keyboard handling and focus written by hand. Nothing mechanical enforces this;
  review does, and CI does not check it. Full policy, allowed set and the exact limits of the check:
  [`docs/no-third-party-components.md`](./no-third-party-components.md). What the policy rules
  out and why: [`docs/not-building.md`](./not-building.md).
- **Props and ports, not global stores.** Components take what they need; they do not import an
  app's state singleton.
- **One spacing scale.** Padding, margin and gap use only the steps `0 px 1 2 3 4 6 8 12 16`, no
  component carries an outer margin, and a page is laid out with `Page`, `Section`, `Stack`,
  `Cluster` and `Grid` and their named gaps: [`docs/spacing.md`](./spacing.md).
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
is released at one version — see [`docs/publishing.md`](./publishing.md).

## Screenshots

Taken from a local build of the demo site by `deno task --cwd pages screenshots`, in the headless
Chromium the browser checks use, at 1280×800 and twice the pixel density.

![The UI package's page in the opt-in ink dark palette: the side navigation on the left, an On this page list of the page's sections and components on the right, and in the middle the Badge card, with its one-sentence description, its filled and outlined badges in every colour, and a props table below them.](screenshots/guide-ui-ink.png)

![The Charts package's page in the light palette: the Bars and DonutChart cards side by side, a bar chart of orders by plan and a donut of traffic sources, each with its description above and the Bars card's props table below, and an On this page list of the charts and their helpers on the right.](screenshots/guide-charts-light.png)
