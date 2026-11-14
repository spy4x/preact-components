# Choose a component

Need → component → where to see it used. `ui/` is `@spy4x/preact-ui`, `system/` is
`@spy4x/preact-system`, `signals/` is `@spy4x/preact-signals`. The rules behind each choice are in
[design-rules.md](./design-rules.md); the full pattern table is "Component patterns" in
[design-language.md](./design-language.md#component-patterns).

## Shell

- A product app or its admin panel → `AppShell` (`system/app-shell.tsx`). Example:
  `ui-guide/sections/system.tsx`.
- A personal site with a labelled rail → `Rail` with `variant="labels"` (`system/rail.tsx`).
  Example: `ui-guide/sections/system.tsx`.
- A marketing site → `SiteHeader` and `SiteFooter` (`system/site-header.tsx`,
  `system/site-footer.tsx`). Example: `ui-guide/sections/system.tsx`.
- Not for new apps: `RailShell` (`system/rail-shell.tsx`) is the icons rail under its earlier name,
  kept until an app moves to `AppShell`. `Shell` (`system/shell.tsx`) draws a top bar and a
  sidebar, which the house app shell does not have.
- The server of a public website (routes, pages, islands, static files) → `@spy4x/preact-server`
  (`server/`). Example: `server/README.md`.

## Page

- The title, the primary action and "More actions" → `PageHeader` and `MoreMenu`
  (`ui/page-header.tsx`). Example: `ui-guide/sections/page-header.tsx`.
- Settings with sub-pages → `SettingsLayout` (`system/settings-layout.tsx`). Example:
  `ui-guide/sections/settings-layout.tsx`.
- Rows of settings → `SettingList`, `SettingRow` (`ui/setting-row.tsx`). Example:
  `ui-guide/sections/settings-layout.tsx`.
- One value edited in place → `InlineEdit` (`ui/inline-edit.tsx`). Example:
  `ui-guide/sections/fields.tsx`.

## Forms and fields

- A form → `EnhancedForm` (`ui/enhanced-form.tsx`). Example: `ui-guide/sections/enhanced-forms.tsx`.
- A labelled control with hint and error → `Field` (`ui/field.tsx`) around `Input`, `Textarea`
  or `Select` (`ui/input.tsx`). Example: `ui-guide/sections/fields.tsx`.
- A date and time → `DateTimeField` (`ui/date-time-field.tsx`). Example:
  `ui-guide/sections/fields.tsx`.
- A date or a range of dates → `DateRangePicker` (`ui/date-range-picker.tsx`). Example:
  `ui-guide/sections/inputs.tsx`.
- Several lines or tags → `ListField` (`ui/list-field.tsx`), `TagInput` (`ui/tag-input.tsx`).
  Example: `ui-guide/sections/fields.tsx`.
- A small whole number applied as it changes, with no Save button, such as how many at once (0
  can read "Off") → `NumberStepper` (`ui/number-stepper.tsx`). Example:
  `ui-guide/sections/inputs.tsx`.
- Pick one item from a long list, with search, groups or "Create" → `Combobox`
  (`ui/combobox.tsx`). Example: `ui-guide/sections/inputs.tsx`.
- Pick an icon, such as a category's → `IconPicker` (`ui/icon-picker.tsx`). Example:
  `ui-guide/sections/fields.tsx`.

## Dialogs, menus and messages

- Confirm before an action, such as a delete → `ConfirmDialog` (`ui/confirm-dialog.tsx`). Example:
  `ui-guide/sections/feedback.tsx`.
- A short form in a dialog → `Modal` (`ui/modal.tsx`) with `DialogActions`
  (`ui/dialog-actions.tsx`). Example: `ui-guide/sections/feedback.tsx`.
- How a page or a setting works, with worked examples, read and closed → `HelpPopover`
  (`ui/help-popover.tsx`); no JavaScript needed. A form or a decision is a `Modal`; one short hint
  on a control is a `Tooltip` (`ui/tooltip.tsx`). Example: `ui-guide/sections/feedback.tsx`.
- A menu of actions → `Dropdown` and `DropdownItem` (`ui/dropdown.tsx`). Example:
  `ui-guide/sections/crud.tsx`.
- A toast → `Toastr` (`ui/toastr.tsx`) fed by `createToastStore` (`signals/toast.ts`). Example:
  `ui-guide/mini-app.tsx`.

## Lists and states

- A table → `DataTable` (sortable columns; `ui/data-table.tsx`) or `Table` (plain;
  `ui/table.tsx`). Example: `ui-guide/sections/display.tsx`.
- Search and filters over a list → `FilterBar` (`ui/filter-bar.tsx`). Example:
  `ui-guide/sections/filter-bar.tsx`.
- A list a person reorders → `SortableList` (`ui/sortable-list.tsx`). Example:
  `ui-guide/sections/display.tsx`.
- Nothing to show yet → `EmptyState` (`ui/empty-state.tsx`). Example:
  `ui-guide/sections/feedback.tsx`.
- Loading → `LoadingSkeleton` (`ui/loading-skeleton.tsx`). Failed → `ErrorState`
  (`ui/error-state.tsx`). Example: `ui-guide/sections/feedback.tsx`.
- One item of a queue to answer (a decision, a question, a to-do) → `DecisionCard`
  (`ui/decision-card.tsx`). Example: `ui-guide/sections/decision-card.tsx`.
- A record's details → `FactList` (`ui/fact-list.tsx`). Example:
  `ui-guide/sections/content-blocks.tsx`.
