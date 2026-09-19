# Deliberately not built

Components that were evaluated for this library and are **not** being built. Recorded so the decision
is not re-litigated each time somebody notices the gap, and so a future need has a starting point
rather than a blank page.

The governing policy is [issue #34](https://github.com/spy4x/preact-components/issues/34): no
third-party component library. Every component here is ours. That policy is what decides most of the
entries below — not effort, and not taste.

## The list

| Component        | Why not now                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Carousel`       | `roley` has shadcn/embla-based carousels. No Deno-app evidence of need. Embla-style physics is a large hand-written surface — a poor fit for the no-dependency policy.                                |
| `Accordion`      | `roley` has shadcn's (Radix-based). No consumer in `gb`, `financy` or `template`. Fold into `Dropdown` or `Tabs` if it ever appears.                                                                  |
| `Drawer`/`Sheet` | `roley` has shadcn's (Vaul-based). Mobile nav in `gb` and `financy` uses plain off-canvas CSS, which is adequate. Build only if a product needs gesture dismissal.                                    |
| `RichTextEditor` | `evisa` wraps CodeMirror 6. Heavy, niche, and CodeMirror is a large third-party surface — a poor fit while the no-dependency policy holds.                                                            |
| `Map`            | Skipped during extraction: the source loads Leaflet from a CDN `<script>` and depends on Fresh's `IS_BROWSER`. Would need a rewrite against a bundled Leaflet, which is itself a dependency decision. |
| `TreeView`       | No evidence of need anywhere in `~/sync/code`.                                                                                                                                                        |

## Reopen criteria

Both, not either:

1. A real product requirement in `financy`, `template` or a new app — not a resemblance to a component
   another library ships.
2. An explicit decision on whether the dependency the component needs is acceptable under #34.

Until both hold, the answer is no.

## Sources of design intent

`roley` and `evisa` appear above because they are where the need was first noticed. They are **design
intent sources only, never code sources**: both use shadcn, Radix and bits-ui, which #34 excludes.
Port the markup and the behaviour; never the dependency.
