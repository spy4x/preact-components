# `@preact-components/icons`

Merged icon set. 101 glyphs, one named export per glyph, no runtime dependencies beyond Preact.

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
- `shrink-0` is always applied, on top of a per-icon default size — `size-5` (63 glyphs) unless
  the glyph already shipped elsewhere as `size-6` (37 glyphs). `IconUpwork` is the only non-square
  glyph (`viewBox="0 0 102 28"`) and defaults to `h-5 w-auto`.
- Passing `class` replaces the default size rather than adding to it, because the default sits on
  the right of the `||` in `shrink-0 ${props.class || "<default size>"}`.
  `IconLoading` and `IconSpinner` additionally hard-code `animate-spin`.
- Every glyph is decorative — no `role`, no `aria-hidden`, no title. Wrap it in the element that
  carries the accessible name, or pass one through the wrapper.
- The icons are server-renderable: nothing touches `document` or `window`.

## Style families

The set is a merge of five apps and the families are **not** visually interchangeable. Pick one
family per surface; mixing them is visible at small sizes.

| Family                             | Count | Origin                                                                      |
| ---------------------------------- | ----- | --------------------------------------------------------------------------- |
| Heroicons v2 outline, `stroke-1.5` | 34    | `spy4x/template`                                                            |
| Heroicons v1 outline, `stroke-2`   | 36    | `spy4x/template`, plus Feather-weight glyphs from `antonshubin.com`/`mig`   |
| Custom outlines                    | 26    | `offer-lens` (1.75), `mig` (1.8 / 2.5), `antonshubin.com` (1.2), `template` |
| Filled / brand glyphs              | 5     | `antonshubin.com` — GitHub, LinkedIn, Telegram, Upwork, Quote               |

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

**The licence provenance of these glyphs is unverified.** They were copied out of five private and
public apps (`spy4x/template`, `spy4x/gb`, `spy4x/antonshubin.com`, `spy4x/offer-lens`,
`spy4x/mig`) which had themselves copied them from a mix of Heroicons, Feather and hand-drawn
sources. Several families look like Heroicons v1/v2 and Feather — close enough to be confident
about the lineage, nowhere near close enough to be confident about the licence of every individual
path.

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
   (`template` > `gb` > `antonshubin.com` > `mig` > `offer-lens`).
3. **Props normalised** to `{ class?: string }` everywhere. `width`/`height`, `role`,
   `aria-hidden` and per-source `className` props were dropped; `mig`'s `strokeWidth` prop and
   `antonshubin.com`'s `filled` prop were resolved to their declared defaults.
4. **Excluded:** `mig`'s `LogoMark` (that app's own wordmark) and `antonshubin.com`'s
   `UpworkBadgeIcon` (fixed brand colours, cannot inherit `currentColor`, and `IconUpwork` already
   covers the brand).

No codegen: the merged file is ordinary source now. Regenerating it is not part of the build.

## Tests

`+index.test.ts` calls each export directly and inspects the returned vnode — no DOM, no renderer,
no extra dependency. It asserts that every export renders, that no two exports ship the same
glyph, that the export count matches the total documented above, that a `class` prop replaces the
default size rather than adding to it, and that the animated icons stay animated.

```bash
deno task test
```
