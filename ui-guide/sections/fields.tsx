/**
 * The `ui/` field primitives: one demo per component, keyed by the export the package publishes.
 *
 * Adapted from the section the `ui/` form-primitive PR wrote and dropped, because `ui-guide/` was
 * outside its scope. The per-component summaries are that PR's own contract notes, kept rather than
 * rewritten; what changed here is the registry shape (a `DemoFragment` of cards), and
 * the demos themselves, which are the controlled form an app writes: a signal per field, `value` in,
 * `onInput`/`onChange` out, and `Field` owning the `id`/`for`/`aria-describedby` wiring.
 *
 * The classes these components apply — `.input`, `.select`, `.checkbox`, `.radio` — are demonstrated
 * without the components in the `forms` chapter below this one: the components are the API, the
 * classes are what a page writes when it styles its own markup.
 */

import {
  Button,
  Checkbox,
  Field,
  Input,
  InputButton,
  Radio,
  RadioGroup,
  Select,
  Textarea,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import { IconSearch } from "@preact-components/icons"
import type { DemoFragment } from "../registry.ts"

/** One profile form: a labelled field per control, plus the two that carry their own label. */
function FieldDemo() {
  const name = useSignal("Ada Lovelace")
  const email = useSignal("not-an-address")
  const role = useSignal("admin")
  const notes = useSignal("Runs the night shift.\nKeeps the pager.")
  const query = useSignal("")
  const archived = useSignal(false)
  const channel = useSignal("email")

  const emailError = email.value.includes("@") ? undefined : "Enter a valid address"

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="guide-name" label="Name" class="sm:col-span-2">
        <Input
          value={name.value}
          placeholder="Full name"
          onInput={(event) => name.value = event.currentTarget.value}
        />
      </Field>

      <Field id="guide-email" label="Email" required error={emailError} hint="Work address only">
        <Input
          type="email"
          value={email.value}
          onInput={(event) => email.value = event.currentTarget.value}
        />
      </Field>

      <Field id="guide-role" label="Role">
        <Select
          value={role.value}
          onChange={(event) => role.value = event.currentTarget.value}
          options={[
            { value: "admin", label: "Administrator" },
            { value: "editor", label: "Editor" },
            { value: "viewer", label: "Viewer" },
          ]}
        />
      </Field>

      <Field id="guide-notes" label="Notes" class="sm:col-span-2">
        <Textarea
          rows={3}
          value={notes.value}
          onInput={(event) => notes.value = event.currentTarget.value}
        />
      </Field>

      <Field
        id="guide-archived"
        label="Archived"
        suffix
        hint="Hides the row from the list"
        labelFor={false}
      >
        <Checkbox
          checked={archived.value}
          onChange={(event) => archived.value = event.currentTarget.checked}
        />
      </Field>

      <Field id="guide-channel" label="Notification method" disabled labelFor={false}>
        <RadioGroup
          legend="Notification method"
          name="guide-channel"
          value={channel.value}
          onChange={(value) => channel.value = value}
          options={[
            { value: "email", label: "Email" },
            { value: "sms", label: "Phone (SMS)" },
            { value: "push", label: "Push notification", disabled: true },
          ]}
        />
      </Field>

      <Field id="guide-query" label="Search" class="sm:col-span-2">
        <InputButton
          name="q"
          type="search"
          icon={<IconSearch class="size-4" />}
          iconLabel="Search"
          placeholder="Search users"
          value={query.value}
          onInput={(event) => query.value = event.currentTarget.value}
        />
      </Field>

      <p class="text-sm text-gray-500 sm:col-span-2 dark:text-gray-400" data-e2e="controlled-value">
        name: {name.value} · email: {email.value} · role: {role.value} · archived:{" "}
        {archived.value ? "on" : "off"} · channel: {channel.value} · query:{" "}
        {query.value || "(empty)"}
      </p>
    </div>
  )
}

/** The search field of every list page in the ecosystem, as one component. */
function InputButtonDemo() {
  const query = useSignal("")
  return (
    <div class="max-w-xs space-y-2">
      <InputButton
        type="search"
        name="guide-input-button"
        icon={<IconSearch class="size-4" />}
        iconLabel="Search"
        placeholder="Search users"
        value={query.value}
        onInput={(event) => query.value = event.currentTarget.value}
        onClick={() => query.value = ""}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        query: {query.value || "(empty)"}
      </p>
    </div>
  )
}

/** A group needs a signal to be controlled the way the primitive expects. */
function RadioGroupDemo() {
  const channel = useSignal("email")
  return (
    <div class="max-w-xs space-y-2">
      <RadioGroup
        legend="Notification method"
        name="guide-radio-group"
        value={channel.value}
        onChange={(value) => channel.value = value}
        options={[
          { value: "email", label: "Email" },
          { value: "sms", label: "Phone (SMS)" },
          { value: "push", label: "Push notification", disabled: true },
        ]}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        channel: {channel.value}
      </p>
    </div>
  )
}

/**
 * One controlled field per control, so every demo shows the `value` in / event out contract.
 *
 * The "Focus via ref" button proves `Input` forwards its `ref` to the native `<input>`: the ref
 * would otherwise resolve to the component instance, and `.focus()` on that throws rather than
 * moving focus — `pages/checks/ui.ts` drives this button and reads `document.activeElement`.
 */
function InputDemo() {
  const email = useSignal("")
  const emailRef = useRef<HTMLInputElement>(null)
  return (
    <div class="max-w-xs space-y-2">
      <Input
        ref={emailRef}
        type="email"
        name="guide-input"
        placeholder="you@example.com"
        aria-label="Email"
        value={email.value}
        onInput={(event) => email.value = event.currentTarget.value}
        data-e2e="ref-target"
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {email.value || "(empty)"}
      </p>
      <Button
        variant="outline"
        size="sm"
        data-e2e="ref-focus"
        onClick={() => emailRef.current?.focus()}
      >
        Focus via ref
      </Button>
    </div>
  )
}

/** The same contract on the multi-line box. */
function TextareaDemo() {
  const notes = useSignal("")
  return (
    <div class="max-w-xs space-y-2">
      <Textarea
        name="guide-textarea"
        rows={3}
        placeholder="Notes"
        aria-label="Notes"
        value={notes.value}
        onInput={(event) => notes.value = event.currentTarget.value}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {notes.value.length} characters
      </p>
    </div>
  )
}

/** `options` as data, and the selection read back off the event. */
function SelectDemo() {
  const role = useSignal("editor")
  return (
    <div class="max-w-xs space-y-2">
      <Select
        name="guide-select"
        aria-label="Role"
        value={role.value}
        onChange={(event) => role.value = event.currentTarget.value}
        options={[
          { value: "admin", label: "Administrator" },
          { value: "editor", label: "Editor" },
          { value: "viewer", label: "Viewer" },
        ]}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        role: {role.value}
      </p>
    </div>
  )
}

/**
 * The box and its text are one hit area, because the label wraps the input.
 *
 * The "Focus via ref" button proves `Checkbox` forwards its `ref` to the native `<input>`, the same
 * way {@link InputDemo}'s does; see there for why the check drives a button rather than reading the
 * ref directly.
 */
function CheckboxDemo() {
  const archived = useSignal(false)
  const archivedRef = useRef<HTMLInputElement>(null)
  return (
    <div class="space-y-2">
      <Checkbox
        ref={archivedRef}
        name="guide-checkbox"
        checked={archived.value}
        onChange={(event) => archived.value = event.currentTarget.checked}
        data-e2e="ref-target"
      >
        Show archived rows
      </Checkbox>
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        archived: {archived.value ? "on" : "off"}
      </p>
      <Button
        variant="outline"
        size="sm"
        data-e2e="ref-focus"
        onClick={() => archivedRef.current?.focus()}
      >
        Focus via ref
      </Button>
    </div>
  )
}

/**
 * A bare radio is one choice; the group is what names a set of them.
 *
 * The "Focus via ref" button proves `Radio` forwards its `ref` to the native `<input>`, the same
 * way {@link InputDemo}'s does; see there for why the check drives a button rather than reading the
 * ref directly.
 */
function RadioDemo() {
  const choice = useSignal("a")
  const selectedRef = useRef<HTMLInputElement>(null)
  return (
    <div class="space-y-2">
      <div class="flex flex-wrap gap-6">
        <Radio
          ref={selectedRef}
          name="guide-radio"
          value="a"
          checked={choice.value === "a"}
          onChange={() => choice.value = "a"}
          data-e2e="ref-target"
        >
          Selected
        </Radio>
        <Radio
          name="guide-radio"
          value="b"
          checked={choice.value === "b"}
          onChange={() => choice.value = "b"}
        >
          Unselected
        </Radio>
        <Radio name="guide-radio" value="c" disabled>
          Disabled
        </Radio>
      </div>
      <Button
        variant="outline"
        size="sm"
        data-e2e="ref-focus"
        onClick={() => selectedRef.current?.focus()}
      >
        Focus via ref
      </Button>
    </div>
  )
}

export const fieldDemos = {
  Field: {
    summary:
      "Label, control, error and hint of one field row, and the owner of the `id`/`for` wiring. `suffix` puts the label under the control, `error` marks the control `aria-invalid`, and a caller's own `aria-describedby` is kept alongside the messages `Field` adds.",
    snippet: `<Field id="email" label="Email" required error={emailError} hint="Work address only">
  <Input value={email.value} onInput={(event) => email.value = event.currentTarget.value} />
</Field>

// The label under the control, and a control that is its own label — the opt-out keeps the label
// from pointing a for at something that cannot carry one:
<Field id="archived" label="Archived" suffix labelFor={false}>
  <Checkbox checked={archived.value} />
</Field>`,
    render: () => <FieldDemo />,
  },
  Input: {
    summary:
      "Native `<input>` with `.input`. Every native attribute passes through; `value` in, `onInput` out, and no draft state inside the component.",
    snippet: `<Input
  type="email"
  name="email"
  value={email.value}
  placeholder="you@example.com"
  required
  onInput={(event) => email.value = event.currentTarget.value}
/>`,
    render: () => <InputDemo />,
  },
  Textarea: {
    summary:
      "Native `<textarea>` with `.textarea`. Same contract as `Input`, on the multi-line box.",
    snippet:
      `<Textarea rows={4} value={notes.value} onInput={(event) => notes.value = event.currentTarget.value} />`,
    render: () => <TextareaDemo />,
  },
  Select: {
    summary:
      "Native `<select>` with `.select`, taking its options as data. The selection comes from `value`, so a value no option carries renders blank instead of mislabelling the first entry.",
    snippet: `<Select
  value={role.value}
  onChange={(event) => role.value = event.currentTarget.value}
  options={[
    { value: "admin", label: "Administrator" },
    { value: "editor", label: "Editor" },
  ]}
  placeholder="Choose a role"
/>`,
    render: () => <SelectDemo />,
  },
  Checkbox: {
    summary:
      'Native `<input type="checkbox">` with `.checkbox`, wrapped in its own label so the box and the text share one hit area. `checked` in, `onChange` out.',
    snippet: `<Checkbox
  checked={archived.value}
  onChange={(event) => archived.value = event.currentTarget.checked}
>
  Show archived
</Checkbox>`,
    render: () => <CheckboxDemo />,
  },
  Radio: {
    summary:
      'One native `<input type="radio">` with `.radio` inside its label. Give it a `name` — the platform groups on it, including arrow-key navigation.',
    snippet:
      `<Radio name="channel" value="email" checked={channel.value === "email"}>Email</Radio>`,
    render: () => <RadioDemo />,
  },
  RadioGroup: {
    summary:
      "`<fieldset>` + `<legend>` over radios that share one `name`, so the legend names the group and the browser keeps the roving tab stop and its arrow keys. No role, no key handler, no `aria-checked`. `onChange` receives the picked value first, because a change event fires on the radio rather than on the fieldset.",
    snippet: `<RadioGroup
  legend="Notification method"
  name="channel"
  value={channel.value}
  onChange={(value) => channel.value = value}
  options={[
    { value: "email", label: "Email" },
    { value: "sms", label: "Phone (SMS)" },
    { value: "push", label: "Push notification", disabled: true },
  ]}
/>`,
    render: () => <RadioGroupDemo />,
  },
  InputButton: {
    summary:
      "An input with a trailing `.btn-input-icon` button positioned inside it. Its own export rather than a slot on `Input`: it is a layout with two wrappers and reserved right padding, and `Input` stays a bare native element. The button is a sibling, so clicking it never activates the input.",
    snippet: `<InputButton
  type="search"
  icon={<IconSearch class="size-4" />}
  iconLabel="Search"
  placeholder="Search users"
  value={query.value}
  onInput={(event) => query.value = event.currentTarget.value}
  onClick={() => query.value = ""}
/>`,
    render: () => <InputButtonDemo />,
  },
} satisfies DemoFragment
