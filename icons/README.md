# `@spy4x/preact-icons`

Merged icon set. 120 glyphs, one named export per glyph, no runtime dependencies beyond Preact.

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
- `shrink-0` is always applied, on top of a per-icon default size — `size-5` (81 glyphs) unless
  the glyph already shipped elsewhere as `size-6` (38 glyphs). One glyph, `IconUpwork`, defaults to
  `h-5 w-auto` instead, kept from when it was a wide wordmark. Every glyph is square now — 119
  draw on a 24-unit `viewBox`, `IconLockClosedFilled` on Heroicons v1 solid's 20-unit one — so
  `IconUpwork` renders 20 × 20 at its default.
- Passing `class` replaces the default size rather than adding to it, because the default sits on
  the right of the `||` in `shrink-0 ${props.class || "<default size>"}`.
  `IconLoading` and `IconSpinner` additionally hard-code `animate-spin`.
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

## Style families

Every glyph is a published pack's own drawing, copied exactly (see "Provenance" below), but the
packs draw differently and the families are **not** visually interchangeable. Pick one family per
surface; mixing them is visible at small sizes.

| Family                         | Count | Notes                                                                                                                                                          |
| ------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heroicons (v1 or v2)           | 72    | v1 outlines are `stroke-2`, v2 outlines `stroke-1.5` (6 are rendered at `stroke-2`); pack and version are on each glyph's own JSDoc line                       |
| Feather and/or Lucide outlines | 24    | round caps and joins; 15 are rendered at `stroke-2`, 8 at `stroke 1.75` and 1 at `stroke 2.5`; which pack is on each glyph's own JSDoc line                    |
| Brand marks (trademarked)      | 6     | GitHub, Telegram, Upwork, Twitter (drawn as X's current mark) and YouTube are filled marks from Simple Icons; LinkedIn is Feather's outline — see "Provenance" |
| Ported                         | 18    | glyphs from the ported set, bucketed here by source; all 18 are pack drawings too — see the split below                                                        |

The table is a partition of all 120 glyphs: every row above is disjoint from every other, the
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

One known wart, kept rather than redrawn: `IconLoading` (Lucide's eight-spoke `loader`) and
`IconSpinner` (Lucide's `loader-circle` arc) are both spinners. They are different drawings, so both
survived the body dedupe.

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

Of the 120 glyphs, **all 120 match a pack's glyph exactly**: Heroicons v1 (`heroicons@1.0.6`),
Heroicons v2 (`heroicons@2.2.0`), Feather (`feather-icons@4.29.2`), Lucide (`lucide-static@1.47.0`)
or Simple Icons (`simple-icons@16.33.0`). Each glyph's JSDoc line names its pack, and for the 32
replaced in #233 also the upstream file name and version.
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) carries the licence text for all five packs.

One glyph was added after the merge, straight from a pack rather than from a source app:
`IconViewColumns` is Heroicons v2's `view-columns` (24, outline), for a board view toggle
([issue #381](https://github.com/spy4x/preact-components/issues/381)).

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
| `IconLoading`      | none   | Lucide `loader`                                  |
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

Sources (read-only snapshots at merge time):

| Source                     | Exports | Kept |
| -------------------------- | ------- | ---- |
| `spy4x/template`           | 51      | 49   |
| a source application       | 46      | 0    |
| a source application       | 36      | 27   |
| a source application       | 52      | 20   |
| a source application       | 14      | 5    |
| the ported set (see below) | 52      | 18   |

`spy4x/template` and `spy4x/ts-libs` are the library's own public repositories and are named here;
the other four rows are earlier, private applications this set was extracted from, kept unnamed —
see the repository's public-repository rule in `AGENTS.md`. The last row, the ported set, is called
out separately below because it carries its own audit tooling (`check-readme.ts`) that compares its
18 glyphs' geometry against the source byte for byte.

The ported set was missed by the #2 brief and merged separately in
[issue #15](https://github.com/spy4x/preact-components/issues/15). Every one of its 52 files lands on
exactly one side of the ledger below and the two tables carry them all: a file either becomes an
export, folds onto an export that already exists, or is excluded by rule 4.

The barrel is the ported set's own `index.ts`. It re-exports **49** of the 52 files; `facebook.svelte`,
`paper.svelte` and `plus copy.svelte` are the three absent from it. `dot.svelte` _is_ exported, even
though it carries no SVG — it is a styled `<span>`, so there is no geometry to port. `upload.svelte`
is exported too; its name was dropped here for a concept collision, not because the file was unused.

Source file → export name, in the order the exports appear in `+index.tsx`:

| Export                  | Ported source file  | Naming                                                   |
| ----------------------- | ------------------- | -------------------------------------------------------- |
| `IconArrowsPointingOut` | `fullscreen-expand` | renamed onto the Heroicons name for the drawing          |
| `IconCloudArrowUp`      | `cloudUpload`       | renamed onto the Heroicons name, noun order flipped      |
| `IconDocumentDuplicate` | `paper`             | renamed onto Heroicons v1's name for the drawing         |
| `IconDocumentText`      | `doc`               | renamed onto Heroicons v1's name for the drawing         |
| `IconDownload`          | `download`          | as named                                                 |
| `IconExternalLink`      | `externalLink`      | as named                                                 |
| `IconFilm`              | `film`              | as named                                                 |
| `IconLockClosed`        | `lock`              | `Closed` added so it pairs with `IconLockOpen`           |
| `IconLockClosedFilled`  | `lockFilled`        | same pair, solid variant                                 |
| `IconLockOpen`          | `unlock`            | renamed so it pairs with `IconLockClosed`                |
| `IconMicrophone`        | `microphone`        | as named                                                 |
| `IconPlayCircle`        | `play`              | renamed onto the Heroicons name for the drawing          |
| `IconPlaySolid`         | `play-filled`       | renamed onto the Heroicons v2 name for the solid variant |
| `IconRefresh`           | `refresh`           | as named                                                 |
| `IconSmile`             | `smile`             | as named                                                 |
| `IconStopCircle`        | `stop`              | renamed onto the Heroicons name for the drawing          |
| `IconSuccess`           | `success`           | as named — also absorbs `checkCircle.svelte`, see below  |
| `IconVideoCamera`       | `record`            | renamed onto Heroicons v1's name for the drawing         |

A source file whose own noun already reads as a name (`download`, `film`, `refresh`, `smile`) keeps
it; the rest are renamed onto this repo's `Icon<PascalCase>` convention, most of them onto the
Heroicons name the drawing already carries. `checkCircle.svelte` shares the `IconSuccess` row
because its `d` is byte-identical to `success.svelte`'s — the two source files differ only in their
`class` attribute, so they are one drawing.

`dash`, `forward` and `next` were not ported: each has its own drawing but no concept of its own
(`dash` is a thin minus, `forward` a chevron-in-circle, `next` an arrow-right), so they are folds,
not new names.

Rules, in order:

1. **Dedupe by SVG body, not by name.** Identical geometry collapses to one export. This removed
   one source application entirely (a fork of `template`, 45 byte-identical bodies), `template`'s
   internal `IconLightBulb`/`IconBulb` and `IconExclamationTriangle`/`IconAlertTriangle` pairs, and
   that same source application's `IconMagnifyingGlass` (byte-identical to `IconSearch`, so it was
   renamed, not aliased).
2. **One canonical name per concept.** Names are `Icon<PascalCase>`; a rename table folds each
   source's wording onto the incumbent `template` name — `Person`→`User`, `Pen`/`Edit`→
   `PencilSquare`, `Close`→`XMark`, `Menu`→`Bars3`, `Info`/`InfoCircle`→`InformationCircle`,
   `Alert`→`AlertTriangle`, `Cog`→`Cog6Tooth`, `Trash`→`TrashBin`, `Lightbulb`→`LightBulb`,
   `Copy`→`ClipboardCopy`, `Shield`→`ShieldCheck`, `Trending`→`TrendingUp`, `Filter`→`Funnel`,
   `Message`→`ChatBubble`, `Bullseye`→`Target`, `Lightning`→`Zap`. Where no `template` glyph
   exists, the clearest name won. Same-name-different-body conflicts resolve by source precedence,
   `template` first and the ported set last, with the other four source applications ranked in
   between by how much of their icon set survived the merge (see the Sources table above).
3. **Props normalised** to `{ class?: string }` everywhere (`aria-label` and `title` were added
   later, see "Contract"). `width`/`height`, `role`, `aria-hidden` and per-source `className`
   props were dropped; one source application's
   `strokeWidth` prop and another's `filled` prop were resolved to their declared defaults; the
   ported set's `$$props.size` interpolation became the same `shrink-0 ${props.class || "…"}` idiom
   as every other glyph, and `IconPlaySolid`'s hard-coded `red` became `currentColor`.
4. **Excluded** — every deliberate omission, so a missing glyph is a decision rather than a gap:

   | Excluded                                                                                                                                                                                                                                                                                                              | Source               | Why                                                                               |
   | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
   | `LogoMark`                                                                                                                                                                                                                                                                                                            | a source application | that app's own wordmark                                                           |
   | `UpworkBadgeIcon`                                                                                                                                                                                                                                                                                                     | a source application | fixed brand colours, cannot inherit `currentColor`; `IconUpwork` covers the brand |
   | Feather `GitHubIcon`                                                                                                                                                                                                                                                                                                  | a source application | name collision with `IconGitHub`, which won on source precedence                  |
   | `EmailIcon`                                                                                                                                                                                                                                                                                                           | a source application | folded to `IconAtSign` — one name per concept, and it is the same drawing         |
   | `facebook`, `google`, `instagram`                                                                                                                                                                                                                                                                                     | `ported`             | trademark-constrained brand marks, see below                                      |
   | `dot`                                                                                                                                                                                                                                                                                                                 | `ported`             | no `<svg>` at all — a styled `<span>`, so there is no geometry to port            |
   | `check`, `checkCircle`, `chevron`, `circleCross`, `cross`, `dots-horizontal`, `email`, `error`, `info`, `next`, `out`, `pencil`, `pencil-alt`, `plus`, `plus copy`, `share`, `star`, `user`, `warning`, `back`, `burger`, `dash`, `down`, `flashLight`, `forward`, `trash`, `up`, `upload`, `arrowLeft`, `arrowRight` | `ported`             | the concept already has an export — target per fold is listed below               |

   Folds applied for the ported set's files, source first. "Body-identical" is used only where the
   geometry compares equal to the incumbent's once attribute order and the `class` attribute are
   ignored — the same check `+index.test.ts` runs. A file whose drawing differs from the incumbent's
   but whose concept the incumbent already owns is a concept fold.

   | Ported file       | Folds onto              | Kind           |
   | ----------------- | ----------------------- | -------------- |
   | `arrowLeft`       | `IconArrowLeft`         | body-identical |
   | `arrowRight`      | `IconArrowRight`        | body-identical |
   | `back`            | `IconArrowLeft`         | body-identical |
   | `burger`          | `IconBars3`             | concept        |
   | `check`           | `IconCheck`             | concept        |
   | `checkCircle`     | `IconSuccess`           | body-identical |
   | `chevron`         | `IconChevronDown`       | concept        |
   | `circleCross`     | `IconXMark`             | concept        |
   | `cross`           | `IconXMark`             | concept        |
   | `dash`            | `IconMinus`             | concept        |
   | `dots-horizontal` | `IconEllipsisVertical`  | concept        |
   | `down`            | `IconArrowDown`         | body-identical |
   | `email`           | `IconAtSign`            | concept        |
   | `error`           | `IconXMark`             | concept        |
   | `flashLight`      | `IconZap`               | concept        |
   | `forward`         | `IconPlayCircle`        | concept        |
   | `info`            | `IconInformationCircle` | concept        |
   | `next`            | `IconArrowRight`        | concept        |
   | `out`             | `IconExternal`          | concept        |
   | `pencil`          | `IconPencilSquare`      | concept        |
   | `pencil-alt`      | `IconPencilSquare`      | concept        |
   | `plus`            | `IconPlus`              | concept        |
   | `plus copy`       | `IconPlus`              | concept        |
   | `share`           | `IconShare`             | concept        |
   | `star`            | `IconStar`              | concept        |
   | `trash`           | `IconTrashBin`          | body-identical |
   | `up`              | `IconArrowUp`           | body-identical |
   | `user`            | `IconUser`              | concept        |
   | `warning`         | `IconAlertTriangle`     | concept        |

   The `Kind` column is the only reason a file is called body-identical: the geometry compares equal
   to the incumbent's once attribute order and `class` are ignored, which is what `+index.test.ts`
   checks. Everything else is a concept fold — the drawing differs, the concept does not.

   Several targets take more than one file: `arrowLeft` and `back` both fold onto `IconArrowLeft`,
   `plus` and `plus copy` both onto `IconPlus`. `checkCircle.svelte` folds onto the same
   `IconSuccess` that the port table credits to `success.svelte`: the two source files differ only
   in their `class` attribute (`h-5 w-5` vs `inline-block h-6 w-6`), so they are one drawing.

   **The lock pair is not a fold.** `lock.svelte` and `lockFilled.svelte` look like the same concept
   twice, and `unlock.svelte` looks like a third: they are three distinct exports, `IconLockClosed`,
   `IconLockClosedFilled` and `IconLockOpen`. The set has no `IconLock` today, so all three names
   were free, and the solid variant has its own `viewBox` (`0 0 20 20`) rather than being a weight
   of the outline one.

   **Two v1 names that already exist here.** `download.svelte` is Heroicons v1's
   `arrow-down-tray` and `paper.svelte` is v1's `document-duplicate`; both concepts are already
   shipped under `IconArrowDownTray` and `IconDocument` from the v2 family. They are kept as
   `IconDownload` and `IconDocumentDuplicate` — the incumbent names are unchanged, and the two new
   exports are the v1 drawings, which is the same pattern as `IconArrowDownTray` sitting next to
   `IconArrowDown`. Neither is a fold, because a fold would have to change a published body.

   **Brand marks.** `facebook`, `google` and `instagram` are deliberately absent. They are
   third-party trademarked logos, and this package is MIT-licensed and redistributed to any app
   that consumes it, so shipping them would put a trademark obligation on every consumer without
   them asking for it. Substituting a brand mark is the consumer's call. The brand marks already
   shipped from earlier source applications were later replaced with Simple Icons' and Feather's
   own drawings in [issue #233](https://github.com/spy4x/preact-components/issues/233) — see
   "Provenance" → "Brand marks"; this merge adds none.

   **Near-misses kept as one export.** `cross.svelte`'s geometry is the same X as `IconXMark`'s,
   only at `stroke-2` rather than the v2 incumbent's `stroke-1.5`, and both default to `size-6`, so
   there is nothing extra to ship.

No codegen: the merged file is ordinary source now. Regenerating it is not part of the build.

## Tests

`+index.test.ts` calls each export directly and inspects the returned vnode — no DOM, no renderer,
no extra dependency. It asserts that every export renders, that no two exports ship the same
glyph, that the export count matches the total documented above, that a `class` prop replaces the
default size rather than adding to it, that the animated icons stay animated, and that every icon
is hidden from screen readers without a name and a labelled image with `aria-label` or `title`.

The export-count assertion is a hard literal a human bumps on purpose, never
`Object.keys(icons).length` — a count derived from the module would shrink with the thing it
polices. The duplicate-glyph assertion groups exports by glyph key so a failure names the colliding
exports instead of only reporting a count:

```
AssertionError: duplicate glyph bodies: [["IconArrowPath","IconRefresh"]]
```

`check-readme.test.ts` guards the numbers on this page. The merge ledger kept drifting because its
counts were computed from this file — the file being described. `check-readme.ts` therefore takes
every expected value from outside: a pinned literal of the ported set's 52 filenames, its own
`index.ts` for barrel membership and for the path data each port must carry byte for byte, and
`+index.tsx` for
everything this package ships. It checks that each file in that inventory lands on exactly one side
of the ledger, that the port and fold tables agree with the module, and that the counts on this page
match — naming the file or the count in every failure:

```
FAIL download: IconDownload's path data matches neither source
FAIL README.md contract prose: claims 79 size-5 + 38 size-6, module has 80 + 38
FAIL checkCircle: README.md lists checkCircle as fold, but it is not in the recorded inventory
```

The barrel and geometry comparisons need the ported set's own icon folder, from a private
checkout that CI does not have. Pass its path to run them; without it they report as `-- not run`
rather than failing, which is what `deno task test` sees. The pinned inventory carries the ledger
checks everywhere.

```bash
deno task test
deno run --allow-read icons/check-readme.ts                      # the full report
deno run --allow-read icons/check-readme.ts /path/to/icons/      # with the source comparisons
```
