# `@spy4x/preact-icons`

Merged icon set. 125 exports: 124 glyphs, one named export each, plus `IconLoading`, an alias of
`IconSpinner`. No runtime dependencies beyond Preact.

```tsx
import { IconSearch, IconTrashBin } from "@spy4x/preact-icons"

<IconSearch />
<IconTrashBin class="size-4 text-red-500" />
```

## Contract

Every icon is a plain function component with the same prop surface:

```ts
export interface IconProps {
  class?: string
  "aria-label"?: string
  title?: string
}
```

- The root is always an `<svg xmlns="…" viewBox="…">`; sizing comes from the class, not from
  `width`/`height` attributes.
- Colour comes from `currentColor`, so an icon inherits the text colour of its container.
- `shrink-0` is always applied, on top of a per-icon default size — `size-5` (83 glyphs) unless
  the glyph already shipped elsewhere as `size-6` (39 glyphs). One glyph, `IconUpwork`, defaults to
  `h-5 w-auto` instead, kept from when it was a wide wordmark. Every glyph is square now — 122
  draw on a 24-unit `viewBox`, `IconLockClosedFilled` on Heroicons v1 solid's 20-unit one — so
  `IconUpwork` renders 20 × 20 at its default.
- Passing `class` replaces the default size rather than adding to it, because the default sits on
  the right of the `||` in `shrink-0 ${props.class || "<default size>"}`.
  `IconLoading` and `IconSpinner` additionally hard-code `animate-spin`, and stand still under
  reduced motion (`motion-reduce:animate-none`).
- `IconStar` alone takes one more prop, `filled`. `<IconStar filled />` paints the same Feather
  drawing solid in the text colour and keeps its stroke, so it covers the outline's footprint
  exactly; without `filled` it is the outline it has always been.

  ```tsx
  <IconStar filled aria-label="Rated" />
  ```
- An icon is decorative by default: its `<svg>` carries `aria-hidden="true"`, so a screen reader
  skips it. Put the accessible name on the element that wraps it, such as the button or link.
- Passing `aria-label` or `title` makes it a labelled image instead: `role="img"`, the label kept,
  no `aria-hidden`. `title` renders as the SVG's first child, `<title>`, which also shows as a
  tooltip on hover.

  ```tsx
  <button type="button" aria-label="Search"><IconSearch /></button>
  <IconSearch aria-label="Search" />
  <IconTrashBin title="Deleted" />
  ```
- The icons are server-renderable: nothing touches `document` or `window`.

## Right to left

The glyphs that point along the reading direction flip left to right when the page, or the nearest
ancestor, is `dir="rtl"`. An app passes nothing: the glyph carries
`[&:dir(rtl)]:[transform:scaleX(-1)]` whatever `class` it gets. `:dir(rtl)` reads the nearest
`dir`, so a glyph inside a `dir="ltr"` block of an Arabic page (a code sample, an English quote)
stays as drawn; Tailwind's `rtl:` variant would flip it.

- **Mirror:** `IconChevronLeft`, `IconChevronRight`, `IconArrowLeft`, `IconArrowRight`,
  `IconArrowUturnLeft`, `IconArrowUturnRight` (undo and redo), `IconLogout`, `IconList`,
  `IconExternal`, `IconExternalLink` and `IconArrowUpRight`.
- **Never mirror:** every other glyph, among them the check, the x-mark, search, the globe, play,
  the up and down arrows, refresh, the clock and the brand marks.

So `IconChevronLeft` means "back" in both directions: on an Arabic page it points right. The flip is
a `transform`, not Tailwind's `-scale-x-100`, so a caller's `scale-*` (a hover grow) keeps it. A
caller's `rotate-*` turns the flipped drawing: a disclosure chevron that turns `rotate-90` when open
needs `[&:dir(rtl)]:-rotate-90` too, or it points up on a right-to-left page.

A new glyph goes in one of the two lists in `+index.test.ts`, or the suite fails.

## Style families

Every glyph is a published pack's own drawing, copied exactly (see "Provenance" below), but the
packs draw differently and the families are **not** visually interchangeable. Pick one family per
surface; mixing them is visible at small sizes.

| Family                         | Count | Notes                                                                                                                                                                        |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heroicons (v1 or v2)           | 74    | v1 outlines are `stroke-2`, v2 outlines `stroke-1.5` (7 are rendered at `stroke-2` and 1, `IconMinus`, at `stroke 1.8`); pack and version are on each glyph's own JSDoc line |
| Feather and/or Lucide outlines | 26    | round caps and joins; 17 are rendered at `stroke-2`, 8 at `stroke 1.75` and 1 at `stroke 2.5`; which pack is on each glyph's own JSDoc line                                  |
| Brand marks (trademarked)      | 6     | GitHub, Telegram, Upwork, Twitter (drawn as X's current mark) and YouTube are filled marks from Simple Icons; LinkedIn is Feather's outline — see "Provenance"               |
| Ported                         | 18    | glyphs from the ported set, bucketed here by source; all 18 are pack drawings too — see the split below                                                                      |

The table is a partition of all 124 glyphs: every row above is disjoint from every other, the
Ported row's 18 included.

The Ported row is a family, not a single weight, and the split below is by rendering: 16 `stroke-2`
v1 outlines, all 16 exact matches to Heroicons v1's own outline pack, and 2 filled glyphs drawn
without a stroke (`IconLockClosedFilled`, `IconPlaySolid`) — exact matches to Heroicons v1 solid and
v2 outline respectively. One of the 16, `IconExternalLink`, matched no pack as ported and was redrawn
as Heroicons v1's `external-link` in
[issue #233](https://github.com/spy4x/preact-components/issues/233). No Ported glyph is
`stroke-1.5`.

Rendered stroke width is what matters visually, and the table above does not show it: a
`stroke-1.5` glyph next to a `stroke-2` glyph reads as a mistake regardless of which pack either one
comes from. Each icon's JSDoc line names both its rendered family and the pack and version it is
drawn from — so the exact family of any one glyph is one grep away:

```bash
grep -B1 'export function IconSearch' +index.tsx
```

There is one spinner, `IconSpinner` (Lucide's `loader-circle` arc). `IconLoading` is the same
component under the name older apps import; it drew Lucide's eight-spoke `loader` until the library
settled on one spinner, which `Button` and `LoadingSpinner` draw too.

## Provenance

These glyphs were copied out of six source apps by hand, without keeping track of where each one
had originally come from. Per the repository owner's comment on
[issue #111](https://github.com/spy4x/preact-components/issues/111) (2026-09-23): most came from
Heroicons; a few may have come from an image search, with no known licence. The owner then decided
(2026-09-30, [issue #233](https://github.com/spy4x/preact-components/issues/233)) that every glyph
must come from a FOSS pack, so every glyph that matched no pack exactly was replaced by a pack's own
drawing, under the same export name and props.

`provenance.ts`, in this package's own source repository, compares every exported glyph's geometry
against the published Heroicons v1, Heroicons v2, Feather, Lucide and Simple Icons packs,
normalising path and shape data so formatting differences (spacing, number precision, attribute
order) do not hide a real match. Its own JSDoc explains the normalisation and its limits in full. It
is a development tool excluded from this published package (see `icons/deno.json` →
`publish.exclude`), so `deno task --cwd icons provenance` only works from a checkout of the source
repository — <https://github.com/spy4x/preact-components> — not from an installed copy of this
package:

```bash
git clone https://github.com/spy4x/preact-components && cd preact-components
deno task --cwd icons provenance
```

Of the 124 glyphs, **all 124 match a pack's glyph exactly**: Heroicons v1 (`heroicons@1.0.6`),
Heroicons v2 (`heroicons@2.2.0`), Feather (`feather-icons@4.29.2`), Lucide (`lucide-static@1.47.0`)
or Simple Icons (`simple-icons@16.33.0`). Each glyph's JSDoc line names its pack, and for the 31
replaced in #233 also the upstream file name and version.
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) carries the licence text for all five packs.

Six glyphs were added after the merge, straight from a pack rather than from a source app:
`IconViewColumns` is Heroicons v2's `view-columns` (24, outline), for a board view toggle
([issue #381](https://github.com/spy4x/preact-components/issues/381)); `IconCopy` is Feather's
`copy` and `IconPen` Feather's `edit-2`, a plain pen
([issue #495](https://github.com/spy4x/preact-components/issues/495)). Both are Feather drawings
so they sit next to `IconStar`, Feather's `star`, at the same `stroke-2` weight. `IconExclamationCircle` is
Heroicons v2's `exclamation-circle` (24, outline), the glyph of `Notice`'s danger tone
([issue #552](https://github.com/spy4x/preact-components/issues/552)), drawn at `stroke-1.5` like
`IconInformationCircle` beside it. `IconSprout` is Lucide's `sprout`, the glyph a brand mark tile
(`BrandMark` in `@spy4x/preact-ui`) can hold (spy4x/template#444). `IconAdjustmentsHorizontal` is
Heroicons v2's `adjustments-horizontal` (24, outline), drawn at `stroke-2`, the mark of an
interactive figure (`Explorable` in `@spy4x/preact-ui`,
[issue #958](https://github.com/spy4x/preact-components/issues/958)).

### Brand marks

Five brand marks are Simple Icons' drawings (CC0): `IconGitHub` (`github`), `IconTelegram`
(`telegram`), `IconUpwork` (`upwork`), `IconTwitter` (`x`, the brand's current mark; Simple Icons
lists Twitter as its alias) and `IconYouTube` (`youtube`). Simple Icons 16.33.0 no longer ships a
LinkedIn mark, so `IconLinkedIn` is Feather's `linkedin` outline (MIT).

CC0 and MIT cover the drawings, not the trademarks. Each mark still belongs to its company, and
using one is subject to that company's brand guidelines — Simple Icons' own disclaimer says the
same. Before #233, `IconUpwork` was Upwork's wordmark on a `102 × 28` `viewBox`. It is now Upwork's
square mark on a 24-unit one. Its `h-5 w-auto` default is unchanged, so at its default size it is
20 px tall as before, but 20 px wide instead of about 73 px.

### Replaced in #233

Every drawing below changed in #233; the export name and props did not. The old drawing either
matched no pack ("none") or matched one only nearly ("near": same shape, different numbers).

| Glyph              | Before | Now                                              |
| ------------------ | ------ | ------------------------------------------------ |
| `IconBookmark`     | none   | Heroicons v1 `bookmark`                          |
| `IconBuilding`     | none   | Heroicons v1 `office-building`                   |
| `IconChatBubble`   | none   | Heroicons v1 `chat-alt`                          |
| `IconChip`         | none   | Heroicons v1 `chip`                              |
| `IconCircleDot`    | near   | Lucide `circle-dot`                              |
| `IconCreditCard`   | near   | Heroicons v1 `credit-card`                       |
| `IconDocument`     | near   | Heroicons v2 `document`                          |
| `IconExternalLink` | none   | Heroicons v1 `external-link`                     |
| `IconFire`         | near   | Heroicons v2 `fire`                              |
| `IconFlag`         | none   | Heroicons v1 `flag`                              |
| `IconFlask`        | none   | Heroicons v1 `beaker`                            |
| `IconGateway`      | none   | Lucide `router`                                  |
| `IconGitHub`       | none   | Simple Icons `github`                            |
| `IconGlobe`        | none   | Heroicons v1 `globe-alt`                         |
| `IconImage`        | none   | Heroicons v1 `photograph`                        |
| `IconLens`         | none   | Heroicons v1 `zoom-in`                           |
| `IconLinkedIn`     | none   | Feather `linkedin`                               |
| `IconMoon`         | near   | Heroicons v2 `moon`                              |
| `IconPackage`      | none   | Heroicons v1 `cube`                              |
| `IconQuote`        | none   | Lucide `quote`                                   |
| `IconRocket`       | none   | Heroicons v2 `rocket-launch`                     |
| `IconSensor`       | none   | Heroicons v1 `status-online`                     |
| `IconSparkle`      | none   | Heroicons v1 `sparkles`                          |
| `IconTarget`       | near   | Lucide `target` (Feather's `target` is the same) |
| `IconTelegram`     | none   | Simple Icons `telegram`                          |
| `IconThemeAuto`    | none   | Lucide `contrast`                                |
| `IconTwitter`      | exact  | Simple Icons `x` (was Feather's `twitter` bird)  |
| `IconUpwork`       | none   | Simple Icons `upwork`                            |
| `IconVideo`        | none   | Heroicons v2 `video-camera`                      |
| `IconWrench`       | none   | Heroicons v2 `wrench`                            |
| `IconYouTube`      | exact  | Simple Icons `youtube` (was Feather's `youtube`) |

[Issue #10](https://github.com/spy4x/preact-components/issues/10) tracked replacing the whole set
with a single licensed pack; #233 settled its licensing question glyph by glyph instead.

## How this set was merged

The set was merged by hand from six source applications' icon modules, and glyphs with the same
drawing or the same concept were folded into one export. The 18 glyphs that came from the last of
them ([issue #15](https://github.com/spy4x/preact-components/issues/15)) are what this page calls
the ported set.

## Tests

`+index.test.ts` calls each export directly and inspects the returned vnode — no DOM, no renderer,
no extra dependency. It asserts that every export renders, that no two exports ship the same
glyph except a listed alias, that the export count matches the total documented above, that a `class` prop replaces the
default size rather than adding to it, that the animated icons stay animated, and that every icon
is hidden from screen readers without a name and a labelled image with `aria-label` or `title`.

The export-count assertion is a hard literal a human bumps on purpose, never
`Object.keys(icons).length` — a count derived from the module would shrink with the thing it
polices. The duplicate-glyph assertion groups exports by glyph key so a failure names the colliding
exports instead of only reporting a count:

```
AssertionError: duplicate glyph bodies: [["IconArrowPath","IconRefresh"]]
```

No test pins a glyph's path data or which default size it has: changing either leaves
`deno task test` green. The drawings are compared with the packs by `provenance.ts`, run by hand
(see "Provenance").

```bash
deno task test
```
