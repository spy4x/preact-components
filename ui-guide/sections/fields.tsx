/**
 * The `ui/` field primitives: one card per component, keyed by the export the package publishes.
 *
 * Every demo is the controlled form an app writes: a signal per field, `value` in,
 * `onInput`/`onChange` out, and `Field` owning the `id`/`for`/`aria-describedby` wiring. The classes
 * these components apply — `.input`, `.select`, `.checkbox`, `.radio` — are shown without the
 * components in the theme's `forms` section.
 */

import {
  Button,
  Checkbox,
  Cluster,
  Field,
  Grid,
  Input,
  InputButton,
  MoneyInput,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Textarea,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import { IconSearch } from "@spy4x/preact-icons"
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
    <Stack gap="md">
      <Field id="guide-name" label="Name">
        <Input
          value={name.value}
          placeholder="Full name"
          onInput={(event) => name.value = event.currentTarget.value}
        />
      </Field>

      <Grid minColumnWidth="sm" gap="md">
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
      </Grid>

      <Field id="guide-notes" label="Notes">
        <Textarea
          rows={3}
          value={notes.value}
          onInput={(event) => notes.value = event.currentTarget.value}
        />
      </Field>

      <Grid minColumnWidth="sm" gap="md">
        <Field id="guide-archived" hint="Hides the row from the list">
          <Checkbox
            checked={archived.value}
            onChange={(event) => archived.value = event.currentTarget.checked}
          >
            Archived
          </Checkbox>
        </Field>

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
      </Grid>

      <Field id="guide-query" label="Search">
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

      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        name: {name.value} · email: {email.value} · role: {role.value} · archived:{" "}
        {archived.value ? "on" : "off"} · channel: {channel.value} · query:{" "}
        {query.value || "(empty)"}
      </p>
    </Stack>
  )
}

/** The search field of every list page in the ecosystem, as one component. */
function InputButtonDemo() {
  const query = useSignal("")
  return (
    <Stack gap="sm" class="max-w-xs">
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
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        query: {query.value || "(empty)"}
      </p>
    </Stack>
  )
}

/** A group needs a signal to be controlled the way the primitive expects. */
function RadioGroupDemo() {
  const channel = useSignal("email")
  return (
    <Stack gap="sm" class="max-w-xs">
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
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        channel: {channel.value}
      </p>
    </Stack>
  )
}

/**
 * One controlled field per control, so every demo shows the `value` in / event out contract.
 *
 * The "Focus via ref" button proves `Input` forwards its `ref` to the native `<input>`: the ref
 * would otherwise resolve to the component instance, and `.focus()` on that throws rather than
 * moving focus — `pages/checks/ui.ts` drives this button and reads `document.activeElement`. A
 * button, rather than the check reading `emailRef.current` directly, because the check runs
 * against the page over the DevTools protocol, with no access to this closure's own `emailRef`
 * variable — the only thing it can do is drive something the page itself wired the ref through,
 * the same way a real caller would.
 */
function InputDemo() {
  const email = useSignal("")
  const emailRef = useRef<HTMLInputElement>(null)
  return (
    <Stack gap="sm" class="max-w-xs">
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
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {email.value || "(empty)"}
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => emailRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
    </Stack>
  )
}

/** The same contract on the multi-line box. */
function TextareaDemo() {
  const notes = useSignal("")
  return (
    <Stack gap="sm" class="max-w-xs">
      <Textarea
        name="guide-textarea"
        rows={3}
        placeholder="Notes"
        aria-label="Notes"
        value={notes.value}
        onInput={(event) => notes.value = event.currentTarget.value}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {notes.value.length} characters
      </p>
    </Stack>
  )
}

/** `options` as data, and the selection read back off the event. */
function SelectDemo() {
  const role = useSignal("editor")
  return (
    <Stack gap="sm" class="max-w-xs">
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
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        role: {role.value}
      </p>
    </Stack>
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
    <Stack gap="sm">
      <Checkbox
        ref={archivedRef}
        name="guide-checkbox"
        checked={archived.value}
        onChange={(event) => archived.value = event.currentTarget.checked}
        data-e2e="ref-target"
      >
        Show archived rows
      </Checkbox>
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        archived: {archived.value ? "on" : "off"}
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => archivedRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
    </Stack>
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
    <Stack gap="sm">
      <Cluster gap="lg">
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
      </Cluster>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => selectedRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
    </Stack>
  )
}

/**
 * `EUR`, German locale, so the demo proves the same locale mark the issue's own example uses:
 * typing a German-grouped amount here is what `pages/checks/ui.ts` types to prove grouping is
 * understood. A real `<form>` with its own submit button lets a browser check prove a real submit
 * is blocked while the field's text is refused, and posts once it is fixed. The "Add 5.00" button
 * changes `value` from outside the field, unrelated to typing, so a browser check can prove the
 * shown text re-syncs to an external change while the field is not focused.
 */
function MoneyInputDemo() {
  const amount = useSignal<number | null>(1999)
  const submits = useSignal(0)
  const lastSubmitted = useSignal("")
  return (
    <form
      class="max-w-xs"
      onSubmit={(event) => {
        event.preventDefault()
        submits.value++
        const data = new FormData(event.currentTarget)
        lastSubmitted.value = String(data.get("guide-money-amount") ?? "")
      }}
    >
      <Stack gap="sm">
        <Field id="guide-money-input" label="Price (EUR, German locale)">
          <MoneyInput
            value={amount.value}
            currency="EUR"
            locale="de"
            name="guide-money-amount"
            onChange={(value) => amount.value = value}
          />
        </Field>
        <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
          amount: {amount.value === null ? "(empty)" : amount.value}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="money-input-submits">
          submits: {submits.value}, posted: {lastSubmitted.value || "(none)"}
        </p>
        <Cluster gap="sm">
          <Button type="submit" size="sm" data-e2e="money-input-submit">Save</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-e2e="money-input-add-five"
            onClick={() => amount.value = (amount.value ?? 0) + 500}
          >
            Add 5.00
          </Button>
        </Cluster>
      </Stack>
    </form>
  )
}

export const fieldDemos = {
  Field: {
    summary:
      "One form row: a label, its control, and the hint or error under it, all wired to each other.",
    wide: true,
    props: [
      {
        name: "id",
        type: "string",
        description: "The control's id; the label and messages point at it.",
      },
      { name: "label", type: "ComponentChildren", description: "The visible label." },
      { name: "hint", type: "ComponentChildren", description: "Help text under the control." },
      {
        name: "error",
        type: "string | null",
        description: "An error under the control, which also marks it invalid.",
      },
      { name: "required", type: "boolean", default: "false", description: "Marks the label." },
      {
        name: "suffix",
        type: "boolean",
        default: "false",
        description: "Puts the label after the control, as a checkbox wants.",
      },
      {
        name: "labelFor",
        type: "boolean | string",
        default: "true",
        description: "What the label points at; `false` for a control that names itself.",
      },
    ],
    snippet: `<Field id="email" label="Email" required error={emailError} hint="Work address only">
  <Input value={email.value} onInput={(event) => email.value = event.currentTarget.value} />
</Field>

// A checkbox names itself with its own text, so Field adds only the hint and the wiring:
<Field id="archived" hint="Hides the row from the list">
  <Checkbox checked={archived.value}>Archived</Checkbox>
</Field>`,
    render: () => <FieldDemo />,
  },
  Input: {
    summary:
      "A text field that shows the caller's `value` and reports every keystroke through `onInput`.",
    wide: false,
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
    summary: "A multi-line text field, with the same `value` in and `onInput` out as `Input`.",
    wide: false,
    snippet:
      `<Textarea rows={4} value={notes.value} onInput={(event) => notes.value = event.currentTarget.value} />`,
    render: () => <TextareaDemo />,
  },
  Select: {
    summary: "A native drop-down list whose options are passed as data.",
    wide: false,
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
    summary: "A checkbox and its text, where clicking either one ticks the box.",
    wide: false,
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
      "One radio button and its text, which makes one choice with the other radios of its `name`.",
    wide: false,
    snippet:
      `<Radio name="channel" value="email" checked={channel.value === "email"}>Email</Radio>`,
    render: () => <RadioDemo />,
  },
  RadioGroup: {
    summary: "A set of radio buttons under one heading, of which one is picked.",
    wide: false,
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
      "A text field with a button inside its right edge, such as a search box's search button.",
    wide: false,
    props: [
      { name: "icon", type: "ComponentChildren", description: "What the button shows." },
      { name: "iconLabel", type: "string", description: "The button's accessible name." },
      { name: "onClick", type: "() => void", description: "What the button does." },
      {
        name: "value / onInput",
        type: "string / (event) => void",
        description: "The field's text, as on `Input`; every other input attribute passes through.",
      },
    ],
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
  MoneyInput: {
    summary:
      "An amount field that reads what people type in their own number format and hands back the amount in cents.",
    wide: false,
    props: [
      {
        name: "value",
        type: "number | null",
        description: "The amount in the currency's smallest unit, such as cents.",
      },
      {
        name: "onChange",
        type: "(value: number | null) => void",
        description: "Called when the typed text reads as a new amount.",
      },
      { name: "currency", type: "string", description: "The ISO code, such as `EUR`." },
      {
        name: "locale",
        type: "string",
        default: `"en"`,
        description: "How the amount is shown and how typed text is read.",
      },
      {
        name: "min / max",
        type: "number",
        description: "The allowed range, in the smallest unit.",
      },
      {
        name: "name",
        type: "string",
        description: "Posts that integer in a hidden field of this name.",
      },
    ],
    snippet: `<Field id="price" label="Price">
  <MoneyInput
    value={amount.value}
    currency="EUR"
    locale="de"
    name="price"
    onChange={(value) => amount.value = value}
  />
</Field>`,
    render: () => <MoneyInputDemo />,
  },
} satisfies DemoFragment
