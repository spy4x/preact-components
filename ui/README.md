# `@spy4x/preact-ui`

Preact + Tailwind primitives extracted from earlier source applications.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton. App
  state arrives as props; side effects (clipboard, geolocation, toasts) arrive as callbacks.
- **Tailwind classes, rendered against the theme.** Components write Tailwind utilities and the
  theme's class names (`input`, `btn-input-icon`), so a page needs `theme/`'s stylesheet; a few
  glyphs come from `@spy4x/preact-icons`.
- **Server-renderable.** `document`, `navigator` and timers are touched inside effects or event
  handlers only.
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

| Component         | Subpath             | Ports / key props                                                                                                                                                     |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Avatar`          | `avatar`            | `name`, `src`, `alt`, `size`                                                                                                                                          |
| `AvatarGroup`     | `avatar`            | `items`, `max`, `label`, `size` (a `role="group"`, not a list)                                                                                                        |
| `Badge`           | `badge`             | `text`, `color`, `type`                                                                                                                                               |
| `Button`          | `button`            | `variant`, `size`, native button attrs                                                                                                                                |
| `Card`            | `card`              | `children`, `class` — a bordered surface                                                                                                                              |
| `CardBody`        | `card`              | `children`, `class`                                                                                                                                                   |
| `CardFooter`      | `card`              | `children`, `class`                                                                                                                                                   |
| `CardHeader`      | `card`              | `title` and `action`, or `children`; `class`                                                                                                                          |
| `Checkbox`        | `checkbox`          | `children` (the label), `labelClass`, native checkbox attrs; forwards `ref`                                                                                           |
| `Cluster`         | `layout`            | `gap?` (default `sm`), `align?`, `justify?`, `as?`, `class?` — a wrapping row                                                                                         |
| `Combobox`        | `combobox`          | `items`, `value`, `onChange`, `getLabel?`, `filter?`, `ariaLabel?`, `aria-labelledby?`, `id?`                                                                         |
| `ConfirmDialog`   | `confirm-dialog`    | `title`, `message?`, `onConfirm`, `onCancel`, `confirmLabel?`, `cancelLabel?`, `tone?`                                                                                |
| `CopyBlock`       | `copy-block`        | `text`, `singleLine?`, `copy?` (clipboard port), `copyLabel?`, `copiedLabel?` — built on `CopyButton`                                                                 |
| `CopyButton`      | `copy-button`       | `textToCopy`, `copy?` (clipboard port)                                                                                                                                |
| `DataTable`       | `data-table`        | `columns`, `rows`, `rowKey`, `sort`, `onSortChange`, `caption`, `captionHidden?`, `empty?`, `paging?`, `rowDataE2E?`, `class?`                                        |
| `DateRangePicker` | `date-range-picker` | `range`, `onChange`, `timeZone`, `presets` or `withTime`, `labels?` (every key optional)                                                                              |
| `Dropdown`        | `dropdown`          | `trigger`, `triggerLabel` or `triggerNamedByContent` (one is required), `menuLabel`, `vertical`, `horizontal`                                                         |
| `DropdownItem`    | `dropdown`          | `href`, `onClick`, `disabled`, `danger`, `class` — a `role="menuitem"`, out of the tab order                                                                          |
| `EmptyState`      | `empty-state`       | `icon?`, `title?`, `description?`, `action?`                                                                                                                          |
| `EnhancedForm`    | `enhanced-form`     | `action?`, `method?`, `onSubmit?`, `sending?`/`done?`/`failed?` slots, `labels?` — posts natively before hydration                                                    |
| `ErrorState`      | `error-state`       | `message` (renders nothing when empty)                                                                                                                                |
| `Field`           | `field`             | `id`, `label?`, `children`, `hint?`, `error?`, `required?`, `suffix?`                                                                                                 |
| `FileInput`       | `file-input`        | `id`, `accept?`, `multiple?`, `maxSize?`, `name?`, `onFiles?`, `onReject?`, `label?`, `error?`, `previews?`, `labels?`                                                |
| `Grid`            | `layout`            | `gap?` (default `md`), `minColumnWidth?` (`sm`/`md`/`lg`), `as?`, `class?` — equal columns that fill the row                                                          |
| `ImageGallery`    | `image-gallery`     | `images` (`{ src, alt, thumbSrc? }[]`), `label?`, `closeLabel?`, `previousLabel?`, `nextLabel?`, `counterLabel?`                                                      |
| `Input`           | `input`             | native input attrs, `class`; forwards `ref`                                                                                                                           |
| `InputButton`     | `input-button`      | `icon`, `iconLabel`, `onClick?`, native input attrs                                                                                                                   |
| `Lightbox`        | `lightbox`          | `images`, `index`, `open`, `onClose`, `onIndexChange`, `closeLabel?`, `previousLabel?`, `nextLabel?`, `counterLabel?`                                                 |
| `LoadingSkeleton` | `loading-skeleton`  | `rows`                                                                                                                                                                |
| `LoadingSpinner`  | `loading-spinner`   | `label`, `size`                                                                                                                                                       |
| `Modal`           | `modal`             | `open?` or `defaultOpen?`, `onClose?`, `title?` or `ariaLabel?`, `children`, `footer?`, `cancelLabel?`                                                                |
| `MoneyDisplay`    | `money-display`     | `amount` (smallest unit), `currency`, `locale?`, `colorNegative?`, `class?`                                                                                           |
| `MoneyInput`      | `money-input`       | `value` (smallest unit or `null`), `onChange`, `currency`, `locale?`, `min?`, `max?`, `name?`, `id?`, `invalidMessage?`, `rangeMessage?`                              |
| `OnOffButtons`    | `on-off-buttons`    | `value`, `amount`, `onSwitch`                                                                                                                                         |
| `Page`            | `layout`            | `as?`, `class?` — the content column: max width, page gutter, `xl` between sections                                                                                   |
| `PageTitle`       | `page-title`        | `children`, `class`                                                                                                                                                   |
| `Pagination`      | `pagination`        | `page`, `pageCount`, `onChange`, `label`, `previousLabel`, `nextLabel`, `pageLabel`                                                                                   |
| `Progress`        | `progress`          | `value`, `max`, `label`, `id` (a caption needs an `id`)                                                                                                               |
| `Radio`           | `radio`             | `children` (the label), `labelClass`, native radio attrs; forwards `ref`                                                                                              |
| `RadioGroup`      | `radio`             | `legend`, `name`, `options`, `value?`, `onChange?`                                                                                                                    |
| `Section`         | `layout`            | `title?`, `description?`, `headingLevel?` (2–4), `as?` (`section`/`article`/`aside`/`div`), `class?`                                                                  |
| `Select`          | `input`             | `options`, `placeholder?`, native select attrs                                                                                                                        |
| `Stack`           | `layout`            | `gap?` (default `md`), `as?`, `class?` — a column                                                                                                                     |
| `StatusMark`      | `status-mark`       | `status` (`ready`/`beta`/`wip`/`paused`/`archived`/`known-issue`), `label?` — a sibling of `Badge`, not an extension of it: `Badge` is colour-plus-text with no shape |
| `Table`           | `table`             | `headerSlot`, `bodySlots`, `footerSlot`, `caption?`, `captionClass?`, `rowDataE2E`                                                                                    |
| `Tabs`            | `tabs`              | `tabs`, `active`, `onChange`, `lazy`                                                                                                                                  |
| `Textarea`        | `input`             | native textarea attrs, `class`                                                                                                                                        |
| `Toastr`          | `toastr`            | `toasts`, `onDismiss`, `label`, `dismissLabel`, `dataE2E`                                                                                                             |
| `ToggleField`     | `toggle-field`      | `id`, `label`, `value`, `onToggle`, `description?`, `error?`                                                                                                          |
| `ToggleSwitch`    | `toggle-switch`     | `value`, `onToggle`, `disabled`, `label`                                                                                                                              |
| `Tooltip`         | `tooltip`           | `content`, `label`, `placement`, `focusable`                                                                                                                          |
| `ZoomableImages`  | `zoomable-images`   | `containerSelector?`, `imageSelector?`, `fallbackAlt?`, `zoomLabel?`, `previousLabel?`, `nextLabel?`, `onOpen?`                                                       |

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

<Toastr toasts={app.toast.list.value} onDismiss={(id) => app.toast.remove(String(id))} />

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

`Toastr` auto-dismisses each toast after `toast.duration` milliseconds (default
`defaultToastDuration`, which is 5000; `0` keeps it until dismissed) and reports it through
`onDismiss` — the caller owns the stack. `createToastStore` in `@spy4x/preact-signals` writes
that same `duration` field, so the wiring above needs no adapter; `String(id)` is there because
`ToastItem.id` is `string | number` and that store's ids are strings.

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
  onDismiss={(id) => app.toast.remove(String(id))}
  label="Benachrichtigungen"
  dismissLabel="Ausblenden"
/>
```

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
(`"No matches"`), `countMessage` (`"1 match"` / `"12 matches"`) and `clearLabel`
(`"Clear selection"`).

**One live region, rendered with the field and never taken away.** Every combobox renders a single
`role="status"` element with `aria-live="polite"` and `aria-atomic="true"` on every render, the
server render included, and it is empty until the field has been used. Answers are put into it and
taken out of it; it is never created along with one. This is the library-wide rule that `Toastr`
here and `SWUpdater` in `system/` also follow, and the reason is the same in all three: assistive
technology announces a _change_ to a region it is already watching, and commonly says nothing at all
about a region that arrives with its message already inside it.

**What goes into it, and when.** Two answers, and neither is given before it is asked:

| The field                                    | What the region holds |
| -------------------------------------------- | --------------------- |
| rendered, never opened, never typed in       | nothing               |
| opened, no query                             | nothing               |
| a query, and options left                    | `countMessage(count)` |
| a query — or an open list — and nothing left | `emptyMessage`        |

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
`now` or read inside a click handler, never during render.

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

A close driven from **outside** it does not, and there are two. A click outside leaves focus on
whatever was clicked, because the person has just put it there deliberately. And Escape is a return
only when focus was still inside the component as the key was pressed: a Tab out leaves the panel
open behind you, so Escape can arrive from somewhere the person has since walked to, and pulling
them back there would be one more way to lose their place rather than a way to keep it.

Focus merely _leaving_ the panel is not a close at all here. A Tab out leaves it open, which is the
one dismissal path this component does not have — and is also what makes the Escape-from-outside
case above reachable.

All seven of those close paths are driven in a real browser in `pages/checks/ui.ts` — the five that
return focus and the two that must not — and so is the move that opens the panel.

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
  onChange={(next) => range.value = next}
  timeZone="Europe/Berlin"
/>
```

`rangeForTimePreset` and `presetForTimeRange`, in `date-range.ts`, are the two presets' own maths —
plain functions of an injected `now` and `timeZone`, the same convention `rangeForPreset` and
`presetForRange` follow. Both subtract a fixed number of _real_ milliseconds from `now` before
reading the wall clock: `"last-hour"` is always exactly one real hour before `now`, `"last-24-hours"`
always exactly twenty-four, whatever that prints as. Read only as the two strings this library hands
back, both stay right on the two days a year a zone's clocks change — the _printed_ wall-clock span
reads as 23 or 25 hours on that day rather than the subtraction drifting to match a misleading
24-hour-looking one.

That correctness is in the strings only, and does not survive a caller converting them back into
instants — the ordinary next step for querying a database with them. On the day a zone falls back, a
`from` or `to` can name the hour that happens twice, and the standard conversion of it — the earlier
of its two instants, what most date libraries default to — reads a preset wrong by one hour for every
real hour one of its ends spends inside that repeated hour. `"last-24-hours"`'s two ends are 24 real
hours apart, wider than the roughly two real hours the repeated hour spans across both of its passes,
so at most one end ever lands there: the round trip reads 23 or 25 hours, not 24, depending which end
it is and which pass. `"last-hour"`'s ends are only a real hour apart, so both can land there at once,
and the round trip then reads one of three ways: the ordinary 1 hour when neither end does; 0 hours
when both do, because `from` and `to` then print the identical `YYYY-MM-DDTHH:mm` string — one
wall-clock reading, taken at two different UTC offsets either side of the fall-back — and a standard
conversion reads that pair as the same instant; and 2 hours when only `from` does, landing in the
hour's second pass while `to` has already moved past it and reads correctly on its own. Neither this
library nor `isValidDateTimeRange` resolves or rejects any of this: a range whose ends read
identically is `from <= to`, the same rule a one-day `DateRange` passes by design, and a typed value
naming the hour a zone skips in spring — a local time that never happens that day — is accepted the
same way, because nothing here is told which zone a value is meant for and checks accordingly.
`rangeForTimePreset`'s own doc in `date-range.ts` names the instant behind the 0- and 2-hour
`"last-hour"` outcomes, and `date-range.test.ts` pins both, plus a 23- and a 25-hour
`"last-24-hours"` case, each with the duration a standard conversion reads back.

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

`Table`'s markup joined to `@spy4x/preact-signals/table-state`'s sort rules: a sortable,
optionally paged table with no sort state of its own.

```tsx
import { DataTable } from "@spy4x/preact-ui/data-table"
import type { SortRule } from "@spy4x/preact-signals/table-state"

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

**`DataTable` sorts and pages client-side only.** `rows` has to be the complete, unsorted set:
`sortRows` runs its own collation over every row it is given, including rows a server already
sorted, and there is no way to hand this component a `pageCount` for a page it cannot see the rest
of — passing one page's worth of rows with `paging.page: 2` renders that page's rows on what looks
like page 1, because `DataTable` has no way to know there were more before them. A mode that skips
`sortRows` and takes a caller-supplied `pageCount` instead is tracked in
[#235](https://github.com/spy4x/preact-components/issues/235) rather than built here.

**Every sortable header is a real `<button>`**, so Tab, Space and Enter all reach it —
`pages/checks/ui.ts` proves the click and Space paths for this header, and a real Enter press
activating a focused native button is proven once, for `Dropdown` and `Modal`, rather than
per component. Pressing it calls `toggleSort`, which cycles that column through
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

**`rowKey` stamps `data-row-key` on each row's first cell**, exported as `rowKeyAttribute`.
`Table` keys its own `<tr>`s by array position, not by a caller-supplied identity — extending that
is `Table`'s own change to make, tracked as a follow-up
([#234](https://github.com/spy4x/preact-components/issues/234)) rather than built here — so a sort
or a page turn that reorders rows gives Preact nothing to reconcile a row's identity against by
itself. Stamping the key on the DOM is what lets a page, or a browser check, point at a specific
row without depending on its rendered text.

**Paging is optional and minimal**: `page`, `pageSize` and `onChange`, mirroring `Pagination`'s own
prop names because most of them pass straight through to it. `DataTable` computes `pageCount` from
the full, sorted row count and slices the visible page itself; omit `paging` entirely for every row
on one page. `page` is clamped into `1…pageCount` the same way `Pagination` clamps its own, before
it is used for both the slice and the pager — a page a filter has shrunk past, or `0` or a negative
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

A form built on this can carry a honeypot from `honeypot`: `honeypotField` renders an off-screen
field simple bots fill in, `hp-field` by name (`HONEYPOT_FIELD_NAME`) and deliberately not a word a
browser's own autofill heuristics reach for, and `honeypotFilled(formData)` reads it back. A submit
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
`GeoButton` (a `Button` whose `onClick` calls `requestGeolocation` from `./geolocation`),
`ExportButton` (a `Button` that calls `@spy4x/platform`'s CSV writer and download helper),
`NewsletterForm` and `ContactForm` (`EnhancedForm` with `Field`, `Input` and `Button`),
`SkeletonText`, `SkeletonTable`, `SkeletonCards` and `SkeletonStatus` (`LoadingSkeleton`),
`LoadingScreen` (`LoadingSpinner` with its `label`, centred), and vertical `Tabs`. `MarginNote` went
because only one site's articles used it.

`InstallBox`, `CopyableText` and `CopyableTextBody` became one component, `CopyBlock`, in #353: each
was a box of text with a `CopyButton` beside it. `CopyBlock` never clips its text: it wraps inside
the box, or, with `singleLine`, scrolls sideways inside it.
