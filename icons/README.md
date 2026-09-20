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

| Family                             | Count | Origin                                                                      |
| ---------------------------------- | ----- | --------------------------------------------------------------------------- |
| Heroicons v2 outline, `stroke-1.5` | 34    | `spy4x/template`                                                            |
| Heroicons v1 outline, `stroke-2`   | 36    | `spy4x/template`, plus Feather-weight glyphs from `antonshubin.com`/`mig`   |
| Custom outlines                    | 26    | `offer-lens` (1.75), `mig` (1.8 / 2.5), `antonshubin.com` (1.2), `template` |
| Filled / brand glyphs              | 5     | `antonshubin.com` — GitHub, LinkedIn, Telegram, Upwork, Quote               |
| roley                              | 18    | `roley` — 15 Heroicons v1 outlines plus 3 solid / filled glyphs             |

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

## Provenance — unverified

**The licence provenance of these glyphs is unverified.** They were copied out of six private and
public apps (`spy4x/template`, `spy4x/gb`, `spy4x/antonshubin.com`, `spy4x/offer-lens`,
`spy4x/mig`, `spy4x/roley`) which had themselves copied them from a mix of Heroicons, Feather and
hand-drawn sources. Several families look like Heroicons v1/v2 and Feather — close enough to be
confident about the lineage, nowhere near close enough to be confident about the licence of every
individual path.

Replacing the set with a properly licensed FOSS pack (Heroicons or Lucide, plus a separate brand
subset) is **deferred** and tracked in
[issue #10](https://github.com/spy4x/preact-components/issues/10). The style-family table above,
the per-icon JSDoc annotations and the brand-glyph list exist so that replacement can be done
family by family instead of glyph by glyph.

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
