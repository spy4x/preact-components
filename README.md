# preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.

Extracted from real products so the same button, table, chart and CRUD scaffold is written once.

## Scope

```
theme/       design-system CSS + tailwind preset
ui/          Badge, Table, Dropdown, ToggleSwitch, OnOffButtons, PageTitle, Toast, Button,
             DeletionValidation, CopyButton, Export, DateTimeFilter, LoadingScreen, Skeleton
system/      Shell, Nav, Auth, StateInit, SEOHead, Breadcrumb, Menu, SWUpdater
charts/      server-rendered SVG kit (scales) + d3 wrappers
map/         Map, GeoButton (lazy Leaflet)
icons/       merged icon set (+ brand glyphs)
signals/     For/Show/map, buildModelStore, useListState, useUrlFilters, table-state, cn()
crud/        CrudList, CrudEditor, AssociationEditor
ui-guide/    live component catalogue route
```

## Rules

- **Preact + Tailwind only.** No React.
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
