/**
 * The `ui/` field primitives: one card per component, keyed by the export the package publishes.
 *
 * Every demo is the controlled form an app writes: a signal per field, `value` in,
 * `onInput`/`onChange` out, and `Field` owning the `id`/`for`/`aria-describedby` wiring. The classes
 * these components apply — `.pc-input`, `.pc-select`, `.pc-checkbox`, `.pc-radio` — are shown without the
 * components in the theme's `forms` section.
 */

import {
  Button,
  Checkbox,
  Cluster,
  ColorField,
  Combobox,
  DateTimeField,
  Field,
  Grid,
  InlineEdit,
  Input,
  InputButton,
  ListField,
  MoneyInput,
  QuickAdd,
  Radio,
  RadioChips,
  RadioGroup,
  Select,
  Stack,
  TagInput,
  Textarea,
  ToggleChips,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { useEffect, useRef } from "preact/hooks"
import { IconSearch } from "@spy4x/preact-icons"
import type { DemoFragment } from "../registry.ts"
import { DemoNote } from "./demo-note.tsx"

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

      <p class="text-xs text-muted" data-e2e="controlled-value">
        name: {name.value} · email: {email.value} · role: {role.value} · archived:{" "}
        {archived.value ? "on" : "off"} · channel: {channel.value} · query:{" "}
        {query.value || "(empty)"}
      </p>
    </Stack>
  )
}

const shippingCities = ["Lisbon", "Porto", "Atlantis"]

/**
 * An order form whose four fields are required, each around a control that enforces it in its own
 * way: an amount, tags, a combobox and a radio group. The browser refuses the submit while one is
 * empty, and the count under the form only moves when a submit goes through. "Reset" empties all
 * four, so a browser check can leave out one at a time. Choosing Atlantis shows an error under the
 * combobox, which its input then points at.
 */
function RequiredFieldsDemo() {
  const price = useSignal<number | null>(null)
  const tags = useSignal<string[]>([])
  const city = useSignal<string | null>(null)
  const plan = useSignal<string | null>(null)
  const submits = useSignal(0)

  return (
    <form
      data-e2e="required-form"
      onSubmit={(event) => {
        event.preventDefault()
        submits.value++
      }}
    >
      <Stack gap="md">
        <Grid minColumnWidth="sm" gap="md">
          <Field id="guide-required-price" label="Price (EUR)" required>
            <MoneyInput
              value={price.value}
              currency="EUR"
              onChange={(value) => price.value = value}
            />
          </Field>
          <Field id="guide-required-tags" label="Tags" required hint="At least one.">
            <TagInput value={tags.value} onChange={(next) => tags.value = next} />
          </Field>
          <Field
            id="guide-required-city"
            label="Ships to"
            required
            error={city.value === "Atlantis" ? "We do not ship to Atlantis" : undefined}
          >
            <Combobox
              items={shippingCities}
              value={city.value}
              onChange={(next) => city.value = next}
              ariaLabel="Ships to"
            />
          </Field>
          <Field id="guide-required-plan" labelFor={false} required>
            <RadioGroup
              legend="Delivery (required)"
              name="guide-required-plan"
              value={plan.value}
              onChange={(value) => plan.value = value}
              options={[
                { value: "standard", label: "Standard" },
                { value: "express", label: "Express" },
              ]}
            />
          </Field>
        </Grid>
        <p class="text-xs text-muted" data-e2e="required-submits">submits: {submits.value}</p>
        <Cluster gap="sm">
          <Button type="submit" size="sm" data-e2e="required-submit">Place order</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-e2e="required-reset"
            onClick={() => {
              price.value = null
              tags.value = []
              city.value = null
              plan.value = null
            }}
          >
            Reset
          </Button>
        </Cluster>
      </Stack>
    </form>
  )
}

/** The search field of every list page in the ecosystem, as one component. */
function InputButtonDemo() {
  const query = useSignal("")
  const queryRef = useRef<HTMLInputElement>(null)
  return (
    <Stack gap="sm" class="max-w-xs">
      <InputButton
        ref={queryRef}
        data-e2e="ref-target"
        type="search"
        name="guide-input-button"
        icon={<IconSearch class="size-4" />}
        iconLabel="Search"
        placeholder="Search users"
        value={query.value}
        onInput={(event) => query.value = event.currentTarget.value}
        onClick={() => query.value = ""}
      />
      <p class="text-xs text-muted" data-e2e="controlled-value">
        query: {query.value || "(empty)"}
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => queryRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
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
      <p class="text-xs text-muted" data-e2e="controlled-value">
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
      <p class="text-xs text-muted" data-e2e="controlled-value">
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

/** The same contract on the multi-line box, and the same ref: it reaches the `<textarea>`. */
function TextareaDemo() {
  const notes = useSignal("")
  const notesRef = useRef<HTMLTextAreaElement>(null)
  return (
    <Stack gap="sm" class="max-w-xs">
      <Textarea
        ref={notesRef}
        data-e2e="ref-target"
        name="guide-textarea"
        rows={3}
        placeholder="Notes"
        aria-label="Notes"
        value={notes.value}
        onInput={(event) => notes.value = event.currentTarget.value}
      />
      <p class="text-xs text-muted" data-e2e="controlled-value">
        {notes.value.length} characters
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => notesRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
    </Stack>
  )
}

/** `options` as data, the selection read back off the event, and a ref on the `<select>`. */
function SelectDemo() {
  const role = useSignal("editor")
  const roleRef = useRef<HTMLSelectElement>(null)
  return (
    <Stack gap="sm" class="max-w-xs">
      <Select
        ref={roleRef}
        data-e2e="ref-target"
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
      <p class="text-xs text-muted" data-e2e="controlled-value">
        role: {role.value}
      </p>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="ref-focus"
          onClick={() => roleRef.current?.focus()}
        >
          Focus via ref
        </Button>
      </Cluster>
    </Stack>
  )
}

/**
 * The box and its text are one hit area, because the label wraps the input.
 *
 * The "Focus via ref" button proves `Checkbox` forwards its `ref` to the native `<input>`, the same
 * way {@link InputDemo}'s does; see there for why the check drives a button rather than reading the
 * ref directly.
 *
 * The round boxes show `shape="round"` ticked by a click, indeterminate, and disabled. Tab onto
 * the first to see its focus ring, the components' own `--color-ring`.
 */
function CheckboxDemo() {
  const archived = useSignal(false)
  const done = useSignal(false)
  const archivedRef = useRef<HTMLInputElement>(null)
  const mixedRef = useRef<HTMLInputElement>(null)
  // `indeterminate` is a property with no attribute, so a server render cannot carry it: set it
  // once the box is in the page.
  useEffect(() => {
    if (mixedRef.current) mixedRef.current.indeterminate = true
  }, [])
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
      <Checkbox
        shape="round"
        name="guide-checkbox-round"
        checked={done.value}
        onChange={(event) => done.value = event.currentTarget.checked}
        data-e2e="round-check"
      >
        Water the plants
      </Checkbox>
      <Checkbox ref={mixedRef} shape="round" data-e2e="round-mixed">
        Some subtasks done
      </Checkbox>
      <Checkbox shape="round" checked disabled data-e2e="round-disabled">
        Done, locked
      </Checkbox>
      <p class="text-xs text-muted" data-e2e="controlled-value">
        archived: {archived.value ? "on" : "off"} · plants: {done.value ? "done" : "to do"}
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
        <p class="text-xs text-muted" data-e2e="controlled-value">
          amount: {amount.value === null ? "(empty)" : amount.value}
        </p>
        <p class="text-xs text-muted" data-e2e="money-input-submits">
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

/**
 * Two rename fields: one whose save takes a moment and succeeds, one whose save always fails, so
 * the busy state and the kept text of a rejected save can both be seen. The first one's buttons
 * remove it from the page and lock it, the two ways an open field can be taken away from its user.
 */
function InlineEditDemo() {
  const list = useSignal("Groceries")
  const saves = useSignal(0)
  const offline = useSignal("Archive")
  const shown = useSignal(true)
  const locked = useSignal(false)
  const trip = useSignal("Trip to Lisbon")
  return (
    <Stack gap="sm">
      <h4 class="pc-h4" aria-labelledby="inline-edit-heading-text" data-e2e="inline-edit-heading">
        <InlineEdit
          value={trip.value}
          textId="inline-edit-heading-text"
          dataE2E="inline-edit-in-heading"
          inputLabel="Trip name"
          onSave={(next) => {
            trip.value = next
          }}
        />
      </h4>
      <div data-e2e="inline-edit-ok">
        {shown.value && (
          <InlineEdit
            value={list.value}
            inputLabel="List name"
            disabled={locked.value}
            onSave={async (next) => {
              await new Promise((done) => setTimeout(done, 400))
              list.value = next
              saves.value++
            }}
          />
        )}
      </div>
      <p class="text-xs text-muted" data-e2e="inline-edit-saved">
        saved: {list.value}, saves: {saves.value}
      </p>
      <Cluster gap="sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-e2e="inline-edit-remove"
          onClick={() => shown.value = !shown.value}
        >
          {shown.value ? "Remove the field" : "Show the field"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-e2e="inline-edit-lock"
          onClick={() => locked.value = !locked.value}
        >
          {locked.value ? "Unlock" : "Lock"}
        </Button>
      </Cluster>
      <div data-e2e="inline-edit-fail">
        <InlineEdit
          value={offline.value}
          inputLabel="List name"
          errorMessage={() => "The server is offline. Your text is kept; try again later."}
          onSave={() => Promise.reject(new Error("offline"))}
        />
      </div>
      <p class="text-xs text-muted">
        The second field's save always fails.
      </p>
    </Stack>
  )
}

/** 01:00 on Sunday 8 March 2026 in Ho Chi Minh, when it is still Saturday the 7th in UTC. */
const QUICK_ADD_DEMO_NOW = new Date("2026-03-07T18:00:00Z")

/**
 * Three add fields. The first lists what `onAdd` received and has a button that holds it busy, so
 * a refused send can be seen. The second reads its line on a fixed clock in a fixed time zone, so
 * "tomorrow" is the same day for every visitor. The third words its badges, its button and its due
 * day itself.
 */
function QuickAddDemo() {
  const added = useSignal<string[]>([])
  const busy = useSignal(false)
  const dated = useSignal("")
  return (
    <Stack gap="sm">
      <QuickAdd
        label="New note"
        placeholder="Call Anna #work tomorrow 3pm !high"
        hint={(parsed) => parsed.due ? "Added to Scheduled" : "Added to Inbox"}
        busy={busy.value}
        onAdd={({ title, tags, contexts, due, priority }) =>
          added.value = [...added.value, JSON.stringify({ title, tags, contexts, due, priority })]}
      />
      <p class="text-xs text-muted" data-e2e="quick-add-added">
        added {added.value.length}: {added.value.join(" ")}
      </p>
      <Cluster gap="sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-e2e="quick-add-busy"
          onClick={() => busy.value = !busy.value}
        >
          {busy.value ? "Finish saving" : "Hold it busy"}
        </Button>
      </Cluster>
      <QuickAdd
        dataE2E="quick-add-clock"
        label="New reminder"
        placeholder="Water the plants tomorrow"
        hint="Read at 01:00 on Sunday 8 March 2026 in Ho Chi Minh"
        zone="Asia/Ho_Chi_Minh"
        now={() => QUICK_ADD_DEMO_NOW}
        onAdd={({ title, due }) => dated.value = `${title}, due ${due?.date ?? "no day"}`}
      />
      <p class="text-xs text-muted" data-e2e="quick-add-clock-added">
        added: {dated.value}
      </p>
      <QuickAdd
        dataE2E="quick-add-worded"
        label="New expense"
        placeholder="Coffee #food today"
        labels={{
          submit: "Add expense",
          noTitle: "Say what the expense was for",
          tag: (name) => `Category ${name}`,
          due: (day) => `Paid ${day}`,
        }}
        dueLabel={(date) => date.split("-").reverse().join(".")}
        onAdd={() => {}}
      />
    </Stack>
  )
}

/**
 * A tag's colour with the tag chip as its live sample, the value it stores, and a reset that changes
 * it from outside; then a group's colour, which may have none. Both sit in a real `<form>`, so a
 * browser check can prove an invalid hex refuses the submit and every valid choice saves.
 */
function ColorFieldDemo() {
  const color = useSignal<string | null>("#0369a1")
  const groupColor = useSignal<string | null>(null)
  const saves = useSignal(0)
  const saved = useSignal("")
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        saves.value++
        saved.value = `${color.value ?? "none"}, group ${groupColor.value ?? "none"}`
      }}
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <ColorField
            value={color.value}
            onChange={(next) => color.value = next}
            legend="Tag colour"
            hint="Text on the tag turns black or white, whichever reads better."
            preview={(background, text) => (
              <span
                class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                style={{ backgroundColor: background, color: text }}
                data-e2e="color-field-chip"
              >
                Groceries
              </span>
            )}
          />
          <Cluster gap="sm">
            <p class="text-xs text-muted">
              Stored: <code data-e2e="color-field-value">{color.value ?? "none"}</code>
            </p>
            <Button variant="outline" size="sm" onClick={() => color.value = "#0369a1"}>
              Reset to Sky
            </Button>
          </Cluster>
        </Stack>
        <ColorField
          value={groupColor.value}
          onChange={(next) => groupColor.value = next}
          legend="Group colour"
          allowNone
          noneLabel="No group colour"
        />
        <Cluster gap="sm">
          <Button type="submit" size="sm">Save</Button>
          <p class="text-xs text-muted" data-e2e="color-field-saves">
            saves: {saves.value}, saved: {saved.value || "(none)"}
          </p>
        </Cluster>
      </Stack>
    </form>
  )
}

/** A server-rendered single choice: page CSS reads the checked radio, no script needed. */
function RadioChipsDemo() {
  return (
    <div class="flex flex-col gap-3 [&:has(#radio-chips-read-only:checked)_[data-tool=delete]]:hidden">
      <RadioChips
        legend="Which tools the server offers"
        name="demo-radio-chips-mode"
        defaultValue="all"
        options={[
          { value: "all", label: "All tools", id: "radio-chips-all" },
          { value: "read-only", label: "Read only", id: "radio-chips-read-only" },
          { value: "none", label: "None", disabled: true },
        ]}
      />
      <p class="text-xs text-muted" data-e2e="radio-chips-tools">
        <span>list_events</span> <span data-tool="delete">· delete_event</span>
      </p>
    </div>
  )
}

/** A multi-select tag filter and a single-select status filter, each echoing its value. */
function ToggleChipsDemo() {
  const tags = useSignal<string[]>(["work"])
  const status = useSignal<string | null>("open")
  return (
    <Stack gap="md">
      <ToggleChips
        label="Tags"
        options={[
          { value: "work", label: "work" },
          { value: "home", label: "home" },
          { value: "errands", label: "errands" },
          { value: "someday", label: "someday", disabled: true },
        ]}
        value={tags.value}
        onChange={(next) => tags.value = next}
      />
      <ToggleChips
        mode="single"
        label="Status"
        color="blue"
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Done" },
          { value: "all", label: "All" },
        ]}
        value={status.value}
        onChange={(next) => status.value = next}
      />
      <p class="text-xs text-muted" data-e2e="toggle-chips-value">
        tags: {tags.value.join(", ") || "(none)"} · status: {status.value ?? "(none)"}
      </p>
    </Stack>
  )
}

/** Key points of a post: up to five lines, in a form whose submits the note counts. */
function ListFieldDemo() {
  const points = useSignal(["Jobs are written down first.", "A failed run retries on its own."])
  const submits = useSignal(0)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submits.value++
      }}
    >
      <Stack gap="sm">
        <ListField
          id="guide-points"
          label="Key points"
          value={points.value}
          onChange={(next) => points.value = next}
          max={5}
          maxLength={160}
          placeholder="One sentence"
          hint="Shown in a box above the post. Enter adds a point."
          labels={{
            item: (n) => `Key point ${n}`,
            remove: (n) => `Remove key point ${n}`,
            add: "Add point",
          }}
        />
        <DemoNote e2e="list-field-value">
          {JSON.stringify(points.value)}; submitted {submits.value} times
        </DemoNote>
      </Stack>
    </form>
  )
}

/** A publish time typed in Berlin, stored as an instant. */
function DateTimeFieldDemo() {
  const at = useSignal<string | null>("2026-10-25T08:30:00.000Z")
  return (
    <Stack gap="sm">
      <DateTimeField
        id="guide-publish-at"
        label="Goes live at"
        value={at.value}
        onChange={(next) => at.value = next}
        timeZone="Europe/Berlin"
        hint="The post goes live on its own at that time."
        required
      />
      <DemoNote e2e="date-time-field-value">Stored: {at.value ?? "none"}</DemoNote>
    </Stack>
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
      {
        name: "required",
        type: "boolean",
        default: "false",
        description:
          "Hands `required` to the control, which enforces it, and marks the label with a `*`. The `*` also shows for a control that is `required` itself.",
      },
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
</Field>

// Each control enforces required in its own way: at least one tag, an item chosen, a radio picked.
<Field id="tags" label="Tags" required>
  <TagInput value={tags.value} onChange={(next) => tags.value = next} />
</Field>`,
    render: () => (
      <Stack gap="lg">
        <FieldDemo />
        <RequiredFieldsDemo />
      </Stack>
    ),
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
    summary:
      "A multi-line text field, with the same `value` in and `onInput` out as `Input`, and a `ref` that reaches the `<textarea>`.",
    wide: false,
    snippet:
      `<Textarea rows={4} value={notes.value} onInput={(event) => notes.value = event.currentTarget.value} />`,
    render: () => <TextareaDemo />,
  },
  Select: {
    summary:
      "A native drop-down list whose options are passed as data, with a `ref` that reaches the `<select>`.",
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
    summary: "A square or round checkbox and its text, where clicking either one ticks the box.",
    wide: false,
    snippet: `<Checkbox
  checked={archived.value}
  onChange={(event) => archived.value = event.currentTarget.checked}
>
  Show archived
</Checkbox>

<Checkbox
  shape="round"
  checked={done.value}
  onChange={(event) => done.value = event.currentTarget.checked}
>
  Water the plants
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
    props: [
      { name: "legend", type: "ComponentChildren", description: "The group's name." },
      { name: "name", type: "string", description: "The name every radio shares." },
      { name: "options", type: "RadioOption[]", description: "The choices." },
      {
        name: "value / onChange",
        type: "number | string | null / (value: string, event) => void",
        description: "The picked value, and the port that reports a new pick.",
      },
      {
        name: "required",
        type: "boolean",
        default: "false",
        description: "One choice must be picked before the form submits; `Field` sets it.",
      },
    ],
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
      {
        name: "ref",
        type: "Ref<HTMLInputElement>",
        description: "Reaches the text field, so a form can focus it.",
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
      {
        name: "required",
        type: "boolean",
        default: "false",
        description: "The browser refuses a submit while the field is empty; `Field` sets it.",
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
  InlineEdit: {
    summary:
      "A value shown as text that turns into a text field in place, for renaming something where it stands.",
    wide: false,
    props: [
      { name: "value", type: "string", description: "The saved text." },
      {
        name: "onSave",
        type: "(value: string) => void | Promise<void>",
        description:
          "Called with the trimmed new text on Enter or blur; not for an empty or unchanged text.",
      },
      {
        name: "editLabel",
        type: "(value: string) => string",
        default: "`Edit ${value}`",
        description: "The accessible name of the button that opens the field.",
      },
      {
        name: "inputLabel",
        type: "string",
        default: `"New name"`,
        description: "The field's accessible name.",
      },
      {
        name: "savingLabel",
        type: "string",
        default: `"Saving…"`,
        description: "Shown while a returned promise runs.",
      },
      {
        name: "disabled",
        type: "boolean",
        default: "false",
        description:
          "Turns the button off; turning it on while the field is open cancels the edit.",
      },
      {
        name: "errorMessage",
        type: "(error: unknown) => string",
        default: `"Could not save. Try again."`,
        description: "Words a rejected save; the field stays open with the typed text.",
      },
      {
        name: "textId",
        type: "string",
        description:
          "Id of the shown text. Inside a heading, point its `aria-labelledby` here, so the heading reads as the value and not as the button's name.",
      },
      { name: "dataE2E", type: "string", description: "Sets `data-e2e` on the outer element." },
    ],
    snippet: `<h1 aria-labelledby="group-name">
  <InlineEdit value={group.name} textId="group-name" onSave={rename} />
</h1>
<InlineEdit
  value={list.value}
  inputLabel="List name"
  onSave={async (next) => {
    await api.renameList(id, next)
    list.value = next
  }}
/>`,
    render: () => <InlineEditDemo />,
  },
  QuickAdd: {
    summary:
      "A one-line field that adds an item to a list and shows, while you type, the tags, date and priority it understood.",
    wide: false,
    props: [
      {
        name: "onAdd",
        type: "(parsed: QuickAddResult) => void",
        description:
          "Called on Enter or the button with the title and what was taken out of it; not while busy, and not for a line that leaves no title.",
      },
      {
        name: "zone",
        type: "string",
        default: "the device's zone",
        description: 'The IANA time zone "tomorrow" and "3pm" are read in.',
      },
      {
        name: "now",
        type: "() => Date",
        default: "() => new Date()",
        description: "The clock, for a test to fix.",
      },
      {
        name: "label",
        type: "string",
        default: `"New item"`,
        description: "The field's accessible name.",
      },
      {
        name: "placeholder",
        type: "string",
        default: `"Add an item"`,
        description: "Shown in the empty field.",
      },
      {
        name: "hint",
        type: "string | ((parsed: QuickAddResult) => string)",
        description: "A quiet line under the field; a function follows what is typed.",
      },
      {
        name: "busy",
        type: "boolean",
        default: "false",
        description: "Makes the field read-only and the button off; a send adds nothing.",
      },
      {
        name: "labels",
        type: "Partial<QuickAddLabels>",
        default: "defaultQuickAddLabels",
        description:
          "The button's name, the empty-title message, and the words of each kind of badge.",
      },
      {
        name: "dueLabel",
        type: "(date: string, now: Date, zone: string) => string",
        default: `"Today", "Tomorrow", "Mon 5 Jan"`,
        description: "Words the due day; the time is always shown as typed.",
      },
      {
        name: "dataE2E",
        type: "string",
        default: `"quick-add"`,
        description: "The form's `data-e2e`, and the prefix of its parts'.",
      },
    ],
    snippet: `<QuickAdd
  label="New note"
  placeholder="Call Anna #work tomorrow 3pm !high"
  hint={(parsed) => parsed.due ? "Added to Scheduled" : "Added to Inbox"}
  busy={saving.value}
  onAdd={(parsed) => createNote(parsed)}
/>

// A fixed clock and zone, as a test passes them:
<QuickAdd zone="Asia/Ho_Chi_Minh" now={() => new Date("2026-03-07T18:00:00Z")} onAdd={addReminder} />

// Every word is the caller's to change:
<QuickAdd
  label="New expense"
  labels={{ submit: "Add expense", tag: (name) => \`Category \${name}\`, due: (day) => \`Paid \${day}\` }}
  dueLabel={(date) => date.split("-").reverse().join(".")}
  onAdd={addExpense}
/>`,
    render: () => <QuickAddDemo />,
  },
  ColorField: {
    summary:
      "A colour from 16 readable swatches or a custom hex, with a live sample of the thing being coloured.",
    wide: false,
    props: [
      {
        name: "value / onChange",
        type: "string | null / (value: string | null) => void",
        description:
          "The chosen `#rrggbb`, or `null` for none; a custom hex arrives in lower case.",
      },
      {
        name: "presets",
        type: "{ value, label }[]",
        default: "COLOR_PRESETS",
        description: "The swatches before Custom: a gray and 15 hues.",
      },
      {
        name: "allowNone / noneLabel",
        type: "boolean / string",
        default: `false / "No colour"`,
        description: "A first swatch that sends `null`.",
      },
      {
        name: "legend / hint / error",
        type: "ComponentChildren / ComponentChildren / string | null",
        default: `"Colour"`,
        description: "The group's name, and messages tied to it with `aria-describedby`.",
      },
      {
        name: "preview",
        type: "(color, textColor) => ComponentChildren",
        description:
          "The caller's live sample, such as a tag chip, drawn while a colour is chosen.",
      },
      {
        name: "labels",
        type: "{ custom?, picker?, hexCode?, hexPlaceholder?, hexError? }",
        description:
          "Every word of the Custom swatch and its hex field, each with an English default.",
      },
      {
        name: "name / class",
        type: "string",
        description:
          "The radios' shared name (generated when left out), and utilities on the fieldset.",
      },
    ],
    snippet: `<ColorField
  value={color.value}
  onChange={(next) => color.value = next}
  legend="Tag colour"
  preview={(background, text) => (
    <span style={{ backgroundColor: background, color: text }}>Groceries</span>
  )}
/>`,
    render: () => <ColorFieldDemo />,
  },
  RadioChips: {
    summary:
      "One choice drawn as `ToggleChips` chips, on native radios, so it works with JavaScript off.",
    wide: false,
    props: [
      {
        name: "legend",
        type: "ComponentChildren",
        description: "The group's accessible name, rendered as the `<legend>`.",
      },
      {
        name: "hideLegend / legendClass",
        type: "boolean / string",
        default: `false / "pc-label mb-2"`,
        description: "Keep the legend for screen readers only, or replace its classes.",
      },
      {
        name: "name",
        type: "string",
        description: "Shared by every radio: one tab stop, arrow keys, and the submitted field.",
      },
      {
        name: "options",
        type: "{ value, label, disabled?, id?, inputAttributes? }[]",
        description:
          "One chip per option. `id` lets page CSS read `:has(#id:checked)`; `inputAttributes` go on the radio.",
      },
      {
        name: "defaultValue",
        type: "string",
        description: "The option checked in the server markup; the browser keeps the choice after.",
      },
      {
        name: "value / onChange",
        type: "string | null / (value, event) => void",
        description: "Optional: control the choice from an island.",
      },
      {
        name: "class / optionsClass",
        type: "string",
        description: "Utilities on the fieldset, and added to the chips' row.",
      },
    ],
    snippet: `<RadioChips
  legend="Which tools the server offers"
  name="mode"
  defaultValue="all"
  options={[
    { value: "all", label: "All tools", id: "mode-all" },
    { value: "read-only", label: "Read only", id: "mode-read-only" },
  ]}
/>`,
    render: () => <RadioChipsDemo />,
  },
  ToggleChips: {
    summary:
      "A row of pressable chips for filtering a list, in the colours of `Badge`, one or many pressed at once.",
    wide: false,
    props: [
      {
        name: "options",
        type: "{ value, label, disabled? }[]",
        description: "One chip per option.",
      },
      {
        name: "value / onChange",
        type: "string[] or string | null",
        description: 'The pressed chips: a list, or one value or `null` with `mode="single"`.',
      },
      {
        name: "mode",
        type: `"multiple" | "single"`,
        default: `"multiple"`,
        description: "How many chips can be pressed at once.",
      },
      {
        name: "label",
        type: "string",
        default: `"Filters"`,
        description: "The group's accessible name.",
      },
      {
        name: "color",
        type: "BadgeColor",
        default: `"purple"`,
        description:
          "A pressed chip's colour, with a check before its text; an unpressed chip is plain, on the surface.",
      },
    ],
    snippet: `<ToggleChips
  label="Tags"
  options={[{ value: "work", label: "work" }, { value: "home", label: "home" }]}
  value={tags.value}
  onChange={(next) => tags.value = next}
/>

<ToggleChips
  mode="single"
  label="Status"
  options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }]}
  value={status.value}
  onChange={(next) => status.value = next}
/>`,
    render: () => <ToggleChipsDemo />,
  },
  ListField: {
    summary:
      "An ordered list of short lines, such as a post's key points: an input per line, add and remove, up to a limit.",
    wide: false,
    props: [
      {
        name: "id / label",
        type: "string / ComponentChildren",
        description: "The first line's `id`, and the group's `<legend>`.",
      },
      {
        name: "value / onChange",
        type: "string[] / (value: string[]) => void",
        description: "The lines, and the whole new list after every change.",
      },
      {
        name: "max / maxLength",
        type: "number",
        description: "The most lines, and the most characters one line takes.",
      },
      {
        name: "hint / error / disabled / name / placeholder",
        type: "ComponentChildren / string / boolean / string / string",
        description: "Messages tied to the group, and attributes on every line.",
      },
      {
        name: "labels",
        type: "{ item?, remove?, add?, count? }",
        description: `Each line's name, the remove button's, "Add item" and "3 of 5".`,
      },
    ],
    snippet: `<ListField
  id="tldr"
  label="Key points"
  value={points.value}
  onChange={(next) => points.value = next}
  max={5}
/>`,
    render: () => <ListFieldDemo />,
  },
  DateTimeField: {
    summary:
      "One date and time typed in a named time zone, which shows beside the input with its offset, read and written as an instant.",
    wide: false,
    props: [
      {
        name: "value / onChange",
        type: "string | null / (value: string | null) => void",
        description: "The moment as an ISO 8601 instant, or `null` for none.",
      },
      {
        name: "timeZone",
        type: "string",
        description: "The IANA zone the person types in; an unknown one reads as UTC.",
      },
      {
        name: "min / max",
        type: "string",
        description: "The range the browser's picker offers, as instants.",
      },
      {
        name: "id / label / hint / error / required / disabled",
        type: "string / ComponentChildren / ComponentChildren / string / boolean / boolean",
        description: "As on `Field`.",
      },
      {
        name: "labels",
        type: "{ zone? }",
        description: `The zone line, "Time zone: Berlin, Europe · GMT+2" by default.`,
      },
    ],
    snippet: `<DateTimeField
  id="publish-at"
  label="Goes live at"
  value={at.value}
  onChange={(next) => at.value = next}
  timeZone="Europe/Berlin"
/>`,
    render: () => <DateTimeFieldDemo />,
  },
} satisfies DemoFragment
