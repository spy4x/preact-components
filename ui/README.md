# `@spy4x/preact-ui`

Preact + Tailwind primitives extracted from earlier source applications.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton. App
  state arrives as props; side effects (clipboard, geolocation, toasts) arrive as callbacks.
- **Tailwind classes, rendered against the theme.** Components write Tailwind utilities and the
  theme's class names (`pc-input`, `btn-input-icon`), so a page needs `theme/`'s stylesheet; a few
  glyphs come from `@spy4x/preact-icons`.
- **Server-renderable.** `document`, `navigator` and timers are touched inside effects or event
  handlers only.
- **A `class` is merged, except on ten exports.** Most components pass a caller's `class` through
  `cn` from `@spy4x/preact-cn`, so a caller's utility replaces the component's own of the same
  group. `Button`, `buttonClasses`, `ImageGallery`, `Lightbox` (#471), `Input`, `Textarea`, `Select`
  and `EnhancedForm` (#511) use `join` instead, and `CopyButton` and `ZoomableImages` hand their
  `class` to `Button` and `Lightbox`, so a browser bundle that renders them carries no
  `tailwind-merge`, about 28 KB minified. `Field` puts its `class` on its wrapper unchanged, as
  before. Their `class` is appended after their own classes, and replaces one of them only when
  it is marked important, `<Button class="px-8!">`. Every component the library renders keeps one utility per group on an
  element; `ui-guide/class-conflicts.test.tsx` holds that for every card in the guide.
- **One Preact option hook, for four components' refs.** `./forward-ref.ts`'s hook, installed on
  Preact's shared `options` object, is what lets `Input`, `Button`, `Checkbox` and `Radio` forward
  the `ref` each is given to the native element it renders instead of Preact applying it to the
  component itself. Fourteen of this package's exports load it — counted once, by hand, by walking
  each subpath's own module graph for `forward-ref.ts`; no check repeats the count: the four
  components themselves — `./button`'s only other export is `buttonClasses`, so a caller who imports
  that alone still installs the hook; the package root (`.`), which carries every export;
  `./confirm-dialog`, `./copy-button`, `./date-range-picker`, `./modal`, `./on-off-buttons` and
  `./pagination`, each of which renders a `Button` of its own; `./dropdown`, which uses
  `buttonClasses` without ever rendering a `Button`; and `./copy-block` and `./data-table`, which
  load it transitively — through `./copy-button` and `./pagination` respectively.
  `@spy4x/preact-crud` loads it too, transitively, through `./dropdown`. It acts only on the four
  components it forwards refs for; nothing else in this package or a caller's own markup is
  affected.

## Ledger rows (#257)

A line with no real columns — an outcome sentence, a price line — is not a new component. Apply
`theme/preset.css`'s own `border-subtle` token directly: `class="border-subtle flex
items-baseline justify-between gap-4 border-b py-2 last:border-b-0"` on each row, inside whatever
wraps the list (a `<ul>`, a `<div>`, `Card`'s `CardBody`). This is not what `Table` itself does —
`Table`'s own row dividers are `divide-gray-200 dark:divide-gray-600` (and `divide-gray-100` in the
body), literal Tailwind grays that do not read `border-subtle` or any other design token, so they
do not repaint under `ink` or any other palette. The recipe here is deliberately the token-based
one `Table` does not use, on markup that is not a table because the content has no columns to be
one. See #257's own "What I suggest" for the two options this decides between.

## Components

| Component         | Subpath             | Ports / key props                                                                                                                                                                               |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Avatar`          | `avatar`            | `name`, `src`, `alt`, `size`                                                                                                                                                                    |
| `AvatarGroup`     | `avatar`            | `items`, `max`, `label`, `size` (a `role="group"`, not a list)                                                                                                                                  |
| `Badge`           | `badge`             | `text` or `children`, `color`, `type`, `href?` (the whole pill becomes a link)                                                                                                                  |
| `Button`          | `button`            | `variant`, `size` (`"none"` leaves sizing to `class`), `busy`, `busyLabel`, native button attrs; `href?` and `navigate?` (router port) render a link                                            |
| `Card`            | `card`              | `children`, `class` — a bordered surface                                                                                                                                                        |
| `CardBody`        | `card`              | `children`, `class`                                                                                                                                                                             |
| `CardFooter`      | `card`              | `children`, `class`                                                                                                                                                                             |
| `CardHeader`      | `card`              | `title`, `action` and `headingLevel?` (`2`–`6`: the title becomes that heading; plain text without it), or `children`; `class`                                                                  |
| `Checkbox`        | `checkbox`          | `children` (the label), `labelClass`, native checkbox attrs; forwards `ref`                                                                                                                     |
| `Cluster`         | `layout`            | `gap?` (default `sm`), `align?`, `justify?`, `as?`, `class?` — a wrapping row                                                                                                                   |
| `Combobox`        | `combobox`          | `items`, `value`, `onChange`, `getLabel?`, `filter?`, `loading?`, `loadingMessage?`, `ariaLabel?`, `aria-labelledby?`, `id?`                                                                    |
| `ConfirmDialog`   | `confirm-dialog`    | `title`, `message?`, `onConfirm`, `onCancel`, `confirmLabel?`, `cancelLabel?`, `tone?`                                                                                                          |
| `CopyBlock`       | `copy-block`        | `text`, `singleLine?`, `copy?` (clipboard port), `copyLabel?`, `copiedLabel?`, `failedLabel?` — built on `CopyButton`                                                                           |
| `CopyButton`      | `copy-button`       | `textToCopy` (string, or function read on click), `copy?` (port; `false` or a throw is a failure), `copiedLabel?`, `failedLabel?`, `data-*`                                                     |
| `DataTable`       | `data-table`        | `columns`, `rows`, `rowKey`, `sort`, `onSortChange`, `caption`, `captionHidden?`, `empty?`, `paging?`, `mode?` (`"client"` default, or `"server"` with `paging.total`), `rowDataE2E?`, `class?` |
| `DateRangePicker` | `date-range-picker` | `range`, `onChange`, `timeZone`, `presets` or `withTime`, `labels?` (every key optional)                                                                                                        |
| `Dropdown`        | `dropdown`          | `trigger`, `triggerLabel` or `triggerNamedByContent` (one is required), `menuLabel`, `vertical` (`"auto"` by default), `horizontal`                                                             |
| `DropdownItem`    | `dropdown`          | `href`, `onClick`, `type`, `disabled`, `danger`, `class` — a `role="menuitem"` out of the tab order once its `Dropdown` has hydrated, a plain link or button before                             |
| `EmptyState`      | `empty-state`       | `icon?`, `title?`, `headingLevel?` (`1`–`4`, `3` default; same look at every level), `description?`, `action?`                                                                                  |
| `EnhancedForm`    | `enhanced-form`     | `action?`, `method?`, `onSubmit?`, `sending?`/`done?`/`failed?` slots, `labels?`, `status?` — posts natively before hydration                                                                   |
| `ErrorState`      | `error-state`       | `message` (renders nothing when empty)                                                                                                                                                          |
| `Field`           | `field`             | `id`, `label?`, `children`, `hint?`, `error?`, `required?`, `suffix?`                                                                                                                           |
| `FileInput`       | `file-input`        | `id`, `accept?`, `multiple?`, `maxSize?`, `name?`, `onFiles?`, `onReject?`, `label?`, `error?`, `previews?`, `labels?`                                                                          |
| `Grid`            | `layout`            | `gap?` (default `md`), `minColumnWidth?` (`sm`/`md`/`lg`), `as?`, `class?` — equal columns that fill the row                                                                                    |
| `ImageGallery`    | `image-gallery`     | `images` (`{ src, alt, thumbSrc?, webpSrc?, width?, height? }[]`), lightbox labels, `controls?`, `layout?`, `hero?`, `captions?`, `navigation?`, `navigationVariant?`, `snap?`, `slideWidth?`   |
| `Input`           | `input`             | native input attrs, `class`; forwards `ref`                                                                                                                                                     |
| `InputButton`     | `input-button`      | `icon`, `iconLabel`, `onClick?`, native input attrs                                                                                                                                             |
| `Kbd`             | `kbd`               | `keys` (`"mod+k"`) or `children`, `apple?`, `labels?`                                                                                                                                           |
| `InlineEdit`      | `inline-edit`       | `value`, `onSave` (may return a promise), `editLabel?`, `inputLabel?`, `savingLabel?`, `errorMessage?`, `disabled?`                                                                             |
| `KanbanBoard`     | `kanban-board`      | `columns`, `items`, `renderItem`, `itemLabel`, `onMove`, `onOpen?`, `labels?`, `headingLevel?` — controlled; mouse drag and keyboard moves                                                      |
| `Lightbox`        | `lightbox`          | `images`, `index`, `open`, `onClose`, `onIndexChange`, `label?`, `closeLabel?`, `previousLabel?`, `nextLabel?`, `counterLabel?`, `controls?`, `caption?`                                        |
| `Link`            | `link`              | `href`, `navigate?` (router port), `class`, native anchor attrs — a real `<a>`; a plain click goes through `navigate`                                                                           |
| `LoadingSkeleton` | `loading-skeleton`  | `rows`                                                                                                                                                                                          |
| `LoadingSpinner`  | `loading-spinner`   | `label`, `loadingLabel?` (hidden word without a `label`, default `"Loading"`), `size`                                                                                                           |
| `Modal`           | `modal`             | `open?` or `defaultOpen?`, `onClose?`, `title?` or `ariaLabel?`, `children`, `footer?`, `cancelLabel?`                                                                                          |
| `MoneyDisplay`    | `money-display`     | `amount` (smallest unit), `currency`, `locale?`, `colorNegative?`, `class?`                                                                                                                     |
| `MoneyInput`      | `money-input`       | `value` (smallest unit or `null`), `onChange`, `currency`, `locale?`, `min?`, `max?`, `name?`, `id?`, `invalidMessage?`, `rangeMessage?`                                                        |
| `Notice`          | `notice`            | `tone?` (`info` default, `warning`, `success`, `danger`), `title?`, `children` (the body), `action?`, `urgent?` (`role="alert"`; `status` without it), `data-*`; renders nothing when empty     |
| `OnOffButtons`    | `on-off-buttons`    | `value`, `amount`, `onSwitch`                                                                                                                                                                   |
| `Page`            | `layout`            | `as?`, `class?` — the content column: max width, page gutter, `xl` between sections                                                                                                             |
| `PageTitle`       | `page-title`        | `children`, `class`                                                                                                                                                                             |
| `Pagination`      | `pagination`        | `page`, `pageCount`, `onChange`, `label`, `previousLabel`, `nextLabel`, `pageLabel`                                                                                                             |
| `PlanCard`        | `billing`           | `planName`, `status` (`SubscriptionStatusValue`), `price?`, `periodEnd?`, `cancelAtPeriodEnd?`, `manageAction` (a form posts there), `locale?`, `timeZone?` (default `"UTC"`), `labels?`        |
| `PricingTable`    | `billing`           | `plans` (`PricingPlan[]`, smallest-unit amounts, `unit?`), `onChoose?`, `action?`, `fieldName?` (default `"planId"`), `defaultInterval?`, `locale?`, `labels?` — one posting form per plan      |
| `Progress`        | `progress`          | `value`, `max`, `label`, `id` (a caption needs an `id`)                                                                                                                                         |
| `Radio`           | `radio`             | `children` (the label), `labelClass`, native radio attrs; forwards `ref`                                                                                                                        |
| `RadioGroup`      | `radio`             | `legend`, `name`, `options`, `value?`, `onChange?`                                                                                                                                              |
| `Section`         | `layout`            | `title?`, `description?`, `headingLevel?` (2–4), `as?` (`section`/`article`/`aside`/`div`), `class?`                                                                                            |
| `Select`          | `input`             | `options`, `placeholder?`, native select attrs                                                                                                                                                  |
| `ShortcutsDialog` | `shortcuts-dialog`  | `open`, `onClose`, `shortcuts`, `title?`, `closeLabel?`, `defaultGroup?`, `apple?`, `kbdLabels?`                                                                                                |
| `SortableList`    | `sortable-list`     | `items` (`{ id }[]`), `renderItem`, `itemLabel`, `onMove(from, to)`, `labels?`, `class?` — controlled; drag a handle (touch or mouse) or use the keyboard                                       |
| `Stack`           | `layout`            | `gap?` (default `md`), `as?`, `class?` — a column                                                                                                                                               |
| `StatusMark`      | `status-mark`       | `status` (`ready`/`in-use`/`beta`/`wip`/`paused`/`archived`/`known-issue`/`outcome`/`live`/`offline`), `label?` — a sibling of `Badge`, which has no shape                                      |
| `Table`           | `table`             | `headerSlot`, `bodySlots`, `bodyKeys?` (one identity per row; position when omitted), `footerSlot`, `caption?`, `captionClass?`, `rowDataE2E`                                                   |
| `Tabs`            | `tabs`              | `tabs`, `active`, `onChange`, `lazy`                                                                                                                                                            |
| `Textarea`        | `input`             | native textarea attrs, `class`                                                                                                                                                                  |
| `ThemeToggle`     | `theme-toggle`      | `store` (a `createThemeStore()` from `@spy4x/preact-signals/theme`), `labels?`, `hintForMs?` — one icon button cycling auto, light and dark                                                     |
| `Toastr`          | `toastr`            | `toasts`, `onDismiss`, `corner`, `label`, `dismissLabel`, `dataE2E`                                                                                                                             |
| `ToggleChips`     | `toggle-chips`      | `options`, `value`, `onChange`, `mode?` (`multiple`/`single`), `label?`, `color?` — pressable `Badge`-look chips with `aria-pressed`                                                            |
| `ToggleField`     | `toggle-field`      | `id`, `label`, `value`, `onToggle`, `description?`, `error?`                                                                                                                                    |
| `ToggleSwitch`    | `toggle-switch`     | `value`, `onToggle`, `disabled`, `label`                                                                                                                                                        |
| `Tooltip`         | `tooltip`           | `content`, `label`, `placement`, `focusable`                                                                                                                                                    |
| `UpgradePrompt`   | `billing`           | `href`, `navigate?` (router port), `labels?` (`title`, `message`, `action`)                                                                                                                     |
| `UnsavedGuard`    | `unsaved-guard`     | `when`, `navigate` (router port), `owns(url)` (which addresses the router handles), `onDiscard?`, `labels?` — asks before leaving with unsaved changes                                          |
| `ZoomableImages`  | `zoomable-images`   | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `zoomLabel?`, `previousLabel?`, `nextLabel?`, `onOpen?`                                                                                 |

## Usage

```tsx
import { Badge, Button, Toastr, ToggleSwitch } from "@spy4x/preact-ui"
// or one component at a time, so the barrel does not pull in the rest
import { Badge } from "@spy4x/preact-ui/badge"
```

Wiring side effects through ports, so the package stays app-agnostic:

```tsx
<ToggleSwitch value={archived} onToggle={(next) => settings.archive.set(next)} />

<CopyButton textToCopy={invoice.id} copy={(text) => app.clipboard.copy(text)} />

<Toastr toasts={app.toast.list.value} onDismiss={app.toast.remove} />

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
`${id}-panel`) and never generated, so keep them unique per document. Left/Right move between tabs
and Home/End jump to the ends; Up/Down stay with the page. The decision table is the exported
`nextTabIndex`.

An app's first load needs no component of its own. `LoadingSpinner` already centres itself in a
flex column, so giving it the window's height and the page's colour makes it the whole screen:

```tsx
if (!app.ready.value) {
  return <LoadingSpinner size="lg" label="Loading your workspace…" class="min-h-dvh bg-canvas" />
}
```

`min-h-dvh` follows a phone's collapsing address bar, and the spinner sits in the normal flow, so
a toast or dialog raised during the load stays on top of it.

`Toastr` auto-dismisses each toast after `toast.duration` milliseconds (default
`defaultToastDuration`, which is 5000; `0` keeps it until dismissed) and reports it through
`onDismiss` — the caller owns the stack. `createToastStore` in `@spy4x/preact-signals` writes
that same `duration` field, so the wiring above needs no adapter. The id needs none either: the
exported `ToastId` (`string | number`) is the type of `ToastItem.id`, the id `onDismiss` is called
with, and the id that store's `remove` takes.

A toast carries an `id`, a `body`, and optionally a `type`, a `title`, a `duration` and a
`dismissLabel`, and a `dataE2E` that the component puts on that toast's own element as `data-e2e`,
so a test can wait for one message rather than for any text in the stack. The component renders the
variant's glyph, the `title` in bold above the `body` when there is one, and a dismiss button; the
title sits inside the toast's live element, so a screen reader hears it with the body. The component
invents no title: a hand-built toast without one renders none, and neither does an empty one.
`createToastStore` always writes one — the caller's, or its kind's default (`"Info"`, `"Success"`,
`"Error"`, `"Warning"`, overridable through its `titles` option) — so a store-fed toast always shows
a heading. Until [#207](https://github.com/spy4x/preact-components/issues/207) the store wrote it
and this component dropped it.

`corner` puts the stack in one of the window's four corners, 2rem from both edges: `"top-left"`,
`"top-right"` (the default), `"bottom-left"` or `"bottom-right"`. The toasts keep the order of
`toasts` in every corner, and each one slides in from its corner's side unless the reader prefers
reduced motion.

**The stack is always in the document, an empty one included.** It renders as a named region marked
`aria-live="polite"` whether or not it holds a toast, which is what lets a screen reader announce a
toast that arrives later: an area created together with its first message is commonly not announced
at all, because the reader sees a new subtree rather than a change to one it is watching. An empty
stack has no children, no padding and no minimum height, so it paints nothing and costs no layout —
positioned `fixed` it is out of flow, and a caller that overrides that to `static` gets a
zero-height box. What it does cost is one named landmark on every page that mounts it, so mount one
stack per page rather than one per view.

Inside that polite area an error toast additionally carries `role="alert"`, which interrupts;
every other variant carries `role="status"`. Both roles imply `aria-atomic`, so a reader announces
the whole toast rather than the one text node that changed.

The timer pauses while the pointer is over the stack or focus is inside it, and resumes with the
time it had left when they leave — a toast is reachable by keyboard instead of a race. Moving focus
_within_ the stack, from a link in a toast's body to its dismiss control, does not resume it.
Raising a toast's `duration` while it is on screen is the one thing that refills the budget rather
than continuing it, which is how a caller extends a toast it has already shown.

`duration` is not validated, and `resolveDuration` documents what each odd value does. The short
version: pass `0`, a positive number of milliseconds up to 2,147,483,647, or nothing. A negative
number and `Infinity` both dismiss the toast at once, because the browser runs either as a zero
delay, and so does anything above 2,147,483,647 ms (about 24.8 days), because browsers hold a
timer's delay as a 32-bit signed integer. `NaN` starts no timer and so keeps the toast like `0`
does.

**This component owns the dismiss timer, and the store it is wired to owns none.** The pause can
only hold a timer this component runs, so `createToastStore` from `@spy4x/preact-signals`
schedules nothing: it holds the list, and `onDismiss` calls its `remove`. The side that can see a
pointer resting on a toast is the side that should be timing it, which is why the timer lives here
rather than there.

It used to be the other way round in both halves, and both were quiet. The store scheduled a
removal per toast, so a store-fed toast was taken away on the store's own schedule whatever the
pointer was doing and the pause reached nothing
([#175](https://github.com/spy4x/preact-components/issues/175)); and the store wrote the delay
under a field called `timeout` that this component never read, so both clocks ran and a toast lived
whichever was **shorter** — a delay longer than five seconds was cut down to five, and a delay of
`0`, documented as keeping the toast until somebody dismisses it, lost it after five
([#174](https://github.com/spy4x/preact-components/issues/174)). One field name, `duration`, on
both sides now; `timeout` is still accepted by the store for one release, and `duration` wins when
both are given.

An application that renders toasts some other way gets no auto-dismiss from that store and
schedules its own removals — two lines, in `signals/README.md`. There is deliberately no opt-in
timer there, because a second clock for this one to disagree with is the defect wearing a different
coat.

Every string the stack shows is a prop with an English default: `label` names the region
(`"Notifications"`), `dismissLabel` names every dismiss control (`"Dismiss"`), and one toast can
name its own with `ToastItem.dismissLabel`, which is worth doing when several are on screen and
"Dismiss" three times over says nothing about which is which. The `data-e2e` attribute is rendered
only when `dataE2E` is passed, so a consumer's markup carries a test hook only when that consumer
asked for one.

```tsx
<Toastr
  toasts={app.toast.list.value}
  onDismiss={app.toast.remove}
  label="Benachrichtigungen"
  dismissLabel="Ausblenden"
/>
```

## Badge

A badge holds a text label (`text`, typed by `BadgeProps`) or element content (`children`, typed
by `BadgeElementProps`), never both; a badge with neither, or with both, is a type error. Element
content — a `StatusMark` beside a word, say — gets a `gap-1` between its parts, which a class of
your own overrides:

```tsx
<Badge color="gray" href="https://ci.example.com/my-repo">
  <span>CI</span>
  <StatusMark status="ready" label="Passing" />
</Badge>
```

`href` makes the whole pill one link: it renders an `<a>` with the focus ring the other focusable
components draw, and the pill's content is the link's accessible name. That is the shape of a CI
pill, where the pill is one target. For a pill with a link inside it, leave `href` out and pass the
`<a>` among the children instead. A badge without `href` renders the same `<span>`, with the same
classes, as before element content existed.

## Button

`busy` is for the time between a press and the end of the work it started: a payment being
confirmed, a form being saved. The button shows a spinner, sets `aria-busy="true"` and
`aria-disabled="true"`, and cancels every press, so its `onClick` does not run again and a submit
button does not send its form a second time. It does not set `disabled`, because a disabled button
drops focus to the page and a keyboard user who pressed Enter would lose their place. `busyLabel`
replaces the children while busy; an icon button shows the spinner instead of its icon and keeps its
`aria-label`.

```tsx
<Button type="submit" busy={saving.value} busyLabel="Confirming…">Confirm</Button>
```

Given `href`, `Button` renders an `<a>` with the classes the same `variant`, `size` and `class`
give a `<button>`, focus ring included, so an app whose actions are links does not copy the
button's classes onto an anchor of its own. Its props are `ButtonLinkProps`, a separate interface,
so an interface that extends `ButtonProps` is untouched; `ButtonOverloads` is the type of `Button`
with both call shapes. A `navigate` port follows the rule `Link` runs: a plain click calls
`navigate(href)` and the browser does not navigate, and a click with Ctrl, Meta, Shift or Alt, a
middle click, another `target` or a `download` stays the browser's. A link has no `busy`.

A disabled link has no `disabled` attribute to set, so `disabled` renders the `<a>` without `href`,
with `role="link"` and `aria-disabled="true"`, dimmed like a disabled button. With no `href` it
leaves the tab order and a click goes nowhere, as a disabled `<button>` does, and a screen reader
still reads it as an unavailable link.

`size="none"` sets no padding, gap or text size (and no box size on the `icon` variant), so the
caller sizes the button through `class`. The other sizes render the same classes as before.

```tsx
<Button href="/reports" navigate={router.navigate}>Reports</Button>
<Button href="/book" variant="outline" size="none" class="px-6 py-3 text-lg">Book a call</Button>
```

## Dropdown

It opens without JavaScript. The server renders a `<details>` whose `<summary>` is the trigger, so
before hydration, or with scripts off, a click, Enter or Space opens the panel, Tab walks its items,
and links and form posts inside it work. Hydration swaps that for the menu button before the
browser paints: the hydrated markup, keyboard handling and roles are the menu's alone. A panel the
visitor opened before hydration stays open, with focus on its first item, and a trigger that had
focus keeps it. The fallback has no Escape and no arrow keys, and it does not close when focus or a
click leaves it. So it announces no menu either (#537): until its `Dropdown` hydrates, the panel
has no `role="menu"`, `aria-orientation` or `menuLabel` name, and a `DropdownItem` is a plain link
or button with no `role="menuitem"`, in the tab order, because Tab is the only key that reaches it
before then. Hydration puts the roles and the name back and takes the items out of the tab order.
An item a caller renders by hand keeps whatever role and `tabindex` it sets. For an item that
posts, wrap a `DropdownItem` with `type="submit"` in a `<form role="none">`, as `Shell`'s form-post
item does: it follows the same rule and posts with or without JavaScript.

`vertical` defaults to `"auto"`: the menu opens below its trigger unless it would run past the
bottom of the viewport and there is more room above, as it does for the last row of a long table.
It is measured each time the menu opens, before the browser draws it, so an upward menu is never
drawn downward first. The server renders it downward, which is where a menu without JavaScript
would open. `"up"` and `"down"` fix the direction. It measures against the viewport only, and once
per opening: a menu clipped by a scrolling container, such as a modal's body, can still be cut off,
and scrolling while the menu is open does not flip it.

`dropdownOpensUp(trigger, panelHeight, viewportHeight)` is that decision on its own, a pure function
of the trigger's `top` and `bottom`, the panel's height and the viewport's height. It opens up when
the panel and its 8px gap do not fit below and there is more room above than below.

## Tooltip

A supplementary hint on a trigger, revealed by hover and by keyboard focus, anchored with CSS only.
Two rules go together and the component holds both: **a hint can be dismissed**, and **a hint can be
pointed at**. Escape hides it and drops `aria-describedby` without moving focus, and it comes back on
the next hover or focus; the surface takes pointer events and the gap between trigger and hint is the
surface's own padding, so a pointer can travel onto the hint and rest there while it is read. A hint
that cannot be dismissed covers what somebody was reading, and one that cannot be hovered cannot be
read at all by anyone magnifying the screen.

`label` is the trigger's own accessible name and the hint is only ever its description. By default
the trigger is a `<button>`, because `aria-label` on an element with no role is not guaranteed to
reach the accessibility tree at all. `focusable={false}` is for a trigger whose children are already
interactive: the wrapper becomes a `role="group"` around that control, which keeps one tab stop for
one control and still gives the name and the description an element the tree keeps.

```tsx
<Tooltip content="Supplements the trigger" label="Total revenue" placement="right">
  <span>Revenue</span>
</Tooltip>
```

While a hint is on screen its box — the bridge to the trigger included — sits over whatever is behind
it and takes the clicks that would have gone there. It is inert again the moment the hint is hidden.
The reveal itself is Tailwind's `group-hover` and `group-focus-within`, and Tailwind compiles every
hover style inside `@media (hover: hover)`: on a device that reports no hover-capable pointer the
hint is reached by focus only, which is the right behaviour on a touch screen. The browser checks
drive both paths: one moves a real pointer onto the trigger and asserts the hint appears and then
goes away again, and another asserts the hit testing that lets the pointer travel onto the hint and
rest there.

## Combobox

Every string it shows is a prop with an English default: `placeholder` (`"Select…"`), `emptyMessage`
(`"No matches"`), `countMessage` (`"1 match"` / `"12 matches"`), `loadingMessage` (`"Loading…"`) and
`clearLabel` (`"Clear selection"`).

Enter and Escape pressed while an input method is still composing a word neither select an option
nor close the list: the key belongs to the input method.

**One live region, rendered with the field and never taken away.** Every combobox renders a single
`role="status"` element with `aria-live="polite"` and `aria-atomic="true"` on every render, the
server render included, and it is empty until the field has been used. Answers are put into it and
taken out of it; it is never created along with one. This is the library-wide rule that `Toastr`
here and `SWUpdater` in `system/` also follow, and the reason is the same in all three: assistive
technology announces a _change_ to a region it is already watching, and commonly says nothing at all
about a region that arrives with its message already inside it.

**What goes into it, and when.** Three answers, and none is given before it is asked:

| The field                                    | What the region holds |
| -------------------------------------------- | --------------------- |
| rendered, never opened, never typed in       | nothing               |
| opened, no query                             | nothing               |
| a query, and options left                    | `countMessage(count)` |
| a query — or an open list — and nothing left | `emptyMessage`        |
| a query — or an open list — while `loading`  | `loadingMessage`      |

**While the caller is fetching, the field does not say "No matches".** A search that fetches options
per keystroke holds an empty list for the length of every fetch, and an empty list then is not an
answer: saying "No matches" would be a claim the results contradict a moment later, spoken on every
keystroke. Pass `loading` while the fetch is in flight and the region holds `loadingMessage` in place
of both the empty message and the count; set it back to `false` when the options land, and the region
changes to the count or to the empty message, in the same element.

The count answers typing, which is the one thing a screen-reader user otherwise gets no feedback
about: the rows are on screen for anyone who can see them, so the count is `sr-only` and nobody else
meets it. Opening the list is answered by the list — a reader announces the expanded listbox and the
highlighted row — so a count repeated on every open would be noise over the top of it. The empty
message keeps the wider rule it already had: it is the answer to a question, and opening the field
asks one. A field nobody has touched, one whose options are still arriving over the network for
instance, says nothing at all rather than claiming there is nothing to match. When those options land
while the popup is open, the message goes and the first usable row takes the highlight, so `Enter`
picks something without an arrow key first: a list that arrives with nothing highlighted tells a
screen reader that nothing arrived.

**It is written once.** The empty message is the visible paragraph, rendered inside the region rather
than copied into a hidden twin beside it, so the words on screen and the words announced cannot drift
apart and a reader browsing the page does not meet the same sentence twice.

**What it costs a host: nothing.** The region carries no class, no padding, no border and no minimum
height, so it is zero pixels tall while it is empty — and it is a child of the component's own root,
which is a plain block container, rather than a sibling of the field in the host's layout. A parent
that holds a whole combobox is therefore charged for one combobox-shaped box either way. Measured in
Chromium against a clone of the shipped field, in a column of two 24px paragraphs, taking the region
out and putting it back: **0px in every one of block flow, block flow with `space-y-4`, a `flex`
column with `gap-4`, a `flex` column with `space-y-4`, a `grid` with `gap-4`, and a `grid` with
`space-y-4`**. That is the one thing that differs from `SWUpdater`, whose region _is_ its whole
output and therefore lands directly in the host's container, where a `flex` or `grid` gap does charge
16px for it. What an always-present region costs everywhere is one more node in the accessibility
tree, and here that is one per field rather than one per page — the trade [#186] weighed and took.

**The input is described by the region while the empty message is in it, and never while the count
is.** The two sentences the region can hold are different kinds of thing. "No matches" is a standing
fact about the field, true for as long as it is on screen, and a live region announces a _change_ and
says nothing at all when focus arrives — so without a description, somebody tabbing into a
server-filtered field that was rendered with a query matching nothing would be told about the field
and nothing about the message on its face. `aria-describedby` therefore points at the region exactly
while `answersEmpty` holds. A count is not a fact about the field but about the last keystroke, and a
description is re-read every time the input is announced, so "12 matches" would be spoken as part of
the field's identity long after the number was true, and in the one moment it is new it would be both
described and announced. A query that matches nothing never carries a count, so while the input is
described the region's text is the empty message and nothing else.

Measured in Chromium through the DevTools protocol, which is the tree a reader reads rather than the
markup: the input's accessible description is `""` on an untouched field, `""` while the region holds
a count, the empty message once the query matches nothing, still the empty message on the closed
field that query was abandoned on, and `""` again once the field is cleared.

**A known limit of that.** A combobox closed by a click outside it, or by focus moving away, keeps
its draft query — only `Escape` and choosing an option drop it — so a field that has a selection can
close showing that selection while its region still holds the answer to the query that was abandoned.
Nothing is spoken, because nothing changed, but a reader browsing the page meets a count, or a "no
matches", that does not describe what the field is showing. This is not new: the same shape applied to
the empty message before the region was made permanent.

**No screen reader has been run against this repository.** What is demonstrated is markup and the
order in which the DOM changes — the region is in the page first, and the message arrives as a
mutation of that same element. `pages/checks/ui.ts` parks a reference to the region and a
`MutationObserver` on it while it is empty, so a check cannot pass by finding a region that turned up
carrying its text. That is not a demonstration that any particular screen reader speaks.

[#186]: https://github.com/spy4x/preact-components/issues/186

The highlight belongs to the keyboard: the arrow keys move it, the popup scrolls to keep it on screen
— `block: "nearest"`, so a row already in view does not move the list at all — and no pointer handler
writes `aria-activedescendant`, so a screen reader's reading position does not follow a mouse
somebody else is holding. The row under the pointer is still painted, in CSS.

**The highlight never outlives its row.** A list can shrink under an open popup — options withdrawn
by a caller that re-fetches them, twenty-seven rows replaced by three — and a highlight left where it
was would point `aria-activedescendant` at an element the page no longer holds. It is clamped to the
list on screen, so it is dropped for as long as the list is too short to hold it: shrink the list and
the highlight goes, grow it back and it returns to the row it was on. Only the value every reader
takes is clamped; the position itself is kept, because a list that comes back is the same list.

## DateRangePicker

A preset list and a custom from/to panel, controlled: `range` in, `onChange` out. `timeZone` is
required because the server's zone is not the visitor's, and the clock is either injected through
`now` or read inside a click handler, never during render. The `DateRange` type and the calendar
arithmetic behind the presets (`parseIsoDate`, `addDays`, `startOfMonth` and the rest) come from
`@spy4x/time` in spy4x/ts-libs; import them from there.

**Every string the panel shows has an English default, so `labels` and every key in it are
optional.** A caller who says nothing gets `"Date range"`, `"Any dates"`, `"From"`, `"To"`,
`"Apply"` and `"Cancel"`; a caller who needs one word changed passes that one word and keeps the
rest. A key passed as `undefined` falls back the same way an omitted one does. The one string with
no default is a preset's own `label`, which arrives with the preset: the caller decides both which
presets to offer and how to word each of them for its audience.

```tsx
<DateRangePicker
  range={range.value}
  onChange={(next) => range.value = next}
  timeZone="Europe/Paris"
  presets={[
    { preset: "last-7-days", label: "Sieben Tage" },
    { preset: "custom", label: "Eigener Zeitraum" },
  ]}
  labels={{ placeholder: "Alle Daten", apply: "Übernehmen" }}
/>
```

**Focus follows the panel**, which is the difference between a keyboard user keeping their place and
losing it. Opening moves focus to the pressed preset — so a reader announces the choice the panel
opens on — or to the first preset when nothing is pressed, or to the panel itself when there are no
presets at all. The move happens in an effect rather than in the click handler, because the panel is
rendered with the `hidden` attribute and Chromium refuses to focus anything inside a `display: none`
subtree: a `focus()` call in the same tick as the state change fires no focus event at all.

A close the person drove **from inside** the panel hands focus back to the trigger: choosing a
preset, Apply, Cancel, pressing the trigger a second time, and Escape. In each of those the next
render hides the element their focus is on, so something has to move it, and the trigger is where
they came from.

A close driven from **outside** it does not, and there are three. A click outside leaves focus on
whatever was clicked, because the person has just put it there deliberately. Focus leaving the
component — a Tab out of the panel — closes it and leaves focus where the Tab went, the way
`Dropdown` closes; an unapplied custom range is discarded, as Cancel discards it. Focus moving
between the panel's own controls, into a date field and its native picker, or back to the trigger
closes nothing. And Escape is a return only when focus was still inside the component as the key
was pressed: focus can fall to the page itself with the panel still open — a scripted blur, a
focused control that vanished — and pulling it onto the trigger from there would move the person
somewhere they did not go.

All eight of those close paths are driven in a real browser in `pages/checks/ui.ts` — the five that
return focus and the three that must not — and so is the move that opens the panel.

`Custom…` is marked pressed while the custom fields are the live choice — the button was activated,
either field was typed into, or the caller's `selectedPreset` is `"custom"` — and stops being
pressed when another preset takes over or the draft is cancelled. It reads that state from the same
signal the fields write, so what a screen reader announces and what the panel shows cannot disagree.

### `withTime`

Off by default, and off changes nothing: the markup and the behaviour described above are exactly
what this component had before `withTime` existed — `date-range-picker.test.tsx` pins a byte-for-byte
snapshot of the day-only render to prove it, taken before `withTime` was added. `DateRangePickerProps`
keeps naming the exact shape it always has; it only grows one new optional field, `withTime?: false`,
that every caller from before this option existed already satisfies by not setting it, so a wrapper
typed `Omit<DateRangePickerProps, "timeZone">` or a bare `props.presets` read keeps compiling
unchanged. `DateRangePicker` itself takes the wider `AnyDateRangePickerProps`, which also allows
`DateRangePickerTimeProps` — the shape below.

With `withTime` on, `range` and `onChange` carry a `DateTimeRange` instead of a `DateRange` — the
same `from`/`to` shape, a `YYYY-MM-DDTHH:mm` wall time in the picker's `timeZone` rather than a bare
calendar date, `to` inclusive the same way `DateRange`'s is. The two date fields become
`datetime-local` fields, and there is no `presets` prop in this mode: the panel shows exactly two
built-in presets, `"Last hour"` and `"Last 24 hours"` — English by default, overridden through
`labels.lastHour` and `labels.last24Hours` like every other string here — plus the custom From/To
fields, which are always present rather than gated behind a `"custom"` entry the caller opts into,
since typing a value or picking one of the two presets is the only way to reach a timed range at all.

```tsx
<DateRangePicker
  withTime
  range={range.value}
  onChange={(next) => {
    range.value = next
    query({ after: next.fromInstant, before: next.toInstant })
  }}
  timeZone="Europe/Berlin"
/>
```

#### Exact instants, and the hour that happens twice

A wall-clock string cannot say which of a repeated hour it means: on the night a zone puts its
clocks back, `2026-10-25T02:30` happens twice in `Europe/Berlin`, and a caller that converts it
itself gets whichever instant its date library defaults to — so a "Last 24 hours" range could query
23 or 25 hours, and "Last hour" none (#264). So every range `onChange` hands back in this mode is an
`ExactDateTimeRange`: the same two strings, plus `fromInstant` and `toInstant`, the exact moments
they mean as UTC ISO 8601 strings (`2026-10-25T01:30:00.000Z`). Query by those. Both instant fields
are optional on `DateTimeRange` itself, so a `range` passed in without them is still valid.

What changed for a caller that reads only `from` and `to`:

- A typed time the clocks skip comes back rewritten to the time it is read as — `02:30` on
  Berlin's spring-forward night reaches `onChange` as `03:30` — where it used to come back as typed.
- A year below 100 (`0050-06-01T10:00`) keeps Apply disabled, where it used to be applied:
  `resolveWallClock` does not resolve years below 100. No note says so.
- A range whose ends read `02:50 … 02:10` on a fall-back night can now be applied, once the person
  sets To to its second pass (the first 02:50 through the second 02:10, twenty real minutes); the
  string rule used to refuse it.
- The range `onChange` receives, and the one `rangeForTimePreset` returns, carry two more keys, so a
  deep-equality comparison against a bare `{ from, to }` object no longer matches.

Every other time comes back exactly as typed.

- **A preset** knows its instants exactly: `"last-hour"` and `"last-24-hours"` are always one and
  twenty-four real hours apart, across both clock changes.
- **A typed time the clocks repeat** makes the field ask which one is meant: a radio pair under it,
  "First, before the clocks go back" and "Second, after the clocks go back", each followed by its UTC
  offset. The first is chosen until the person picks the second. A `range` passed in with its
  instants reopens on the pass they name.
- **A typed time the clocks skip** is read forward by the length of the gap — Berlin's nonexistent
  `2026-03-29T02:30` is read as `03:30`, the moment a clock that had not jumped would have called
  `02:30`, Temporal's `"compatible"` rule — and a note under the field says so. Apply still works,
  and the range it hands back says `03:30` in the string as well as the instant, so the two never
  disagree.
- **Order is by instant.** Apply stays disabled until both ends resolve and `fromInstant` is not
  after `toInstant`, so the first-pass `02:50` through the second-pass `02:10` is a valid
  twenty-minute range, and the second-pass `02:30` through the first-pass `02:45` is not. When both
  ends resolve and are out of order — a skipped `02:30` read as `03:30` with To at `03:10`, say — a
  note above Apply says "From comes after To, so there is nothing to apply."
- **Tied to its field.** Each field's `aria-describedby` names its skipped-time note or its radio
  group whenever one is shown, and the order note too while it shows; Apply is described by the
  order note. Each radio group is named by its field's label and its legend ("From This time happens
  twice that day"), so the two groups can be told apart.

The five strings have English defaults and are overridden through `labels`: `repeatedTime` (the
radio pair's legend), `earlierOccurrence`, `laterOccurrence`, `skippedTime`, a function handed the
`YYYY-MM-DDTHH:mm` value the skipped time is read as, and `outOfOrder`.

The maths is in `date-range.ts`, on top of `resolveWallClock` from `@spy4x/time/tz`:

- `resolveDateTime(value, timeZone)` says whether a wall-clock value happens once, never or twice
  (`WallClockKind` from `@spy4x/time/tz`), with its instant, the later instant of a repeated time,
  and what a skipped time is read as.
- `exactDateTimeRange(range, timeZone, occurrences?)` resolves a whole range to an
  `ExactDateTimeRange`, taking `"earlier"` or `"later"` for each end (default `"earlier"`), and
  throws for a malformed end or a range whose instants are out of order.
- `occurrenceOf(value, instant, timeZone)` is its inverse for one end: `"later"` when the instant is
  the second pass of a repeated time, `"earlier"` otherwise.
- `isValidDateTimeRange(range)` orders by `fromInstant`/`toInstant` when the range carries both, and
  by the strings, as it always has, when it does not.

`rangeForTimePreset` and `presetForTimeRange` are the two presets' own maths — plain functions of an
injected `now` and `timeZone`, the same convention `rangeForPreset` and `presetForRange` follow. Both
subtract a fixed number of _real_ milliseconds from `now` before reading the wall clock, and
`rangeForTimePreset` returns the instants with the strings. Read as strings alone, a preset on the
day a zone falls back still converts wrong the way it always did — `rangeForTimePreset`'s own doc
lists the 0-, 2-, 23- and 25-hour cases, and `date-range.test.ts` pins each beside the exact
duration its instants give.

`to` is inclusive at the minute named, the same convention `DateRange`'s is at the day, and this
library truncates seconds — so a `"last-hour"` window covers 61 minutes end to end, not 60: the whole
of the `to` minute is included, not just its first instant.

The focus contract above is not re-implemented for this mode — `DateRangePicker`'s open/close
signals, `closePanel` and the effect that moves focus are the exact same code `withTime` runs
through, untouched by it. `pages/checks/ui.ts` still proves it holds there rather than assuming so:
opening moves focus in, every close driven from inside (both time presets, Apply, Cancel, Escape and
a second press on the trigger) hands focus back to the trigger, and both closes driven from outside
leave it alone — driven against the `withTime` card directly, the same way the day-only proof above
is driven against its own.

## Pagination

Page numbers with the long runs collapsed, plus previous and next. Controlled: `page` is rendered as
given (clamped into `1…pageCount`) and every request leaves through `onChange`. `pageCount={0}`
renders nothing at all, so a list that found no rows needs no special case at the call site, and
`pageCount={1}` renders the one page and no controls: a list with a single page has nowhere to go,
and two dead tab stops on it would cost every reader who tabs past them something and gain nobody
anything.

**From two pages up, Previous and Next are always rendered, and carry `aria-disabled="true"` where
they cannot act.** Both obvious alternatives lose the keyboard user's place at the exact moment they
reach the end,
which is while they are pressing the control: unmounting it destroys the element under their focus,
and setting the native `disabled` attribute on a focused button takes focus off it — measured in the
headless Chromium this repository drives, where `document.activeElement` went from the button to
`<body>` on the line that set the attribute. Chromium's accessibility tree reports the control as
disabled for either spelling, so nothing is given up. What `aria-disabled` does not do is stop the
press — a real Space press still fires a click on such a button — so each handler checks the end it
guards before calling `onChange`. The controls do mount and unmount as `pageCount` crosses between
one and two, which is the caller's data changing rather than a step the reader took inside the
control, so nobody's focus is on one at that moment.

**The window keeps two pages on each side of the current one.** The first and last page are always
shown, the window slides back inside the range rather than shrinking when it reaches an end, and a
`…` always stands for at least two pages: where a mark would have hidden a single page, that page is
written out instead, because the mark takes the same room and says less. `pageRange(page, pageCount,
size)` is that rule on its own, exported and unit-tested; `size` says how long a range may be before
it collapses at all, and the collapsed window's width does not depend on it. What bounds the
collapsed form is the two-page rule instead: at most nine items, being the five-page window plus, at
each end, either that end's page and a `…` or the two pages the window swallowed in place of that
`…`. The unit suite walks every page of every total up to sixty across a dozen values of `size`, so
nine is a measured ceiling rather than an estimate — and it checks that nine is reached, because a
bound nobody reaches is a bound nobody has tested.

```
pageRange(5, 10)   1 2 3 4 5 6 7 … 10
pageRange(15, 30)  1 … 13 14 15 16 17 … 30
pageRange(30, 30)  1 … 26 27 28 29 30
```

Every string is a prop with an English default: `label` names the `nav` landmark (`"Pagination"`),
`previousLabel` and `nextLabel` name the two controls, and `pageLabel` names one page number. That
last one is a function of the number rather than a string, because a translation needs the number
and where it falls in the sentence is the translator's business.

```tsx
<Pagination
  page={page.value}
  pageCount={24}
  onChange={(next) => page.value = next}
  label="Rechnungsseiten"
  previousLabel="Zurück"
  nextLabel="Weiter"
  pageLabel={(number) => `Seite ${number}`}
/>
```

## DataTable

`Table`'s markup joined to `@spy4x/platform/universal/sort`'s sort rules: a sortable,
optionally paged table with no sort state of its own.

```tsx
import { DataTable } from "@spy4x/preact-ui/data-table"
import type { SortRule } from "@spy4x/platform/universal/sort"

const sort = useSignal<SortRule<"date" | "merchant" | "amount">[]>([])

<DataTable
  caption="Invoices"
  columns={[
    { key: "date", header: "Date", sortable: true },
    { key: "merchant", header: "Merchant", sortable: true },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      render: (row) => formatMoney(row.amount),
    },
  ]}
  rows={invoices}
  rowKey={(row) => row.id}
  sort={sort.value}
  onSortChange={(next) => sort.value = next}
/>
```

**The caller owns `sort` — and `paging.page` when paging is on — the same way an app owns any
other filter, so either can live in a signal, `useState`, or a URL parameter through
`parseSort`/`serializeSort`.** `DataTable` reads that state, applies it with `sortRows` and a
plain slice, and writes the next value back through `onSortChange`/`paging.onChange`; it holds
none of its own. This is a deliberate split from `Pagination`, which only renders controls and
leaves slicing to the caller: `DataTable` already holds the full row set and the rules to apply to
it, so it is the one place that can do both without asking every caller to duplicate the pairing —
which is what one source application this component was extracted from was already doing by hand,
in two places.

`pages/src/data-table-sort.tsx` demonstrates the URL half in a real browser, bound through
`useUrlFilters` next to that hook's own demo, `pages/src/url-filters.tsx`: pressing a header adds
`?sort=` to the address, and a press of Back removes it again along with the sort. It lives in
`pages/src` rather than as a catalogue card because a card writing to `location` would be writing
to whatever host application embeds the catalogue, the same reason `useUrlFilters` itself is
demonstrated there.

**Two modes: `DataTable` sorts and pages, or a server already did.** `mode` picks one, and it is a
prop rather than something guessed from the rows, because it changes what `rows` means. Server mode is
the answer to [#235](https://github.com/spy4x/preact-components/issues/235), which found client
mode the only one.

- **Client mode** — the default, `mode` left out or `"client"`. `rows` is the complete, unsorted
  set: `DataTable` sorts it with `sortRows` and slices out the current page itself, sizing the pager
  from `rows.length`. `paging` is `{ page, pageSize, onChange }`, and a `total` there is a type
  error, since it would mean server mode was intended.
- **Server mode** — `mode="server"`. Something else — a server, a database query — already sorted
  and paged the rows, so `rows` is exactly the current page and is rendered as given: no `sortRows`,
  whose locale-aware collation need not match the server's, and no slice. `paging` adds `total`, the
  size of the whole set, which is the only way to size a pager from one page in hand; leaving it out
  is a type error. `sort` still drives `aria-sort` and the header glyphs, and a header press still
  calls `onSortChange` through `toggleSort` — that call, and `paging.onChange`, are the caller's
  signal to fetch the next slice. `rowKey` keys and stamps rows the same way in both modes.

```tsx
const response = useInvoicePage(sort.value, page.value) // your fetch: { rows, total }

<DataTable
  mode="server"
  caption="Invoices"
  columns={columns}
  rows={response.rows}
  rowKey={(row) => row.id}
  sort={sort.value}
  onSortChange={(next) => {
    sort.value = next
    page.value = 1
  }}
  paging={{
    page: page.value,
    pageSize: 25,
    total: response.total,
    onChange: (next) => page.value = next,
  }}
/>
```

The catalogue card shows both side by side; its server-mode table asks a stand-in server that
orders text by code unit, so "eBay refund" sorts after every capitalised name, which a client-side
re-sort would undo. `pages/checks/ui.ts` drives that table's header and pager by real key presses.
The pager's labels (`label`, `previousLabel`, `nextLabel`, `pageLabel`) default to English in both
modes and pass straight through to `Pagination`.

**Every sortable header is a real `<button>`**, so Tab, Space and Enter all reach it —
`pages/checks/ui.ts` proves a real click, Space and Enter on this header in client mode, and
Enter and Space in server mode. Pressing it calls `toggleSort`, which cycles that column through
ascending → descending → off and, if the column was not already part of `sort`, appends it as the
_least significant_ rule rather than replacing what was there. That is the whole of how a
multi-column sort is built: there is no modifier key, a keyboard user just Tabs to a second
sortable header and presses Space, and removes it again by cycling that same header back off.

**`aria-sort` carries the state; the chevron beside a header's text is decorative.** A column's
`<th>` carries `aria-sort="ascending"` or `"descending"` only while that column is part of `sort`
— a column not in `sort` carries no `aria-sort` attribute at all, never `"none"`. The chevron is
`aria-hidden`, so a screen reader is never told anything the attribute did not already say; it
only points a sighted reader the way `aria-sort` already points a screen reader.

**The table's name is a required `caption`.** It is the one string only the caller knows, so there
is no English default; `captionHidden` keeps it for assistive tech while hiding it visually
(`sr-only`) rather than leaving the table unnamed. `Table` gained an optional `caption`/
`captionClass` pair for this — omitted, it renders nothing, so every existing `Table` caller is
unaffected.

**`empty` replaces the whole body, not just one cell's worth**, when `rows` is empty: a single row
spanning every column, defaulting to `<EmptyState title="No rows" />`. The header stays, so a
sortable column stays clickable even when a filter elsewhere on the page is what emptied the list.

**`rowKey` is each row's identity.** `DataTable` hands it to `Table` as `bodyKeys`, so every
`<tr>` is keyed by the row it shows rather than by its position: a sort or a page turn moves the
row's DOM element, and whatever a cell holds — a ticked checkbox, a half-typed input, focus, a
component's own state — goes with the row instead of staying behind to describe whichever row lands
in its old place. `pages/checks/ui.ts` proves it on the catalogue card's Flag column, whose
checkboxes are deliberately uncontrolled. Keys must be distinct across `rows`. The same key is
stamped as `data-row-key` on each row's first cell, exported as `rowKeyAttribute`, so a page or a
browser check can point at a specific row without depending on its rendered text.

**Paging is optional and minimal**: `page`, `pageSize` and `onChange` — plus `total` in server
mode — mirroring `Pagination`'s own prop names because most of them pass straight through to it. In
client mode `DataTable` computes `pageCount` from the full, sorted row count and slices the visible
page itself; in server mode it computes `pageCount` from `total` and slices nothing. Omit `paging`
entirely for every row on one page. `page` is clamped into `1…pageCount` the same way `Pagination` clamps its own, before
it is used for the pager and, in client mode, the slice — a page a filter has shrunk past, or `0` or a negative
number, renders the nearest real page instead of an empty body beside a pager that disagrees with
it.

**A column is one of two shapes, and the types keep them exclusive.** A data column reads a row
field: `key` (one of the row type's own string keys), `header`, and optionally `sortable`, `align`
and `render`. `key` is also this column's identity, so it is what `sort` and `toggleSort` key by,
and only a data column can carry `sortable` or `aria-sort` at all. A display column has no field of
its own — an actions column, say — and takes `id`, `header`, `render` (required, since there is no
field to fall back to) and optionally `align`; it is never sortable and never carries `aria-sort`,
because there is no row field for a header press to toggle. `DataTableDataColumn` declares
`id?: never` and `DataTableDisplayColumn` declares `sortable?: never`/`key?: never`, so a column
carrying properties from both shapes — `{ id, sortable: true }` on a display column, or `{ key, id
}` on one meant to be a data column — fails `deno check` rather than compiling into the bug the
split exists to prevent: an earlier version let a display column reuse a data column's `key` for
its own identity, structurally undetected, and a header sorted by that field then read as sorted on
both columns, `aria-sort` coming from the key alone rather than from which shape the column was.
What the types do not, and cannot, check is that every column's own `id` or `key` is a distinct
_value_ from every other column's — that is documented, the ordinary "give a list of keyed things
distinct keys" rule, and nothing enforces it.

## EnhancedForm

A real `<form action method>` that posts on its own before hydration, or whenever `onSubmit` is
left out, and calls `onSubmit(formData)` in the background once one is given, keeping the page in
place. `method` defaults to `"post"` unconditionally — the same decision `system/`'s `AuthForm`
makes — so a submit in the gap before hydration finishes never puts a field's value in the address
bar; `action` is never defaulted, since an endpoint is always the caller's to name.

While a background submit is outstanding, `children` sits inside a disabled `<fieldset>` (or the
`sending` slot replaces it, when given); `done`/`failed` replace it once the promise settles.
Omitting `done`/`failed` keeps `children` on screen, re-enabled, so a caller that wants a retry gets
one without any extra wiring. A second click, or a `form.requestSubmit()`, while a submit is
outstanding does nothing: a ref checked synchronously, before either branch of the submit handler
runs, catches what the disabled fieldset has not repainted yet. The sending state always ends — on
success, on a rejection, on a synchronous throw from `onSubmit`, and on a `pageshow` with
`persisted: true`, which is what a promise abandoned in the back/forward cache would otherwise leave
stuck forever. A submit's own id is bumped on that reset too, so if the abandoned promise settles
later anyway, the stale `.then`/`.catch` finds its id no longer current and does nothing rather than
overwriting a newer submit already in progress.

The result is announced through one `role="status"` region, present and empty from the first
render — the same rule `Toastr` and `AuthForm` follow. The slot sits in a wrapper of its own:
without it, Preact's unkeyed child diffing can match the region's `<p>` against a text-carrying
`done`/`failed` slot's own `<p>` by type alone, patching the already-being-watched region into the
slot's content and creating a _new_ region node that reaches the document already holding its
message — exactly what an always-present region exists to avoid. The region hides itself
(`sr-only`) from sighted users whenever the current status has a slot of its own on screen at all,
whatever that slot's own copy says, so a caller whose `done` copy repeats the region's own default
is not shown the same sentence twice; a status with no slot of its own — the default disabled
`<fieldset>`, or an un-slotted `"failed"` — still shows the region, since nothing else
on screen carries the message then. Focus moves to the region only when both hold, and only once per
submit: focus was inside this form the moment the visitor submitted — a real click or keypress on
the submit button leaves it there, a `form.requestSubmit()` called from outside the form, or a
submit that started while focus was already elsewhere, does not — and the browser has since dropped
focus to `<body>`, which is what disabling the fieldset for `"sending"` does. The moment that recovery
happens, the first condition is cleared, so a visitor who then clicks on plain text — landing on
`<body>` again — and moves on to reading something else is not pulled back a second time once the
same submit later reaches `done` or `failed`. A submit nobody focused, or a visitor who has moved
focus somewhere specific of their own accord, is never pulled back at all.

A caller that already tracks the submit passes `status` (`"idle"`, `"sending"`, `"done"` or
`"failed"`), and the form renders from that value instead of its own: the fieldset, the slots, the
region and the focus recovery all follow it, and `onSubmit` is still called on every submit the
form accepts. Moving `status` on is then the caller's job, including after a back/forward-cache
restore, which the form cannot reset for it. The busy guard holds in this mode too: a submit is
refused while the caller's `status` reads `"sending"`, as well as while the promise `onSubmit`
returned is outstanding, so a caller whose `onSubmit` returns at once is still guarded. An empty
string for a key of `labels` makes the region say nothing in that status, and
`labels={{ sending: "", done: "", failed: "" }}` silences it entirely, for a caller whose own text
— the server's error, say — is the only message. The region still renders, empty, and still takes
focus when the visitor's submit button is disabled under them.

A form built on this can carry a honeypot from `honeypot`: `honeypotField` renders an off-screen
field simple bots fill in. Its server half comes from `@spy4x/platform/universal/honeypot`:
`HONEYPOT_FIELD_NAME` (`hp-field`, deliberately not a word a browser's own autofill heuristics reach
for) names the field, and `honeypotFilled(formData)` reads it back, in the page or in the handler a
no-JavaScript post reaches. A submit
whose honeypot carries a value should resolve as if it had succeeded, because telling a bot it was
caught only teaches it which field to leave alone next time.

## Lightbox

`Lightbox` is the one dialog `ImageGallery`'s thumbnail strip and `ZoomableImages`
both open — issue #140's "one lightbox, two ways in". `images`, `index`, `open`,
`onClose` and `onIndexChange` are the caller's own state; the component owns nothing but the
dialog's open/close lifecycle and which key or button moved the position.

**Built on a native `<dialog>`, not `Modal`.** The issue asked for `Modal` underneath it, so focus
handling would be written once, and two things about `Modal` said no instead. `Modal` wraps
`children` in a fixed `<div class="px-6 py-4">` with no prop that reaches it, which fights a
full-bleed image before anything else does. The one that actually rules it out: `Modal` renders no
ref to its `<dialog>`, so nothing outside it can attach a listener straight to the dialog element —
which is exactly what Left and Right need, since they must work only while the lightbox is open. A
listener on `Modal`'s own children would only ever see a key that bubbled up from whatever is
focused inside it, one step removed from the dialog itself for no reason a caller of `Modal`
controls. A native `<dialog>` with its own `ref` has neither problem. What does carry over from
`Modal` is reuse, not composition: its exported `shouldRetargetFocus`/`restoreFocus` pair, the same
one it uses for its own focus restore.

**Left and Right are attached once, on mount, directly on the `<dialog>` element**, reading `open`,
the current position and the total from a ref updated every render — the same shape
`ui/tooltip.tsx`'s Escape listener uses. This is the defensive shape `AGENTS.md`'s Escape-race rule
asks for; it is not fixing a race this component was measured to have. A listener gated on `open`
instead, registered in an effect keyed to it alongside the `showModal()` effect, was measured to
work too: both effects commit in the same batch, so a key pressed in the same task as the opening
click still finds a listener. Escape itself needs no listener: this dialog never refuses a close, so
`<dialog>`'s own Escape handling and its `close` event are the whole mechanism, and the `close`
event is also where focus is restored.

**The counter is visible, not only announced.** `counterLabel` decides its wording — an English
default, `` (position, total) => `${position} of ${total}` ``, and an override prop, the same
policy every other user-visible string in this package follows. Its own chip and the previous/next
buttons appear and disappear together, both gated on more than one image being in the sequence.

**The live region is always present**, inside the dialog whether it is open or not, and announces
the new image's description together with its position — `"A hero shot — 3 of 8"` — not the
position alone, since a reader arrowing through the sequence needs to know what changed as well as
where they now are.

**An image whose description is genuinely empty is dropped from `images`.** `alt` is required in
`LightboxImage`'s type; `describedImages` drops one whose `alt` is empty after trimming before
either caller renders anything with it, so the same image is missing from `ImageGallery`'s strip and
from `Lightbox`'s own sequence — and `open` is refused the same way when nothing survives the
filter, rather than showing an empty modal with no close control. Silent, not warned: `alt` is
already required by the type, so an empty one only reaches this component through a caller that
bypassed the type system to produce it, and nothing else in this package calls `console.warn` for a
value its own type already disallows. **This is not the same claim as "an image with no `alt`
attribute is refused everywhere."** `ZoomableImages` substitutes its own `fallbackAlt` (default
`"Image"`) for a missing `alt` first, exactly as it did before `Lightbox` existed, so a zoomable
image with no `alt` attribute still opens there, named `"Image"` — and, new here, shown as a visible
caption. Only a caller who also sets `fallbackAlt=""` turns that substitution off; only then can
content mode produce a genuinely empty description, and only then does it get the same refusal
`ImageGallery` and `Lightbox` apply to their own `images` prop.

**`controls="below"` moves the counter and previous/next into one row under the image and its
caption**; the default, `"overlay"`, floats them over the image as before. In the row layout the
image is positioned inside the box the row leaves, so `max-h-full` has a height to resolve
against and a 780×1688 image fits a 1440×900 window, `<picture>` or not.

**An image with `webpSrc` renders inside a `<picture>`**, with that as its `image/webp` source and
`src` as the fallback.

**`label` can name the dialog after the image it shows.** A string (default `"Image viewer"`) names
every image the same; a function, `(image, position, total) => string`, is called for the open
image, so `label={(image) => image.alt}` names the dialog `"Screenshot 2 of 7"` and renames it on
Previous and Next. **`caption={false}` leaves out the visible caption** in both layouts, for a page
that already shows each image's description beside it; the `alt` still names the image and is still
announced with the counter.

**A sideways swipe on a touch screen pages**, like Left and Right: leftward for the next image,
rightward for the previous. One finger, at least `SWIPE_MIN_PX` (50) CSS pixels sideways and more
sideways than vertical; a pinch or a vertical drag does nothing. `swipeStep(dx, dy)` is that rule as a pure function: `1` for the next image, `-1` for the
previous, `0` for no swipe.

**Every control against an edge clears the phone's safe area**: it sits at
`max(1rem, env(safe-area-inset-*))` from that edge. That is the old `1rem` wherever the inset is
zero, and clears a 47px notch on a phone turned sideways on a page whose viewport meta carries
`viewport-fit=cover`.

## ZoomableImages

`ZoomableImages` makes the images inside a container zoomable, opening the shared `Lightbox` — the
same dialog `ImageGallery` opens on a thumbnail (see the `Lightbox` section above). It was
`system/`'s `ImageLightbox` until #355 moved it here, next to the dialog it opens. It renders
nothing but that empty dialog, so a reader without JavaScript loses only the zoom. The layer is
delegated to the container: one listener instead of one per image, images that arrive after
hydration still work, and cleanup is complete. Previous and next page through the container's other
zoomable images, snapshotted at the moment one opens; an image that arrives afterward becomes
zoomable but is not spliced into a sequence already being viewed. An image with no `alt` attribute
is unchanged from before `Lightbox` existed: it still opens, named by `fallbackAlt` (default
`"Image"`), and is now also shown as a visible caption — new here, since the old dialog had none.
Only a caller who sets `fallbackAlt=""` turns the substitution off, and only then can an image
genuinely have no description; that image is then refused the way `ImageGallery`'s own `images` prop
is, and refused early — never marked a zoom control in the first place, so it keeps no Tab stop and
no name it cannot act on, and a click on it inside a link still follows the link.

**A zoomable image behaves like a button**, because that is what it has become. The component
gives every image it marks a tab stop, a button's role and a name saying what activating it does,
and both Enter and Space open the lightbox. Space is cancelled with them, exactly as a real button
cancels it, so the page does not scroll away under a reader who has just pressed it. A click and an
Enter press are cancelled too, which is what lets an image inside a link open the lightbox instead
of following the link.

The defaults name no particular kind of page: the container is `[data-lightbox]`, an attribute the
host puts where it wants the zoom layer, and an image with no `alt` is described as `Image`. What
the component puts on the host's images it takes off again when it unmounts.

- **It uses event delegation, not per-image listeners.** The source attached one
  listener per image and never removed them; delegation also survives images that appear after
  hydration. Escape needs no listener of its own: `<dialog>` closes natively and the `close` event
  clears the state, so the dialog and the state cannot disagree. A `MutationObserver` keeps the tab
  stops in step with images that arrive later, which delegation alone cannot do — a tab stop is an
  attribute on the image itself.
- **The lightbox image is positioned inside the dialog, not stretched across it.** A child that
  fills the dialog is a backdrop no click can ever land on, which is how the documented
  "click outside to close" went years without being true.

`resolveImage` (click target → lightbox image), `collectSequence` and `zoomableAlt` are the pure
decisions behind it, exported for a test to drive with a stub instead of a DOM.

## ImageGallery

A strip of real `<button>` thumbnails, one per image, that opens `Lightbox` on the one pressed — the
other way into the shared dialog; `ZoomableImages` is the first. Each thumbnail's accessible name is
the image's own `alt`, carried by the button through `aria-label`; the `<img>` inside it is
`alt=""`, decorative, so a screen reader is not given the same name twice. `thumbSrc` is the
thumbnail's own image source and defaults to `src` — the full image — when a caller has one size for
both.

`images` is filtered through `describedImages` once, and the filtered list is what both the strip
and `Lightbox` receive, so an index computed against the strip's own thumbnails always lands on the
same image inside the dialog — the two never run the filter separately over two different starting
arrays, which is what let them disagree in `ZoomableImages`'s own version of this bug before it was
fixed there (see the `Lightbox` section above).

`layout` chooses how the images sit. The default, `"grid"`, is the wrapping grid of small square
thumbnails described above. `"strip"` is a hero or case-study row: one line of large, uncropped
images, each most of the row's width, that scrolls sideways and snaps each image's start to the
row's start (CSS scroll snapping, no script). The strip shows each image's full `src`; `thumbSrc` is
for the grid. Every image is still a real button, so Tab moves through them and scrolls the focused
one fully into view, and Enter or Space opens it in `Lightbox`. The row has no smooth scrolling, so
there is no motion for the reduced-motion preference to stop.

Give each strip image its intrinsic pixel size in `width` and `height`. The strip renders both on
the `<img>`, so the browser reserves the image's height before it loads and nothing below a hero
strip jumps down as the images arrive. Without them, the row has no height until the images load.
The grid ignores both: its thumbnails are fixed-size squares. Every strip image after the first
carries `loading="lazy"`, so only the image a reader sees first loads up front.

```tsx
<ImageGallery
  layout="strip"
  images={[{ src: shot, alt: "The dashboard", width: 1600, height: 900 }]}
/>
```

Five more props shape the strip, and the grid ignores all of them. Each defaults to off, and a strip
that sets none renders exactly what it did before they existed.

- `hero` is for a strip that is the page's hero. Its first image loads with `loading="eager"` and
  `fetchpriority="high"`, often the page's largest paint; every later one with `loading="lazy"` and
  `decoding="async"`.
- `captions` shows each image's `alt` under it, in a `<figcaption>`. The image then carries the same
  `alt`, which names its button, and the button drops its `aria-label`: the visible caption and the
  button's accessible name are the same text.
- `navigation` adds a counter under the row, worded by `counterLabel` (`"2 of 5"` by default, the
  lightbox's own wording), which follows the slide in view. Beside it, Previous and Next, named by
  `previousLabel` and `nextLabel`, scroll the row by one slide; they render only while the row is
  wider than its box, and the browser measures that again whenever the row or a slide changes size.
  At either end a button stays focusable and is marked `aria-disabled`, so focus is not lost.
- `snap="center"` snaps each slide to the row's centre instead of its start.
- `slideWidth="orientation"` gives narrower slides, about a third of a wide row, when the first
  image's `width` and `height` say it is portrait, so a row of phone screenshots does not fill the
  column. A landscape first image keeps the wide slides.

With `navigation`, the row carries `data-gallery-strip` and the counter `data-gallery-counter`,
stable hooks for an app's own tests and styles. `stripPreviousLabel` and `stripNextLabel` name the
row's buttons apart from the lightbox's (`"Previous screenshot"` on the page, `"Previous image"` in
the dialog); they default to `previousLabel` and `nextLabel`. `label` and `lightboxCaption` are
passed to the lightbox as its `label` and `caption`.

`navigationVariant` sets how Previous and Next look. `"outline"`, the default, fills them with the
surface colour behind a control border. `"ghost"` is `Button`'s ghost variant with the same border:
transparent, for a page whose other secondary buttons are transparent, and filled on hover like
every other button. Both class lists come from `stripNavigationClasses`, and every class in them is
already in `COMPONENT_CLASSES`, so an app's `@source inline(...)` needs nothing new.

An image's `webpSrc` is used by the strip as well as the lightbox: the strip image renders inside a
`<picture>` with a WebP `<source>` and `src` as its fallback. The grid's small thumbnail stays a
plain `<img>`.

```tsx
<ImageGallery
  layout="strip"
  hero
  captions
  navigation
  snap="center"
  counterLabel={(position, total) => `${position} / ${total}`}
  images={[{ src: shot, webpSrc: shotWebp, alt: "The dashboard", width: 1600, height: 900 }]}
/>
```

## MoneyDisplay and MoneyInput

Money in this convention is a whole number in a currency's smallest unit — `1250` means `€12.50`.
`MoneyDisplay` renders one as text; `MoneyInput` is a text field that turns typed text back into
one. Both go through `@spy4x/platform/universal/money`, whose two rules matter for any caller that
formats or parses money by hand: never assume two decimal places — the yen (`JPY`) has none, the
Kuwaiti dinar (`KWD`) has three, both read from `Intl` rather than a hard-coded table — and never
round a typed amount that has more fraction digits than the currency allows; it is refused, the same
way `"1.005"` for a two-decimal currency is refused rather than guessed at as `100` or `101` cents. A
grouping mark is accepted only where `Intl` itself would place one for that locale, or not at all —
never stripped wherever it stands, which is what let `"12.50"` typed in a German field (where `.` is
the grouping mark, not the decimal mark) silently become €1,250.00.

`MoneyDisplay` is a bare `<span>` — this is text, not a control, so it carries no role or label of
its own. `colorNegative` colours a negative amount red; every other style is the caller's `class`.

`MoneyInput` keeps the typed text as local, purely visual state — the same allowance `Input`'s own
draft state has — synced from `value`/`currency`/`locale` only while the field is not focused, so a
value the caller pushes in from outside is reflected but a keystroke never races a stale render.
Text that does not parse (a letter, a second decimal mark, more fraction digits than the currency
allows) or a parsed amount outside `min`/`max` leaves `value` exactly where it was and shows a
message — `invalidMessage` or `rangeMessage` — in a `role="status"` live region that is rendered,
empty, from the very first render, the same shape `Combobox`'s own status region uses and for the
same reason: a region that arrives with its message already inside it is commonly not announced at
all, only a _change_ to a region already being watched is. `inputmode="decimal"` brings up the
numeric keyboard on a phone.

While that message stands, the visible control's own `setCustomValidity` is set to it, so a real
form submit is refused by the browser and the message is what the browser shows — the same way a
missing `required` value is. The typed text and the message both stay exactly as they are when the
field loses focus with a message standing: blur does not silently revert to the last committed
amount and drop the message, which would otherwise let someone tab past a rejected entry and never
learn it was thrown away. Blur only reformats the shown text, to `locale`'s canonical form, when the
last edit resolved cleanly.

The visible `<input>` has no `name`, so it never posts anything of its own. Pass `name` for a
second, `type="hidden"` input that carries the smallest-unit integer instead (empty string for a
`null` value), which is what a server reads back — the same shape `ui/honeypot.tsx`'s field uses
for a plain HTML form's own posted data. That hidden input starts out `disabled`, so it is left out
of `FormData` entirely, until a mount effect has resolved whatever text is already sitting in the
visible field: Preact does not overwrite an input's `value` while hydrating, so text typed before
the bundle ran survives untouched in the DOM, and without this step a form submitted in that gap
would post the server-rendered amount rather than what the visitor actually typed. Once that effect
has run — value, message and validity all applied the same way a real keystroke would resolve them
— the hidden input re-enables. A form submitted before the effect runs posts no amount at all,
never a stale one; a form submitted right after posts what was actually typed, or is blocked by
`setCustomValidity` if that text did not parse.

## FileInput

A real `<input type="file">`, hidden with `sr-only` rather than `display: none`, so it keeps the
keyboard behaviour, the screen-reader story and the plain form post the browser already gives a file
input for free. The visible drop zone is a `<div>` around it, not a second `<label>`: the one label
this component renders (from `label`) carries the only explicit `for`, so there is exactly one
accessible name, the same guarantee `Field` documents for its own element-child clone. Clicking
anywhere in the drop zone forwards to the input through a ref; Tab reaching the input and a real
Space or Enter press open the file chooser with no extra wiring at all, because the browser already
does that for a focused, undisabled file input regardless of how small it is drawn. Since the
`sr-only` input's own `:focus-visible` paints nothing visible, the drop zone reads that state off its
descendant with `has-[:focus-visible]:ring-*` and rings itself instead, so a sighted keyboard user
still sees where focus is.

A drop writes its files onto the real input, through a fresh `DataTransfer` — the one documented way
to set a file input's `FileList` from script — so a plain `<form>` post carries a dropped file the
same way it carries one chosen through the native picker. `accept` is matched the way the browser
matches it: an extension (`.png`), a MIME type (`image/png`) or a MIME wildcard (`image/*`), any one
of a comma-separated list. `maxSize` is a byte comparison. Either refusal is reported through
`onReject` and rendered into a `role="status"` paragraph that is present, empty, on every render —
the same shape `EnhancedForm`'s status region has — so a screen reader has something to listen to
before the first refusal happens, and cleared-then-set so a second identical refusal still reaches
it.

Chosen files are listed, each with a remove button named after the file it removes
(`labels.removeFile`, defaulting to `` `Remove ${name}` ``); removing one rewrites the input's
`FileList` the same way a drop does. `previews` (default `true`) renders an image file's
`URL.createObjectURL` thumbnail next to it; the preview is revoked the instant its file leaves the
list, and every preview still outstanding is revoked on unmount.

`FileInput` also works nested inside `Field`, unmodified: the native `<input type="file">` is a
labelable element, so `Field`'s ordinary element-child clone (`id`, `aria-describedby`,
`aria-invalid`) applies the same way it does to a plain `<input>`.

```tsx
<Field id={id} label="Attachments" hint="Up to 2 MB each" error={error}>
  <FileInput id={id} accept="image/*" onFiles={(files) => …} />
</Field>
```

Omit `label`, `hint` and `error` on `FileInput` itself when nesting it this way — `Field` already
renders the one visible label the association needs, and `FileInput` would otherwise render a
second one for the same control. `FileInput` reads `Field`'s cloned `aria-describedby` through its
own `"aria-describedby"` prop and folds it in alongside its own rejection-region id, and reads
`Field`'s cloned `aria-invalid` (a JS boolean, not the string `"true"`) through its own
`"aria-invalid"` prop, so either source marking the control invalid is enough.

Without `multiple`, the native picker already limits a click-driven choice to one file, so only a
drop of several at once can offer more than the single slot allows — it keeps only the first and
refuses the rest with reason `"too-many"` (`labels.tooMany`), reported through `onReject` and
announced the same way a `maxSize`/`accept` refusal is, rather than silently dropped.

It does not upload — sending the chosen files is the caller's own form post or `fetch` call.

## Keyboard shortcuts

`useHotkeys(bindings, options)` (subpath `hotkeys`) listens for `keydown` on `document` while the
component that calls it is mounted. A binding is `{ keys, handler }`, with an optional
`description` and `group` for `ShortcutsDialog`. `keys` takes one key press: a single key (`"?"`,
`"/"`), a key with modifiers (`"shift+n"`, `"mod+k"`) or a named key (`"esc"`, `"up"`). `mod` is
Command on Apple platforms and Control elsewhere; the platform is read when the listener is
attached, or given as `options.apple`. Two-key sequences such as `"g i"` are not supported and
throw.

A symbol typed with AltGr, such as `@` on a German keyboard, still runs a binding for that
symbol: the hook asks the browser whether AltGr is held, so a real Control+Alt chord on a keyboard
without AltGr runs only a binding that names Control and Alt.

Key presses in a text field, a select or editable content are left alone, and so are presses
inside a dialog, unless a binding sets `inFields` or `inDialogs`. A matched press has its default
action cancelled unless the binding sets `preventDefault: false`. `options.enabled` switches every
binding off at once. A key press an input method has taken, such as the Enter that confirms a word
typed in Japanese, runs no binding.

```tsx
const [open, setOpen] = useState(false)
const bindings = [
  { keys: "?", description: "Show keyboard shortcuts", handler: () => setOpen(true) },
  { keys: "mod+k", description: "Search", group: "Navigation", handler: openSearch },
]
useHotkeys(bindings)

<ShortcutsDialog open={open} onClose={() => setOpen(false)} shortcuts={bindings} />
```

`pickHotkey(bindings, press, apple)` is the hook's decision on its own: the first binding whose
combination matches a key press and that may fire where the press landed.

`Kbd` draws a combination as nested `<kbd>` elements: ⌘K on Apple platforms, Ctrl + K elsewhere.
The server and the first browser render draw Ctrl, and an effect switches to ⌘ on an Apple
platform, unless `apple` says which. A glyph such as ⌘ is hidden from screen readers and followed
by its name in visually hidden text. `keyFaces(keys, apple, labels)` returns the text and the name
of each key `Kbd` draws, and `KBD_LABELS` holds the English words it uses, which `labels`
overrides one by one.

`ShortcutsDialog` lists shortcuts under group headings, built on `Modal`.
`groupShortcuts(shortcuts, defaultGroup)` is its grouping on its own: groups in the order they
first appear, shortcuts without a description left out.

The parser and the matcher are framework-free and come from `@spy4x/platform/browser/hotkeys`
in spy4x/ts-libs, which also documents the keyboard-layout and AltGr rules.

## InlineEdit

Pressing the value opens a text field in its place with the whole value selected. Enter saves,
and so does moving focus away; Escape cancels and puts the old value back. Focus returns to the
value's button when the field closes while it has focus, and stays where the user moved it when a
blur saved. While a promise returned by `onSave` runs, the field is read-only and `aria-busy`; a
rejected promise keeps the field open with the typed text and the `errorMessage` under it.

Removing the component while its field is open saves nothing, even in Chromium, which fires `blur`
on a focused field that leaves the page: the typed text is dropped. Turning `disabled` on while the
field is open cancels the edit the way Escape does, unless a save is already running. Enter and
Escape pressed while an input method is still composing a word do not save or cancel.

`inlineEditCommit(draft, value)` is the save rule on its own: the trimmed draft, or `null` when it
is empty or matches the value, in which case the field closes without calling `onSave`.

## ToggleChips

Each chip is a `button` with `aria-pressed`, inside a `role="group"` named by `label`. A pressed
chip is a filled badge in `color`, an unpressed one a grey outlined badge. In `mode="single"`,
pressing another chip moves the selection and pressing the pressed chip clears it to `null`.

`toggleChipSelection(options, selected, pressed)` is the multiple-mode press on its own: it adds or
removes `pressed` and returns the selection in the order of `options`.

`badgeClasses(color, type, className)` is `Badge`'s class list without the element, which is how
the chips share `Badge`'s palette.

## KanbanBoard

A board of columns whose cards move between and within the columns. It is controlled: `items` in,
one `onMove({ itemId, fromColumn, fromIndex, toColumn, toIndex })` out, and the board never
reorders the caller's data. `toIndex` counts the target column without the moved card, so `0` is the
top and the column's remaining length is the bottom. Within a column, cards show in the order of
`items`.

```tsx
<KanbanBoard
  columns={[{ id: "todo", title: "To do" }, { id: "done", title: "Done" }]}
  items={tasks.value}
  renderItem={(task) => task.title}
  itemLabel={(task) => task.title}
  onMove={(move) => tasks.value = moveKanbanItem(tasks.value, move)}
  onOpen={(task) => openEditor(task)}
/>
```

- **Mouse**: the browser's own drag and drop. A line marks where the card will land, and an empty
  column takes a drop. Touch is not proven: whether a phone starts a native drag depends on its
  browser, so on touch screens treat the keyboard path and your own "move to" control as the way
  to move a card.
- **Keyboard**: every card is a tab stop. Space or Enter picks it up; the arrow keys move it (Left
  and Right between columns, Up and Down within one); Space or Enter drops it, and Escape puts it
  back. Moving focus away while holding a card, with Tab or a click elsewhere, also
  puts it back. Focus stays on the card after the drop, once
  the caller's `items` show it in its new column.
- **Announcements**: a live region says when a card is picked up, each move, the drop and a cancel.
  `labels` overrides any of them and the visible strings; `itemLabel` names a card in them and is
  required, because only the caller knows what a card is called.
- The columns are a list named by `labels.board`, each column a list named by its heading; the
  board scrolls sideways when the columns do not fit, rather than squeezing them.
- **Opening a card**: pass `onOpen(item)`. A click that is not a drag opens the card, and Enter
  opens it while Space still picks it up; the instructions a card is described by say so
  (`labels.instructionsWithOpen`). Without `onOpen`, Enter picks a card up like Space.
- **A move the caller refuses**: the board shows the card where `items` puts it. Focus stays on
  the dropped card until it arrives in its new column or the reader moves focus somewhere else;
  the board never pulls focus back after that.
- A card's body comes from `renderItem`, inside the card's own focusable control, so keep buttons
  and links out of it.

Helpers:

- `moveKanbanItem(items, move)` applies a reported move to an array of items and returns a new
  array: the item takes `toColumn` and the `toIndex`-th place in it, and the rest keep their order.
- `nextKanbanSlot(key, from, lengths)` is the arrow-key map on its own: where a picked-up card goes
  for a key, given each column's length without it.
- `defaultKanbanLabels` holds the English strings `labels` overrides.

## SortableList

A vertical list whose items a reader reorders by dragging a handle, on a touch screen or with a
mouse, or from the keyboard. It is controlled: `items` in, one `onMove(from, to)` out, and the list
never reorders the caller's data. `from` is the item's index before the move and `to` its index
after it.

```tsx
<SortableList
  items={tasks.value}
  renderItem={(task) => task.title}
  itemLabel={(task) => task.title}
  onMove={(from, to) => {
    const next = [...tasks.value]
    next.splice(to, 0, ...next.splice(from, 1))
    tasks.value = next
  }}
/>
```

- **Touch and mouse**: pointer events, no drag library. A drag starts only on an item's handle,
  the one element with `touch-action: none`, so a finger anywhere else on the list scrolls the page
  as usual. While an item is held, it follows the pointer and the other rows slide out of its way;
  near the top or bottom of the scrolling area (the nearest scrolling ancestor, or the page) the
  area scrolls. Escape, or a touch the browser cancels, puts the item back. A long press on a
  handle opens no browser menu.
- **Keyboard**: each handle is a button and a tab stop. Space or Enter picks the item up, the arrow
  keys move it, Space or Enter drops it, and Escape puts it back. Moving focus away while holding
  an item, with Tab or a click elsewhere, also puts it back. Focus stays on the handle after a
  drop or a cancel, by any input. A held handle has `aria-pressed="true"`.
- **Screen readers**: a reader's default reading mode may keep the arrow keys for itself, so they
  never reach the page. Pressing the handle there (a click with no pointer) picks the item up and
  pressing it again drops it; the reader then needs its focus or forms mode for the arrows to move
  the item.
- **Announcements**: a polite live region says when an item is picked up, each new position, the
  drop and a cancel. Each handle is named `Reorder <item>` and is a 44 px target. `labels`
  overrides any of these strings; `itemLabel` names an item in them and is required, because only
  the caller knows what an item is called.
- `renderItem` draws the body beside the handle, so it may hold its own buttons and links.
- A held item is put back when the caller changes the list's order or membership mid-move.

Helpers, exported for a caller that builds its own drag surface on the same rules:

- `sortableTarget(boxes, from, center)` is the drop rule: the index a held item takes from where
  its middle is, given every row's `{ top, height }` measured at pick-up.
- `sortableOffsets(boxes, from, to)` is the layout rule: how far each row shifts while the item at
  `from` is shown at `to`.
- `edgeScrollStep(y, top, bottom)` is the edge auto-scroll speed for one animation frame.
- `defaultSortableListLabels` holds the English strings `labels` overrides.

## ThemeToggle

One icon button for the theme preference, on the app's own `createThemeStore()`: the app creates
the store, calls `attach()` in an effect, and hands it over. The prop is typed by shape,
`ThemeToggleStore` (`preference`, `actual`, `cycle()`), because this package imports no store; a
`createThemeStore()` result fits it as it is. A click calls `cycle()`, so the order
is the store's: auto, then the opposite of the device, then the device's own theme, then auto again
(a dark device goes auto → light → dark → auto). The icon shows the preference — `IconThemeAuto`,
`IconSun` or `IconMoon` — and the accessible name says it, with the device's theme while on auto:
"Theme: auto (dark)". Three states are more than `aria-pressed` can carry, so the name changes
instead.

The click back to auto often changes nothing on screen, so it shows an "Auto mode" hint under the
button for `hintForMs` (2000 by default). The hint is the text of a polite live region rendered from
the start, because a region inserted together with its text is often not announced. It sits out of
the flow and takes no pointer events, so nothing moves and the button keeps focus. A click away from
auto while the hint is up hides it at once, and the next switch to auto shows it again with a fresh
timer. The hint sits under the button with their end edges aligned; when that would put it past
either edge of the viewport, as with a button at the start of a row on a phone, it slides sideways
to stay 8 px inside.

`defaultThemeToggleLabels` holds the English words: the four accessible names (`autoLight`,
`autoDark`, `light`, `dark`) and the hint. Pass any of them in `labels` to replace them.

```tsx
const theme = createThemeStore()
useEffect(() => theme.attach(), [])

<ThemeToggle store={theme} labels={{ hint: "Automatisch" }} />
```

## UnsavedGuard

`UnsavedGuard` asks before a person leaves a page with changes they have not saved. While `when` is
`true`, closing or reloading the tab gets the browser's own question (`beforeunload`), and a plain
click on an in-app link opens a `ConfirmDialog`: "Leave" calls `onDiscard` and then `navigate` with
the link's path, query and hash, and "Stay" closes the dialog. Its listeners exist only while `when`
is `true`, and go when it turns `false` or the guard unmounts.

A click is held back only when the browser would follow the link in this tab, to a page the app's
router handles: the main button, no modifier key, no `target` but `_self`, no `download`, the same
origin, an address `owns` accepts, and not a jump to a fragment of this same page (`href="#"`
counts as one). Everything else is the browser's. A same-origin link `owns` rejects, such as a
server-rendered page, is left to the browser, which asks through `beforeunload`.

The guard listens in the capture phase on `document`, so it decides before the link's own click
handler, or any ancestor's, has run. The only earlier cancellation it sees is a capture listener on
`window`, and a link it holds back never reaches its own handler. Mark an in-page action link
`data-unsaved-ok`, such as "Load the latest version" inside the form itself, and it is never held
back.

**The browser's Back button cannot be held back.** By the time the page hears of it the address has
already changed, and no event lets a page refuse it.

```tsx
<UnsavedGuard
  when={draft.value !== saved.value}
  navigate={(href) => setLocation(href)}
  owns={(url) => /^\/(notes|groups)(\/|$)/.test(url.pathname)}
  onDiscard={() => draft.value = saved.value}
/>
```

## Billing

`PricingTable`, `PlanCard` and `UpgradePrompt` take everything as props and fetch nothing, so they
work with any provider. `SubscriptionStatus` numbers, from 1, the five statuses spy4x/ts-libs#362
proposes for `@spy4x/billing`, in its order. `status` and `interval` also take the plain numbers, so
an app passes a same-valued enum of its own, or that package's, without a cast. Amounts are integers
in the currency's smallest unit, formatted with `formatMoney` from `@spy4x/platform`.

`PricingTable` lists each price as its own plan: a plan sold monthly and yearly is two entries with
two IDs, and a plan with no `interval` (a free plan) shows under both. Every "Choose" is a
`<form method="post">` that carries the plan's ID in a hidden `planId` field, so a choice works
before any script runs; `onChoose` takes the submit over once one does. When the plans have both
intervals, a monthly/yearly toggle sits above them. It is a pair of native radio buttons, so Tab
reaches it and the arrow keys move it, and a CSS `:has(:checked)` rule hides the other interval's
plans, so it works with no script too. The checked option shows a check icon and bolder text, so
the choice does not rest on its fill. The highlighted plan is raised and labelled "Most popular" in
words, right after its heading. A plan with a `unit` (`"member"`, in the caller's language) says
what one price buys: "€9.00 per member / month" in place of "€9.00 per month".

`PlanCard` shows the current plan, its status in words, and a date line chosen by status ("Renews
on", "Ends on", "Trial ends on", "Ended on"). A past-due or incomplete plan shows a warning sentence
beside a warning icon, so the state does not rest on colour. "Manage billing" is a form that posts
to `manageAction`, the app's route that opens the provider's portal. The date is shown in UTC unless
`timeZone` says otherwise, so the server and the browser print the same day.

`UpgradePrompt` is a short message and a link, in place of a feature the plan does not include.

Each component's English words are in `defaultPricingTableLabels`, `defaultPlanCardLabels` and
`defaultUpgradePromptLabels`; pass any of them in `labels` to replace them. The per-interval and
per-status words (`intervals`, `per`, `status`) merge key by key over the English ones, so a caller
may pass one word alone, and a status with no word shows no pill rather than an empty one. A
plan's per-unit text comes from `perUnit`, a function of the unit and the interval, so a
translation can order the words its own way; it replaces `per` for that plan. Each
"Choose" button's accessible name is `choose` and the plan's name unless `chooseName` says
otherwise, for a language that orders them differently. The date lines are functions of the
formatted date, so a translation can put the date where its language needs it.

```tsx
<PricingTable plans={plans} action="/billing/checkout" onChoose={(plan) => checkout(plan.id)} />
<PlanCard
  planName="Pro"
  status={SubscriptionStatus.PastDue}
  periodEnd={subscription.currentPeriodEnd}
  manageAction="/billing/portal"
/>
<UpgradePrompt href="/pricing" labels={{ message: "Exports come with the Pro plan." }} />
```

## Helpers

The pure functions and constants behind the components, each importable from the package root or
from the component's own subpath. Most exist so a rule can be unit-tested without a browser; the
ones a caller has a use for say when. A line that says a helper is exported for the package's own
components and tests means exactly that: nothing outside this package should build on it.

### Avatar (`./avatar`)

- `avatarFace({ src, failed, name })` picks which face an `Avatar` shows: `"image"` while `src` is
  set and has not failed, else `"initials"` when `name` yields one, else `"icon"`. Use it to match
  the same fallback chain in markup of your own.
- `groupSplit(total, max)` splits a member count into `{ visible, overflow }`: how many avatars an
  `AvatarGroup` draws and how many it counts behind its `+N` chip. The two always add up to the
  total, and a negative or non-finite argument counts as `0`.
- `groupLabel(label, total)` is an `AvatarGroup`'s accessible name, `"<label> (<total>)"`, with
  `"Avatars"` standing in for a blank label.
- `failedAfterSrcChange(previous, current, failed)` is exported for the package's own components and
  tests: it keeps an avatar's "image failed" flag only while `src` stays the same URL.

### Billing (`./billing`)

- `BillingInterval` (`Month`, `Year`) is how often a plan bills.
- `SubscriptionStatus` (`Trialing`, `Active`, `PastDue`, `Canceled`, `Incomplete`) is where a
  subscription stands, numbered from 1.
- `BillingIntervalValue` and `SubscriptionStatusValue` are the types `interval` and `status` take:
  the enum or its plain numbers, so another package's same-valued enum passes without a cast.
- `defaultPricingTableLabels`, `defaultPlanCardLabels` and `defaultUpgradePromptLabels` are the
  English words of each component; a translation replaces any of them through `labels`.

### ConfirmDialog (`./confirm-dialog`)

- `labelOr(label, fallback)` returns the trimmed label, or `fallback` when the label is missing or
  blank. It is how `ConfirmDialog` resolves its button labels, and a host app can resolve its own
  translated strings the same way.
- `CONFIRM_LABEL` (`"Confirm"`) and `CANCEL_LABEL` (`"Cancel"`) are the English defaults for the
  confirming and cancelling actions.
- `confirmVariant(tone)` maps a dialog's tone to its confirm button's variant: `"danger"` for a
  destructive decision, `"primary"` otherwise. Use it to give the button that opens the dialog the
  same variant.
- `hasQuestion(body)` is exported for the package's own components and tests: it decides whether the
  dialog's body has content to point `aria-describedby` at, looking through lists and fragments for
  anything that renders.

### Modal (`./modal`)

- `backdropDismissesByDefault` is `true`: a click on the backdrop dismisses a `Modal` whose
  `closeOnBackdrop` is left out.
- `isBackdropClick({ target, dialog }, rect, x, y)` answers whether a click landed on a modal
  `<dialog>`'s backdrop: the target is the dialog itself and the point lies outside its rect.
  `backdropClickDismisses(event, rect, dialog, closeOnBackdrop)` applies the caller's policy first
  and then asks the same question. Use them for a dialog you build yourself.
- `supportsClosedBy(dialogPrototype)` answers whether a dialog implementation knows the `closedby`
  attribute. Pass `HTMLDialogElement.prototype`; no shipping WebKit does.
- `clientWidthWithoutScrollbar(host)`, `scrollLockPadding(before, locked)` and
  `applyScrollLock(document, padding)` are the scroll lock in three steps: measure the layout width
  with the scrollbar hidden, turn the two widths into the right padding that keeps the page from
  shifting, then lock scrolling and get back a `release()` that restores the previous inline styles.
  Use them to lock the page behind an overlay of your own.
- `DISMISS_KEY` (`"Escape"`), `isDismissKey(event, open)`, `escapeCloseStrategy(closedBySupported)`,
  `bindEscapeClose(target, strategy, handlers)` and `platformCloseHandler(deps)` are exported for
  the package's own components and tests: they decide which event carries Escape on a platform and
  wire the matching listener.
- `dialogHeldFocus(dialog, activeElement)` answers whether focus is inside the dialog, given
  `document.activeElement`; `null` gives `false`. Call it at close time to report or assert where
  focus was. `Modal` itself does not use it to decide where focus goes back to.
- `dialogTitleId(base)` is exported for the package's own components and tests: the id of the
  dialog's title element.

### Combobox (`./combobox`)

- `fold(value)` folds text for searching: accents are removed and the text is lower-cased, so
  `"São"` and `"sao"` fold alike, whatever the host locale.
- `matchesQuery(item, query, getLabel)` answers whether an item's folded text contains the folded,
  trimmed query; an empty query matches everything. `filterItems(items, query, getLabel)` keeps the
  matching items in their original order. Use them to filter a list the way `Combobox` does.
- `defaultGetLabel(item)` is `String(item)`, the text rule `Combobox` uses when no `getLabel` is
  given; a `getLabel` of your own can fall back to it.
- `comboboxKey(event)` maps a keyboard event to a key the combobox acts on, or `undefined` for one
  it leaves alone. `nextComboboxState(state, key, count)` says what that key does to the highlight
  and the open state, wrapping at both ends, and `comboboxKeyAction(key, state, count)` adds whether
  to call `preventDefault()` and which option `Enter` selects. Together they are the whole keyboard
  table, for a search field that should behave like a `Combobox`; the guide's own search uses them.
- `typingState`, `openingState`, `selectableIndex`, `listboxContent`, `leavesCombobox`, `naming`,
  `activeDescendant`, `comboboxListboxId` and `comboboxOptionId` are exported for the package's own
  components and tests: the highlight a new query or a fresh open starts on, the empty message,
  when a focus change closes the popup, which prop names the input, and the ids the ARIA
  attributes point at.

### DateRangePicker (`./date-range`)

- `dateRangePresets` lists every date preset in its presentation order: the single days and rolling
  day counts (`"today"` to `"last-90-days"`), then `"last-12-months"`, then the calendar periods
  (`"this-month"` to `"last-year"`), then `"custom"`. `timeRangePresets` lists the two time presets,
  `"last-hour"` then `"last-24-hours"`. They carry no labels: build a picker's option list from them
  and word each option yourself.

### Dropdown (`./dropdown`)

- `nextMenuIndex(key, current, count)` is the menu's arrow-key map: the index focus moves to for
  `ArrowDown`, `ArrowUp`, `Home` or `End`, wrapping at both ends, or `undefined` for any other key
  and for an empty menu.

### EnhancedForm (`./enhanced-form`)

- `enhancedFormMessage(status, labels)` is exported for the package's own components and tests: the
  live region's text for each status, and `""` while idle.

### Field (`./field`)

- `labelTarget(labelFor, id)` is exported for the package's own components and tests: the `for`
  value of a `Field`'s label, and it throws on a `labelFor` that is neither a boolean nor a
  non-empty id.

### FileInput (`./file-input`)

- `matchesAccept(file, accept)` answers whether a file matches an `accept` list of extensions
  (`.png`), MIME types (`image/png`) and MIME wildcards (`image/*`), ignoring case; an empty list
  matches everything. Use it to check a dropped file the way the browser's chooser would.
- `classifyFiles(selected, { accept, maxSize, multiple })` splits offered files into the ones a
  `FileInput` keeps and the ones it refuses, each refusal with its reason: `"too-large"`,
  `"wrong-type"` or, without `multiple`, `"too-many"` for every accepted file after the first.
- `resolveLabels(labels)` is exported for the package's own components and tests: it fills every
  message label a `FileInput` was not given with its English default.

### ImageGallery (`./image-gallery`)

- `thumbnailKey(images, index)` is exported for the package's own components and tests: a
  thumbnail's render key, its `src` plus how many times that `src` appeared earlier in the list.
- `stripPosition(scroll)` is exported for the package's own components and tests: the slide a
  strip's counter names for where its row has scrolled to, the first at the start, the last at the
  end, and the nearest in between.
- `stripNavigationClasses(variant)` is the full class list of the strip's Previous/Next buttons for
  a `navigationVariant` (`StripNavigationVariant`, `"outline"` by default). An app that lists the
  classes this library renders, for its stylesheet or a test that each one has a rule, imports it
  instead of copying the string.

### Lightbox (`./lightbox`)

- `wrapIndex(index, total, delta)` moves `delta` steps through `total` items and wraps at either
  end; a `total` of `0` or less answers `0`.
- `counterText(position, total)` is the counter's English default, `"3 of 8"`; the `counterLabel`
  prop replaces it.

### MoneyInput (`./money-input`)

- `editableText(value, currency, locale)` formats an amount in the currency's smallest unit as the
  text a person edits: digits and the decimal mark of `locale`, the currency's number of decimals,
  no symbol and no grouping. `null` gives `""`.
- `resolveMoneyInputEdit(text, currency, locale, bounds, invalidMessage, rangeMessage)` is exported
  for the package's own components and tests: the value and message one edit of a `MoneyInput`
  produces.

### Link (`./link`)

- `isPlainClick(event)` says whether a click is one the page may take over: the primary button
  with no Ctrl, Meta, Shift or Alt. A middle click never counts. It is the same rule `Shell` applies.
- `followLinkClick(event, { href, navigate, target, download })` is the rule `Link` runs on every
  click: when `navigate` is given, the click is plain, nothing earlier cancelled it, `target` is
  none, `""` or `_self`, and there is no `download`, it cancels the browser's navigation, calls
  `navigate(href)` and returns `true`; otherwise it does nothing and returns `false`. Call it from
  the click handler of an anchor of your own — a button drawn as a link, say — to give it the same
  behaviour.

### Pagination (`./pagination`)

- `pageRange(page, pageCount, size)` collapses a page range into the items a pagination control
  renders: `{ page }` for a number and `{ gap: "gap" }` for a `…`. A range of up to `size` pages
  (default `7`) is listed in full; a longer one keeps the first page, the last page and the current
  page with its neighbours. A `size` below `5` counts as `5`. Use it to draw pagination in markup of
  your own.

### Progress (`./progress`)

- `clampProgress(value, max)` clamps a reading into `0…max` (`max` defaults to `100`) and returns it
  with its fraction of `max`; both are `null` when the reading cannot be measured (a missing or
  `NaN` value, or a `max` that is not a finite number above `0`).
- `progressWidthPercent(fraction)` turns a fraction into a percentage to one decimal place, fit for
  `width: <n>%`; `null` gives `0`.
- `formatProgressPercent(fraction)` formats a fraction as a whole percentage for display, rounded
  down so a bar that is not full never reads `100%`.

### UnsavedGuard (`./unsaved-guard`)

- `guardedHref(click, link, here, owns)` is the rule `UnsavedGuard` applies to a click: the in-app
  address to hold back, as path, query and hash, or `null` when the browser or the link should
  handle the click. `UnsavedClick` and `UnsavedLink` are the fields it reads.
- `defaultUnsavedGuardLabels` holds the dialog's English words; `labels` replaces any of them.

## Tests

`deno task test` from the repo root. Tests render each component with
`preact-render-to-string` and assert on the real markup: palette selection, variant swap, utility
merge order, `aria` wiring, null returns and prop passthrough. `preact-render-to-string` is pinned
in this package's `deno.json` because the root import map has no renderer.

## Not in this package

`MetricsList` and the higher-level selectors (`CurrencySelector`, `DateRangeSelector`,
`AccountSelector`) stay app-side for now — `MetricsList` is theme-coupled and belongs with the
charts work. `DeletionValidation` belongs with the CRUD package. `DateTimeFilter`'s time-of-day
mode is `DateRangePicker`'s `withTime` option (#142); nothing app-side answering to that name is
extracted here.

Removed in #352 because another component already covers each one: `CiStatusPill` (a `Badge` with a
colour per status), `ConfidenceMeter` (`Progress`), `FactCard` (`Card` around a `<dl>`),
`GeoButton` (a `Button` whose `onClick` calls `requestGeolocation` from
`@spy4x/platform/browser/geolocation`),
`ExportButton` (a `Button` that calls `@spy4x/platform`'s CSV writer and download helper),
`NewsletterForm` and `ContactForm` (`EnhancedForm` with `Field`, `Input` and `Button`),
`SkeletonText`, `SkeletonTable`, `SkeletonCards` and `SkeletonStatus` (`LoadingSkeleton`),
`LoadingScreen` (`LoadingSpinner` with its `label`, centred), and vertical `Tabs`. `MarginNote` went
because only one site's articles used it. #420 asked for `LoadingScreen` back for an app's first
load; that need is met by the `LoadingSpinner` recipe above rather than by a second name for it.

`InstallBox`, `CopyableText` and `CopyableTextBody` became one component, `CopyBlock`, in #353: each
was a box of text with a `CopyButton` beside it. `CopyBlock` never clips its text: it wraps inside
the box, or, with `singleLine`, scrolls sideways inside it. This is a breaking change:

- `InstallBox`'s `command` is `CopyBlock`'s `text`. Its button label defaulted to "Copy command";
  `CopyBlock`'s defaults to "Copy", so pass `copyLabel="Copy command"` to keep it.
- `CopyableText`'s `text`, `copy`, `copyLabel`, `copiedLabel`, `copiedForMs` and `class` keep their
  names. `truncate` and `title` are gone: the text is never cut off, so there is nothing to reveal.
- `CopyableText` sat inline; `CopyBlock` is a block. For a value inside a sentence, use
  `singleLine` or a plain `CopyButton`.
- The `./install-box` and `./copyable-text` subpaths are gone; import from `./copy-block`.
