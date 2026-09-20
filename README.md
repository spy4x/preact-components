# preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.

Extracted from real products so the same button, table, chart and CRUD scaffold is written once.

Demo: https://spy4x.github.io/preact-components

## Credits

The design system, the component styling and the original markup in this repository come from
Eirene — https://github.com/Eirene, https://isorokina.com/. This repository turned that work into a
reusable Preact + signals package. See [`CREDITS.md`](./CREDITS.md).

## Scope

```
theme/       design-system CSS + tailwind preset
ui/          Badge, Table, Dropdown, ToggleSwitch, OnOffButtons, PageTitle, Toast, Button,
             DeletionValidation, CopyButton, Export, DateTimeFilter, LoadingScreen, Skeleton
system/      Shell, Nav, Auth, StateInit, SEOHead, Breadcrumb, Menu, SWUpdater
charts/      server-rendered SVG kit (scales) + d3 wrappers
icons/       merged icon set (+ brand glyphs)
signals/     For/Show/map, buildModelStore, useListState, useUrlFilters, table-state, cn()
crud/        CrudList, CrudEditor, AssociationEditor
ui-guide/    live component catalogue route
```

## Rules

- **Preact + Tailwind only.** No React.
- **No third-party component library.** No shadcn, Radix, Headless UI, Material or Chakra. Components
  are implemented here, on our own stack, with roles, labels, keyboard handling and focus written by
  hand. See [issue #34](https://github.com/spy4x/preact-components/issues/34) for the full policy and
  [`docs/not-building.md`](./docs/not-building.md) for what that rules out and why.
- **Props and ports, not global stores.** Components take what they need; they do not import an
  app's state singleton.
- **The icon gallery is the self-documenting piece** — a new icon appears in the catalogue with no
  maintenance.
- **MIT.**

## Relationship to other repos

- `spy4x/ts-libs` — framework-agnostic TypeScript. Independent package; no workspace coupling.
- `spy4x/template` — the SaaS app template, imports both.

## Naming policy

Three repos, not a monorepo. Publish pins exactly and commits lockfiles.
