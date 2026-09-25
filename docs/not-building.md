# Deliberately not built

Components that were evaluated for this library and are **not** being built. Recorded so the decision
is not re-litigated each time somebody notices the gap, and so a future need has a starting point
rather than a blank page.

The governing policy is [issue #34](https://github.com/spy4x/preact-components/issues/34): no
third-party component library. Every component here is ours. That policy is what decides most of the
entries below — not effort, and not taste.

## The list

| Component        | Why not now                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Carousel`       | A private application has shadcn/embla-based carousels. No Deno-app evidence of need. Embla-style physics is a large hand-written surface — a poor fit for the no-dependency policy.         |
| `Accordion`      | A private application has shadcn's (Radix-based). No consumer in `financy`, `template` or any other Deno app. Fold into `Dropdown` or `Tabs` if it ever appears.                             |
| `Drawer`/`Sheet` | A private application has shadcn's (Vaul-based). Mobile nav in `financy` and another Deno app uses plain off-canvas CSS, which is adequate. Build only if a product needs gesture dismissal. |
| `RichTextEditor` | An earlier application wrapped CodeMirror 6. Heavy, niche, and CodeMirror is a large third-party surface — a poor fit while the no-dependency policy holds.                                  |
| `TreeView`       | No evidence of need in any of the owner's applications.                                                                                                                                      |

## Reopened

`Map` was parked here until both reopen criteria below were met, and both have been:
[issue #143](https://github.com/spy4x/preact-components/issues/143) is the real product requirement,
and the owner's global policy names Leaflet among the "large, well-solved libraries to keep" — the
explicit dependency decision the entry was waiting on. It is now `@preact-components/map`; see
`map/README.md`. `docs/no-third-party-components.md`'s allowed-dependency table records Leaflet's own
entry with the same reasoning.

## Reopen criteria

Both, not either:

1. A real product requirement in `financy`, `template` or a new app — not a resemblance to a component
   another library ships.
2. An explicit decision on whether the dependency the component needs is acceptable under #34.

Until both hold, the answer is no.

## Sources of design intent

The applications above appear only because they are where the need was first noticed. They are
**design intent sources only, never code sources**: they use shadcn, Radix and bits-ui, which #34 excludes.
Port the markup and the behaviour; never the dependency.
