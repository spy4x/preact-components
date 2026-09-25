# `@spy4x/preact-cn`

One function: join conditional class names and resolve conflicting Tailwind utilities.

```ts
import { cn } from "@spy4x/preact-cn"

cn("p-2", isActive && "bg-blue-500", isDisabled && "opacity-50")
```

Falsy inputs (`false`, `null`, `undefined`) are dropped. The rest is passed through
`tailwind-merge`, so a later utility wins over an earlier one in the same group —
`cn("p-2", "p-4")` is `"p-4"` — instead of both reaching the DOM and leaving the winner to CSS
source order.

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
