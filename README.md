# preact-components

Reusable Preact + Tailwind components, design tokens, icons and signals helpers for Deno apps.

Extracted from real products so the same button, table, chart and CRUD scaffold is written once.

Demo: https://spy4x.github.io/preact-components

## Status

Pre-1.0, not yet published to JSR. `deno task publish:dry` runs `deno publish --dry-run` for
every package that ships; it currently fails on `ui/` and `crud/`, the two rows the publishability
sweep in #223 has not finished. "Published" will mean each package below resolves as
`jsr:@preact-components/<name>` and installs with `deno add`. Until then there is nothing on JSR
for `deno add` to find.

## Install

Once published, each package below installs on its own:

```bash
deno add jsr:@preact-components/cn        # class-name join + Tailwind conflict resolution
deno add jsr:@preact-components/icons     # merged icon set
deno add jsr:@preact-components/signals   # buildModelStore, useUrlFilters, table-state, theme, toast
deno add jsr:@preact-components/theme     # design tokens + Tailwind preset
deno add jsr:@preact-components/charts    # server-rendered SVG kit + d3 wrappers
deno add jsr:@preact-components/system    # Calendar, ImageLightbox, SEOHead, SWUpdater
deno add jsr:@preact-components/ui        # Badge, Button, Table, Dropdown, Combobox, Modal, Tooltip, Toastr — and the rest
deno add jsr:@preact-components/crud      # CrudList, CrudEditor, AssociationEditor
deno add jsr:@preact-components/ui-guide  # the live component catalogue, as a component your app renders
```

Reading each package's own `deno.json`: `system` and `ui` both import `cn` and `icons`; `ui` also
imports `signals` (its toast port); `crud` imports `ui`, `cn`, `icons` and `signals`; `ui-guide`
imports all of those plus `charts`. `cn`, `icons`, `signals`, `theme` and `charts` import no
sibling package. JSR resolves a package's own dependencies the way npm does, so installing `ui`
also resolves `cn` and `icons` — neither needs adding by hand.

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
