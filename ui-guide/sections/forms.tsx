/**
 * The form chapter: the classes `theme/preset.css` styles and no component wraps.
 *
 * Every control below is a native element with the preset's class on it. That is the point of the
 * chapter — `ui/` deliberately ships no `Input`/`Select` wrapper, so the guide's job here is to show
 * what the stylesheet already does rather than to invent a second API for `<input>`. The controlled
 * cards are controlled the way an app controls them: `value` in, `onInput` out, the draft owned by
 * the card and nothing global.
 *
 * A card's `classes` list is rendered as chips and checked against the card's own markup by
 * `classes.test.tsx`, so a chip cannot name a class the card does not apply.
 */

import { IconSearch } from "@spy4x/preact-icons"
import { Grid, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import type { ClassDemoFragment } from "../registry.ts"

/** Controlled: `value` in, `onInput` out, and the live value printed under the control. */
function InputDemo() {
  const email = useSignal("")

  return (
    <Stack gap="sm" class="max-w-sm">
      <label class="label" for="guide-input-email">Email</label>
      <input
        id="guide-input-email"
        class="input"
        type="email"
        name="guide-input-email"
        placeholder="you@example.com"
        value={email.value}
        onInput={(event) => email.value = event.currentTarget.value}
      />
      <input
        class="input"
        name="guide-input-disabled"
        placeholder="Disabled"
        aria-label="Disabled input"
        disabled
      />
      <p class="text-xs text-muted" data-e2e="controlled-value">
        email: {email.value || "(empty)"}
      </p>
    </Stack>
  )
}

/** `options` as data; the selection comes from `value`, so a signal is the whole state. */
function SelectDemo() {
  const role = useSignal("editor")

  return (
    <Stack gap="sm" class="max-w-sm">
      <label class="label" for="guide-select-role">Role</label>
      <select
        id="guide-select-role"
        class="select"
        name="guide-select-role"
        value={role.value}
        onChange={(event) => role.value = event.currentTarget.value}
      >
        <option value="admin">Administrator</option>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <select class="select" aria-label="Disabled select" disabled>
        <option>Disabled</option>
      </select>
      <p class="text-xs text-muted" data-e2e="controlled-value">role: {role.value}</p>
    </Stack>
  )
}

/** The multi-line control: `.textarea` is `.input` plus a floor height and inner padding. */
function TextareaDemo() {
  const notes = useSignal("Runs the night shift.\nKeeps the pager.")

  return (
    <Stack gap="sm" class="max-w-sm">
      <label class="label" for="guide-textarea-notes">Notes</label>
      <textarea
        id="guide-textarea-notes"
        class="textarea"
        name="guide-textarea-notes"
        rows={3}
        placeholder="Anything the next person should know"
        value={notes.value}
        onInput={(event) => notes.value = event.currentTarget.value}
      />
      <p class="text-xs text-muted" data-e2e="controlled-value">
        {notes.value.split("\n").length} lines
      </p>
    </Stack>
  )
}

/**
 * The two label placements and the three states that go with them.
 *
 * `.label` is one class either way: above the control for a stacked field, below it when the value
 * matters more than the name. The required marker, the hint and the error are text with
 * `.text-danger`/`.text-muted` — the preset ships no `[aria-invalid]` styling, so colour plus
 * `aria-describedby` is what carries the state to both a reader and a screen reader.
 */
function LabelDemo() {
  const name = useSignal("")
  const archived = useSignal(true)
  const invalid = name.value.length > 0 && name.value.trim().length < 3

  return (
    <Grid gap="lg" minColumnWidth="md">
      <Stack gap="sm">
        <label class="label" for="guide-label-name">
          Name <span class="text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="guide-label-name"
          class="input"
          aria-required="true"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "guide-label-name-error" : "guide-label-name-hint"}
          value={name.value}
          onInput={(event) => name.value = event.currentTarget.value}
        />
        {invalid
          ? (
            <p id="guide-label-name-error" class="text-xs text-danger">
              At least three characters.
            </p>
          )
          : (
            <p id="guide-label-name-hint" class="text-xs text-muted">
              Full name, as on the contract.
            </p>
          )}
      </Stack>

      <Stack gap="sm">
        <input id="guide-label-suffix" class="input" value="Ref 2024-0917" />
        <label class="label" for="guide-label-suffix">Reference, label under the control</label>
      </Stack>

      <Stack gap="sm">
        <input id="guide-label-disabled" class="input" value="Locked" disabled />
        <label class="label text-muted" for="guide-label-disabled">Disabled field</label>
      </Stack>

      <Stack gap="sm">
        <label class="label" for="guide-label-archived">
          <input
            id="guide-label-archived"
            class="checkbox"
            type="checkbox"
            checked={archived.value}
            onChange={(event) => archived.value = event.currentTarget.checked}
          />
          Archived, through a suffix label
        </label>
      </Stack>
    </Grid>
  )
}

/** The box before the text: one hit area, because the label wraps the control. */
function CheckboxDemo() {
  const archived = useSignal(false)
  const notify = useSignal(true)

  return (
    <Stack gap="sm" class="max-w-sm">
      <label class="label" for="guide-checkbox-archived">
        <input
          id="guide-checkbox-archived"
          class="checkbox"
          type="checkbox"
          name="guide-checkbox-archived"
          checked={archived.value}
          onChange={(event) => archived.value = event.currentTarget.checked}
        />
        Show archived rows
      </label>
      <label class="label" for="guide-checkbox-notify">
        <input
          id="guide-checkbox-notify"
          class="checkbox"
          type="checkbox"
          name="guide-checkbox-notify"
          checked={notify.value}
          onChange={(event) => notify.value = event.currentTarget.checked}
        />
        Email me about it
      </label>
      <label class="label" for="guide-checkbox-disabled">
        <input id="guide-checkbox-disabled" class="checkbox" type="checkbox" disabled />
        Disabled
      </label>
      <p class="text-xs text-muted" data-e2e="controlled-value">
        archived: {archived.value ? "on" : "off"} · email: {notify.value ? "on" : "off"}
      </p>
    </Stack>
  )
}

/** Radios sharing one `name`, in a `fieldset` so the legend names the group for assistive tech. */
function RadioDemo() {
  const channel = useSignal("email")

  return (
    <Stack gap="sm" class="max-w-sm">
      <Stack as="fieldset" gap="sm">
        <legend class="label">Notification method</legend>
        {[
          { value: "email", label: "Email" },
          { value: "sms", label: "Phone (SMS)" },
          { value: "push", label: "Push notification" },
        ].map((option) => (
          <label key={option.value} class="label" for={`guide-radio-${option.value}`}>
            <input
              id={`guide-radio-${option.value}`}
              class="radio"
              type="radio"
              name="guide-radio-channel"
              value={option.value}
              checked={channel.value === option.value}
              onChange={() =>
                channel.value = option.value}
            />
            {option.label}
          </label>
        ))}
      </Stack>
      <p class="text-xs text-muted" data-e2e="controlled-value">channel: {channel.value}</p>
    </Stack>
  )
}

/**
 * The `.btn-input-icon` pattern: a `.input` with a button positioned inside its right edge.
 *
 * The utilities around it are the layout the pattern needs — `.btn-input-icon` styles the button,
 * `.input` styles the field, and the reserved right padding is what keeps the typed text out from
 * under the button.
 */
function InputButtonDemo() {
  const query = useSignal("")

  return (
    <Stack gap="sm" class="max-w-sm">
      <div class="relative">
        <input
          class="input pr-12"
          type="search"
          name="guide-input-button"
          placeholder="Search users"
          aria-label="Search users"
          value={query.value}
          onInput={(event) => query.value = event.currentTarget.value}
        />
        <button
          class="btn-input-icon absolute inset-y-0 right-1.5 my-auto"
          type="button"
          title="Search"
          aria-label="Search"
          onClick={() => query.value = ""}
        >
          <IconSearch class="size-4" />
        </button>
      </div>
      <p class="text-xs text-muted" data-e2e="controlled-value">
        query: {query.value || "(empty)"}
      </p>
    </Stack>
  )
}

export const formDemos = {
  "class-input": {
    title: "Input",
    classes: ["input", "label", "text-muted"],
    summary: "Styles a native text field, so a form needs no input component.",
    wide: false,
    snippet: `<input
  class="input"
  type="email"
  placeholder="you@example.com"
  value={email.value}
  onInput={(event) => email.value = event.currentTarget.value}
/>`,
    render: () => <InputDemo />,
  },
  "class-select": {
    title: "Select",
    classes: ["select", "label", "text-muted"],
    summary: "Styles a native drop-down to match the text field beside it.",
    wide: false,
    snippet:
      `<select class="select" value={role.value} onChange={(event) => role.value = event.currentTarget.value}>
  <option value="admin">Administrator</option>
  <option value="editor">Editor</option>
</select>`,
    render: () => <SelectDemo />,
  },
  "class-textarea": {
    title: "Textarea",
    classes: ["textarea", "label", "text-muted"],
    summary:
      "Styles a native multi-line field, with a floor height so a short note still looks deliberate.",
    wide: false,
    snippet: `<textarea
  class="textarea"
  rows={3}
  placeholder="Anything the next person should know"
  value={notes.value}
  onInput={(event) => notes.value = event.currentTarget.value}
/>`,
    render: () => <TextareaDemo />,
  },
  "class-input-button": {
    title: "Input with an inline button",
    classes: ["btn-input-icon", "input", "text-muted"],
    summary:
      "Puts a small square button, such as search or clear, inside the right edge of a text field.",
    wide: false,
    snippet: `<div class="relative">
  <input class="input pr-12" type="search" placeholder="Search users" />
  <button class="btn-input-icon absolute inset-y-0 right-1.5 my-auto" type="button" aria-label="Search">
    <IconSearch class="size-4" />
  </button>
</div>`,
    render: () => <InputButtonDemo />,
  },
  "class-checkbox": {
    title: "Checkbox",
    classes: ["checkbox", "label", "text-muted"],
    summary:
      "Styles a native checkbox, with its label wrapped around it so the text is part of the hit area.",
    wide: false,
    snippet: `<label class="label" for="archived">
  <input
    id="archived"
    class="checkbox"
    type="checkbox"
    checked={archived.value}
    onChange={(event) => archived.value = event.currentTarget.checked}
  />
  Show archived rows
</label>`,
    render: () => <CheckboxDemo />,
  },
  "class-radio": {
    title: "Radio",
    classes: ["radio", "label", "text-muted"],
    summary:
      "Styles native radio buttons, grouped in a `fieldset` whose `legend` names the choice.",
    wide: false,
    snippet: `<fieldset>
  <legend class="label">Notification method</legend>
  <label class="label" for="sms">
    <input id="sms" class="radio" type="radio" name="channel" value="sms"
      checked={channel.value === "sms"}
      onChange={() => channel.value = "sms"} />
    Phone (SMS)
  </label>
</fieldset>`,
    render: () => <RadioDemo />,
  },
  "class-label": {
    title: "Labels and their placement",
    classes: ["label", "input", "checkbox", "text-muted", "text-danger"],
    summary:
      "Names a field from above it or below it, with a required marker, a hint and an error shown as plain text.",
    wide: true,
    snippet: `<div class="grid gap-2">
  <label class="label" for="name">Name <span class="text-danger">*</span></label>
  <input id="name" class="input" aria-describedby="name-hint" value={name.value} />
  <p id="name-hint" class="text-xs text-muted">As it appears on the contract.</p>
</div>

<!-- the suffix placement: the label follows the control -->
<input id="ref" class="input" value="Ref 2024-0917" />
<label class="label" for="ref">Reference</label>`,
    render: () => <LabelDemo />,
  },
} satisfies ClassDemoFragment
