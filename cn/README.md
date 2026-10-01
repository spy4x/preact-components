# `@spy4x/preact-cn`

Two functions: `cn` joins conditional class names and resolves conflicting Tailwind utilities;
`join` joins them and resolves nothing.

```ts
import { cn } from "@spy4x/preact-cn"

cn("p-2", isActive && "bg-blue-500", isDisabled && "opacity-50")
```

Falsy inputs (`false`, `null`, `undefined`) are dropped. The rest is passed through
`tailwind-merge`, so a later utility wins over an earlier one in the same group —
`cn("p-2", "p-4")` is `"p-4"` — instead of both reaching the DOM and leaving the winner to CSS
source order.

## `join`: the same join, without `tailwind-merge`

`tailwind-merge` is about 28 KB minified, and every browser bundle that imports `cn` carries it,
whatever the class strings are. `join` drops falsy inputs and joins the rest with one space, in
order, and merges nothing — `join("p-2", "p-4")` is `"p-2 p-4"` — so a bundle that imports it
alone carries none of that:

```ts
import { join } from "@spy4x/preact-cn/join"

join("rounded-md px-3", isActive && "bg-selected", className)
```

Use `join` where no two inputs can be utilities of one group, and `cn` where a later utility has to
replace an earlier one. `join` is also exported from `@spy4x/preact-cn` itself; the `/join` path
is the one that never reaches `tailwind-merge`, whatever the bundler's tree-shaking does.

`Button`, `buttonClasses`, `ImageGallery` and `Lightbox` in `@spy4x/preact-ui` compose their classes
with `join` (#471), so an island that renders them carries no `tailwind-merge`. Their `class` is
appended to their own classes, not merged into them: to replace one of their own utilities, mark
the replacement important, `<Button class="px-8!">`. Tailwind 4 writes the `!` at the end.

## The theme-class rule

`tailwind-merge` knows Tailwind's own utility groups. It is not taught this repository's theme
component classes (`btn-*`, `input`, `badge-*`, …) — that list would be hand-kept and would drift
from `theme/`. So:

- Do not override a theme component class through `class`; pick the variant through the
  component's own prop.
- `cn` resolves conflicts between Tailwind utilities only. Two theme classes are both kept:
  `cn("btn-primary", "btn-danger")` is `"btn-primary btn-danger"`.

## Why its own package

`cn` used to live at `@spy4x/preact-signals/cn`, with no dependency on the rest of
`signals/` — it is a pure string function, not state. It moved into its own package so a consumer
that only wants class-name merging does not pull in the signals layer.
