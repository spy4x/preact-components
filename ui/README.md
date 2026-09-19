# `@preact-components/ui`

Preact + Tailwind primitives extracted from `gb`, `financy` and `offer-lens`.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton. App
  state arrives as props; side effects (clipboard, geolocation, toasts) arrive as callbacks.
- **Pure Tailwind.** No dependency on `theme/` or `icons/`: component classes are inlined and the
  handful of glyphs are inline SVG.
- **Server-renderable.** `document`, `navigator` and timers are touched inside effects or event
  handlers only.

## Components

| Component         | Subpath            | Ports / key props                                     |
| ----------------- | ------------------ | ----------------------------------------------------- |
| `Badge`           | `badge`            | `text`, `color`, `type`                               |
| `Button`          | `button`           | `variant`, `size`, native button attrs                |
| `ConfidenceMeter` | `confidence-meter` | `value` (clamped 0–100), `label`                      |
| `CopyButton`      | `copy-button`      | `textToCopy`, `copy?` (clipboard port)                |
| `Dropdown`        | `dropdown`         | `trigger`, `children`, `vertical`, `horizontal`       |
| `ErrorState`      | `error-state`      | `message` (renders nothing when empty)                |
| `GeoButton`       | `geo-button`       | `onLocation`, `onError?`                              |
| `LoadingScreen`   | `loading-screen`   | `message`, `description`                              |
| `LoadingSkeleton` | `loading-skeleton` | `rows`                                                |
| `LoadingSpinner`  | `loading-spinner`  | `label`, `size`                                       |
| `OnOffButtons`    | `on-off-buttons`   | `value`, `amount`, `onSwitch`                         |
| `PageTitle`       | `page-title`       | `children`, `class`                                   |
| `Table`           | `table`            | `headerSlot`, `bodySlots`, `footerSlot`, `rowDataE2E` |
| `Tabs`            | `tabs`             | `tabs`, `active`, `onChange`, `orientation`, `lazy`   |
| `Toastr`          | `toastr`           | `toasts`, `onDismiss`                                 |
| `ToggleSwitch`    | `toggle-switch`    | `value`, `onToggle`, `disabled`, `label`              |

## Usage

```tsx
import { Badge, Button, Toastr, ToggleSwitch } from "@preact-components/ui"
// or one component at a time, so the barrel does not pull in the rest
import { Badge } from "@preact-components/ui/badge"
```

Wiring side effects through ports, so the package stays app-agnostic:

```tsx
<ToggleSwitch value={archived} onToggle={(next) => settings.archive.set(next)} />

<CopyButton textToCopy={invoice.id} copy={(text) => app.clipboard.copy(text)} />

<GeoButton
  onLocation={(position) => map.center.set(position)}
  onError={(message) => app.toast.error({ body: message })}
/>

<Toastr toasts={app.toast.list.value} onDismiss={(id) => app.toast.remove(id)} />

<Tabs
  active={section.value}
  onChange={(id) => section.set(id)}
  tabs={[
    { id: "metrics", label: "Metrics", content: <MetricsList /> },
    { id: "logs", label: "Logs", content: <LogList />, disabled: !canReadLogs },
  ]}
/>
```

`Tabs` is controlled — `active` in, `onChange` out, no selection state of its own — and it is not a
router, so the caller wires it to whatever state it uses. By default every panel is rendered and the
inactive ones are `hidden` (attribute plus utility), which keeps each `aria-controls` resolving and
every panel in the accessibility tree; `lazy` renders only the active panel and drops `aria-controls`
from the tabs whose panel it omitted. Ids are derived from each `TabItem.id` (`${id}-tab`,
`${id}-panel`) and never generated, so keep them unique per document. Arrow keys follow `orientation`
— Left/Right horizontal, Up/Down vertical — plus Home/End; the decision table is the exported
`nextTabIndex`.

`Toastr` auto-dismisses each toast after `toast.duration` milliseconds (default 5000, `0` keeps it
until dismissed) and reports it through `onDismiss` — the caller owns the stack.

## Tests

`deno task test` from the repo root. Tests render each component with
`preact-render-to-string` and assert on the real markup: palette selection, variant swap, utility
merge order, `aria` wiring, null returns and prop passthrough. `preact-render-to-string` is pinned
in this package's `deno.json` because the root import map has no renderer.

## Not in this package

`DateTimeFilter`, `MetricsList`, `Map`, `Export` and the higher-level selectors
(`CurrencySelector`, `DateRangeSelector`, `AccountSelector`) stay app-side for now — the first two
are theme-coupled and belong with the charts work, `Map` loads Leaflet from an unpkg script and
`Export` drags in `xlsx`. `DeletionValidation` belongs with the CRUD package.
