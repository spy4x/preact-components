# `@preact-components/icons`

Merged icon set. 119 glyphs, one named export per glyph, no runtime dependencies beyond Preact.

```tsx
import { IconSearch, IconTrashBin } from "@preact-components/icons"

<IconSearch />
<IconTrashBin class="size-4 text-red-500" />
```

## Contract

Every icon is a plain function component with the same prop surface:

```ts
export interface IconProps {
  class?: string
}
```

- The root is always an `<svg xmlns="…" viewBox="…">`; sizing comes from the class, not from
  `width`/`height` attributes.
- Colour comes from `currentColor`, so an icon inherits the text colour of its container.
- `shrink-0` is always applied, on top of a per-icon default size — `size-5` (80 glyphs) unless
  the glyph already shipped elsewhere as `size-6` (38 glyphs). Two glyphs are not square:
  `IconUpwork` (`viewBox="0 0 102 28"`) defaults to `h-5 w-auto`, and `IconExternalLink`
  (`viewBox="0 0 25 24"`) defaults to `size-5` and is stretched by ~4% rather than letterboxed.
- Passing `class` replaces the default size rather than adding to it, because the default sits on
  the right of the `||` in `shrink-0 ${props.class || "<default size>"}`.
  `IconLoading` and `IconSpinner` additionally hard-code `animate-spin`.
- Every glyph is decorative — no `role`, no `aria-hidden`, no title. Wrap it in the element that
  carries the accessible name, or pass one through the wrapper.
- The icons are server-renderable: nothing touches `document` or `window`.

## Style families

The set is a merge of six apps and the families are **not** visually interchangeable. Pick one
family per surface; mixing them is visible at small sizes.

| Family                             | Count | Notes                                                                                                                                                    |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heroicons v2 outline, `stroke-1.5` | 34    | matches Heroicons v2 exactly or nearly (`provenance.ts`, below)                                                                                          |
| Heroicons v1 outline, `stroke-2`   | 23    | matches Heroicons v1 exactly or nearly                                                                                                                   |
| Feather / Lucide outlines          | 18    | matches Feather and/or Lucide exactly or nearly, not Heroicons — several of these were filed as "Heroicons v1" or "Custom" until `provenance.ts` checked |
| Custom outlines, no match found    | 20    | no exact or near match against Heroicons v1/v2, Feather or Lucide; named under "Provenance" below                                                        |
| Brand marks (trademarked)          | 6     | GitHub, LinkedIn, Telegram, Upwork, Twitter, YouTube — see "Provenance"                                                                                  |
| roley                              | 18    | 15 Heroicons v1 outlines plus 3 solid / filled glyphs, one source app regardless of which pack a glyph's shape matches                                   |

The table above buckets `roley`'s 18 by which source app they came from rather than by which pack
their shape matches, so the other rows exclude them and the table stays a clean partition of all 119
glyphs. `provenance.ts` compares every glyph, `roley`'s included, against the four packs regardless
of this bucketing; see "Provenance" below for what it found for these 18 specifically.

The `roley` row is a source, not a single weight: 15 `stroke-2` v1 outlines and 3 filled glyphs
drawn without a stroke (`IconExternalLink`, `IconLockClosedFilled`, `IconPlaySolid`). No `roley`
glyph is `stroke-1.5`.

The v1/v2 split is the one that matters in practice: a `stroke-1.5` glyph next to a `stroke-2`
glyph reads as a mistake. Each icon's JSDoc line names its family, so the family of any glyph is
one grep away:

```bash
grep -B1 'export function IconSearch' +index.tsx
```

Two known warts, kept rather than redrawn:

- `IconGateway` carries `fill="white"` from `template`, so it is the only glyph that does not
  follow the surrounding text colour.
- `IconLoading` (thick two-tone spinner) and `IconSpinner` (`mig`'s thin arc) are both spinners.
  They are different drawings, so both survived the body dedupe.

## Provenance

These glyphs were copied out of six source apps by hand, without keeping track of where each one
had originally come from. Per the repository owner's comment on
[issue #111](https://github.com/spy4x/preact-components/issues/111) (2026-09-23): most came from
Heroicons; a few may have come from an image search, with no known licence.

`provenance.ts` compares every exported glyph's geometry against the published Heroicons v1,
Heroicons v2, Feather and Lucide packs — the ones named above plus the two an earlier shape-based
audit also flagged by eye — normalising path and shape data so formatting differences (spacing,
number precision, attribute order) do not hide a real match. Its own JSDoc explains the
normalisation and its limits in full. Run it yourself:

```bash
deno task --cwd icons provenance
```

Of the 119 glyphs: **79 match a pack's glyph exactly**, **7 match one nearly** (same shape, different
numbers — typically a resize or a hand-adjusted curve), and **33 match none of the four packs**.
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) carries the licence text for every pack an
exact or near match was found in — Heroicons v1, Heroicons v2, Feather and Lucide, all four.

A glyph with no match is not necessarily unlicensed — it may be a pack glyph redrawn enough to miss
a shape comparison, or from a pack this check does not compare against — but nothing here
establishes a licence for it, and it is not covered by the notices file. Four are the trademarked
brand marks (GitHub, LinkedIn, Telegram, Upwork — Twitter and YouTube matched Feather exactly, so
they are covered by the notice even though they are also brand marks); the other 29, by name:

`IconBookmark`, `IconBriefcase`, `IconBuilding`, `IconChatBubble`, `IconChip`, `IconClock`,
`IconDollar`, `IconExternalLink`, `IconFire`, `IconFlag`, `IconFlask`, `IconGateway`, `IconGrid`,
`IconImage`, `IconKey`, `IconLens`, `IconLoading`, `IconMoon`, `IconPackage`, `IconQuote`,
`IconRocket`, `IconSensor`, `IconSparkle`, `IconSun`, `IconThemeAuto`, `IconTrendingDown`,
`IconTrendingUp`, `IconVideo`, `IconWrench`.

Swapping any of these 33 for a licensed replacement, or dropping them, is the repository owner's
call — it changes what a consumer sees — and is tracked in
[issue #233](https://github.com/spy4x/preact-components/issues/233), not done here.
[Issue #10](https://github.com/spy4x/preact-components/issues/10) tracks replacing the whole set
with a single licensed pack; issue #233 is the narrower, immediate version of that, scoped to the
33 glyphs this check could not attribute.

## How this set was merged

Sources (read-only snapshots at merge time):

| Source                  | Exports | Kept |
| ----------------------- | ------- | ---- |
| `spy4x/template`        | 51      | 49   |
| `spy4x/gb`              | 46      | 0    |
| `spy4x/antonshubin.com` | 36      | 27   |
| `spy4x/offer-lens`      | 52      | 20   |
| `spy4x/mig`             | 14      | 5    |
| `spy4x/roley`           | 52      | 18   |

`roley` was missed by the #2 brief and merged separately in
[issue #15](https://github.com/spy4x/preact-components/issues/15). Every one of its 52 files lands on
exactly one side of the ledger below and the two tables carry them all: a file either becomes an
export, folds onto an export that already exists, or is excluded by rule 4.

The barrel is `roley/index.ts`. It re-exports **49** of the 52 files; `facebook.svelte`,
`paper.svelte` and `plus copy.svelte` are the three absent from it. `dot.svelte` _is_ exported, even
though it carries no SVG — it is a styled `<span>`, so there is no geometry to port. `upload.svelte`
is exported too; its name was dropped here for a concept collision, not because the file was unused.

Source file → export name, in the order the exports appear in `+index.tsx`:

| Export                  | `roley` source      | Naming                                                   |
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
   `gb` entirely (a fork of `template`, 45 byte-identical bodies), `template`'s internal
   `IconLightBulb`/`IconBulb` and `IconExclamationTriangle`/`IconAlertTriangle` pairs, and
   `gb`'s `IconMagnifyingGlass` (byte-identical to `IconSearch`, so it was renamed, not aliased).
2. **One canonical name per concept.** Names are `Icon<PascalCase>`; a rename table folds each
   source's wording onto the incumbent `template` name — `Person`→`User`, `Pen`/`Edit`→
   `PencilSquare`, `Close`→`XMark`, `Menu`→`Bars3`, `Info`/`InfoCircle`→`InformationCircle`,
   `Alert`→`AlertTriangle`, `Cog`→`Cog6Tooth`, `Trash`→`TrashBin`, `Lightbulb`→`LightBulb`,
   `Copy`→`ClipboardCopy`, `Shield`→`ShieldCheck`, `Trending`→`TrendingUp`, `Filter`→`Funnel`,
   `Message`→`ChatBubble`, `Bullseye`→`Target`, `Lightning`→`Zap`. Where no `template` glyph
   exists, the clearest name won. Same-name-different-body conflicts resolve by source precedence
   (`template` > `gb` > `antonshubin.com` > `mig` > `offer-lens` > `roley`).
3. **Props normalised** to `{ class?: string }` everywhere. `width`/`height`, `role`,
   `aria-hidden` and per-source `className` props were dropped; `mig`'s `strokeWidth` prop and
   `antonshubin.com`'s `filled` prop were resolved to their declared defaults; `roley`'s
   `$$props.size` interpolation became the same `shrink-0 ${props.class || "…"}` idiom as every
   other glyph, and `IconPlaySolid`'s hard-coded `red` became `currentColor`.
4. **Excluded** — every deliberate omission, so a missing glyph is a decision rather than a gap:

   | Excluded                                                                                                                                                                                                                                                                                                                | Source            | Why                                                                               |
   | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
   | `LogoMark`                                                                                                                                                                                                                                                                                                              | `mig`             | that app's own wordmark                                                           |
   | `UpworkBadgeIcon`                                                                                                                                                                                                                                                                                                       | `antonshubin.com` | fixed brand colours, cannot inherit `currentColor`; `IconUpwork` covers the brand |
   | Feather `GitHubIcon`                                                                                                                                                                                                                                                                                                    | `antonshubin.com` | name collision with `IconGitHub`, which won on source precedence                  |
   | `EmailIcon`                                                                                                                                                                                                                                                                                                             | `antonshubin.com` | folded to `IconAtSign` — one name per concept, and it is the same drawing         |
   | `facebook`, `google`, `instagram`                                                                                                                                                                                                                                                                                       | `roley`           | trademark-constrained brand marks, see below                                      |
   | `dot`                                                                                                                                                                                                                                                                                                                   | `roley`           | no `<svg>` at all — a styled `<span>`, so there is no geometry to port            |
   | `check`, `checkCircle`, `chevron`, `circleCross`, `cross`, `dots-horizontal`, `email`, `error`, `info`, `next`, `out`, `pencil`, `pencil-roley`, `plus`, `plus copy`, `share`, `star`, `user`, `warning`, `back`, `burger`, `dash`, `down`, `flashLight`, `forward`, `trash`, `up`, `upload`, `arrowLeft`, `arrowRight` | `roley`           | the concept already has an export — target per fold is listed below               |

   Folds applied for the `roley` files, source first. "Body-identical" is used only where the
   geometry compares equal to the incumbent's once attribute order and the `class` attribute are
   ignored — the same check `+index.test.ts` runs. A file whose drawing differs from the incumbent's
   but whose concept the incumbent already owns is a concept fold.

   | `roley` file      | Folds onto              | Kind           |
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
   | `pencil-roley`    | `IconPencilSquare`      | concept        |
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
   them asking for it. Substituting a brand mark is the consumer's call. The five brand-adjacent
   glyphs already shipped from `antonshubin.com` (GitHub, LinkedIn, Telegram, Upwork, Quote) are a
   separate, pre-existing question owned by the repo owner and tracked in
   [issue #10](https://github.com/spy4x/preact-components/issues/10); this merge adds none.

   **Near-misses kept as one export.** `cross.svelte`'s geometry is the same X as `IconXMark`'s,
   only at `stroke-2` rather than the v2 incumbent's `stroke-1.5`, and both default to `size-6`, so
   there is nothing extra to ship.

No codegen: the merged file is ordinary source now. Regenerating it is not part of the build.

## Tests

`+index.test.ts` calls each export directly and inspects the returned vnode — no DOM, no renderer,
no extra dependency. It asserts that every export renders, that no two exports ship the same
glyph, that the export count matches the total documented above, that a `class` prop replaces the
default size rather than adding to it, and that the animated icons stay animated.

The export-count assertion is a hard literal a human bumps on purpose, never
`Object.keys(icons).length` — a count derived from the module would shrink with the thing it
polices. The duplicate-glyph assertion groups exports by glyph key so a failure names the colliding
exports instead of only reporting a count:

```
AssertionError: duplicate glyph bodies: [["IconArrowPath","IconRefresh"]]
```

`check-readme.test.ts` guards the numbers on this page. The merge ledger kept drifting because its
counts were computed from this file — the file being described. `check-readme.ts` therefore takes
every expected value from outside: a pinned literal of roley's 52 filenames, roley's own `index.ts`
for barrel membership and for the path data each port must carry byte for byte, and `+index.tsx` for
everything this package ships. It checks that each file in that inventory lands on exactly one side
of the ledger, that the port and fold tables agree with the module, and that the counts on this page
match — naming the file or the count in every failure:

```
FAIL download: IconDownload's path data matches neither source
FAIL README.md contract prose: claims 79 size-5 + 38 size-6, module has 80 + 38
FAIL checkCircle: README.md lists checkCircle as fold, but it is not in the recorded inventory
```

The barrel and geometry comparisons need the read-only `roley` checkout beside this one, which CI
does not have; there they report as `-- not run` rather than failing. The pinned inventory carries
the ledger checks everywhere.

```bash
deno task test
deno run --allow-read icons/check-readme.ts # the full report
```
