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
ui/          Badge, Button, Table, Dropdown, Combobox, Modal, Tooltip, Toastr — and the rest
system/      Calendar, ImageLightbox, SEOHead + head store, SWUpdater
charts/      server-rendered SVG kit (scales) + d3 wrappers
icons/       merged icon set (+ brand glyphs)
cn/          cn() — class-name join + Tailwind conflict resolution
signals/     buildModelStore, useUrlFilters, table-state, theme, toast — and the rest; no components
crud/        CrudList, CrudEditor, AssociationEditor
ui-guide/    live component catalogue route
pages/       demo app (GitHub Pages site and the browser checks under pages/checks/), not published
```

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

- `spy4x/ts-libs` — framework-agnostic TypeScript. Independent package; no workspace coupling.
- `spy4x/template` — the SaaS app template, imports both.

## Naming policy

Three repos, not a monorepo. Publish pins exactly and commits lockfiles.
