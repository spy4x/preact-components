import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  Cluster,
  CopyButton,
  Input,
  Link,
  Stack,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import { IconPlus } from "@spy4x/preact-icons"
import { entries } from "../record.ts"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** One label per variant — a variant with no label does not compile. */
const variants: Record<ButtonVariant, string> = {
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
  ghost: "Ghost",
  icon: "Icon",
  danger: "Danger",
}

const sizes: Record<ButtonSize, string> = {
  sm: "sm",
  md: "md",
  lg: "lg",
}

/** One row per size, every variant in it, with the size named in a fixed-width first column. */
function ButtonMatrix() {
  return (
    <Stack gap="sm">
      {entries(sizes).map(([size, sizeLabel]) => (
        <Cluster key={size} align="baseline" class="flex-nowrap">
          <span class="w-16 shrink-0 text-xs text-muted">{sizeLabel}</span>
          <Cluster>
            {entries(variants).map(([variant, label]) => (
              <Button key={variant} variant={variant} size={size} title={`${variant} ${size}`}>
                {variant === "icon" ? <IconPlus class="size-4" /> : label}
              </Button>
            ))}
          </Cluster>
        </Cluster>
      ))}
      <Cluster align="baseline" class="flex-nowrap">
        <span class="w-16 shrink-0 text-xs text-muted">disabled</span>
        <Cluster>
          <Button disabled>Disabled</Button>
          <Button variant="danger" disabled>Disabled danger</Button>
        </Cluster>
      </Cluster>
    </Stack>
  )
}

/**
 * Proves the button is a real control rather than a styled div: the counter only moves if
 * `onClick` reaches the native element, which is where every other button attribute goes too.
 *
 * "Focus via ref" proves `Button` forwards its own `ref` to that native `<button>` as well:
 * Preact strips `ref` off a function component's props and applies it to the component instance
 * instead, so a plain function here would make the ref resolve to something `.focus()` throws on.
 * `pages/checks/ui.ts` drives this trigger and reads `document.activeElement`.
 */
function ButtonClickDemo() {
  const clicks = useSignal(0)
  const clickMeRef = useRef<HTMLButtonElement>(null)
  return (
    <Cluster>
      <Button ref={clickMeRef} onClick={() => clicks.value += 1} data-e2e="ref-target">
        Click me
      </Button>
      <Button variant="outline" onClick={() => clicks.value = 0} disabled={clicks.value === 0}>
        Reset
      </Button>
      <Button
        variant="outline"
        data-e2e="ref-focus"
        onClick={() => clickMeRef.current?.focus()}
      >
        Focus via ref
      </Button>
      <span class="text-sm text-muted">
        clicked {clicks.value} {clicks.value === 1 ? "time" : "times"}
      </span>
    </Cluster>
  )
}

/**
 * A press on "Confirm" makes it busy until "Finish" ends the work, standing in for a request.
 * The count proves a busy button ignores presses: it moves once however often Confirm is pressed.
 * `pages/checks/ui.ts` drives both buttons with real key presses.
 */
function BusyButtonDemo() {
  const busy = useSignal(false)
  const confirmations = useSignal(0)
  return (
    <Cluster>
      <Button
        busy={busy.value}
        busyLabel="Confirming…"
        data-e2e="busy-confirm"
        onClick={() => {
          busy.value = true
          confirmations.value += 1
        }}
      >
        Confirm
      </Button>
      <Button variant="outline" data-e2e="busy-finish" onClick={() => busy.value = false}>
        Finish
      </Button>
      <Button variant="icon" busy aria-label="Deleting">
        <IconPlus class="size-4" />
      </Button>
      <DemoNote>
        confirmed {confirmations.value} {confirmations.value === 1 ? "time" : "times"}
      </DemoNote>
    </Cluster>
  )
}

/**
 * A busy submit button inside a form: Enter in the field submits once, and the busy button then
 * cancels every later press, including the one the browser makes on it when Enter is pressed in
 * the field again. The submit count proves the form was not sent twice.
 */
function BusySubmitDemo() {
  const busy = useSignal(false)
  const submits = useSignal(0)
  return (
    <form
      data-e2e="busy-form"
      onSubmit={(event) => {
        event.preventDefault()
        busy.value = true
        submits.value += 1
      }}
    >
      <Cluster>
        <Input name="reference" aria-label="Reference" data-e2e="busy-form-field" />
        <Button type="submit" busy={busy.value} busyLabel="Saving…" data-e2e="busy-form-submit">
          Save
        </Button>
        <Button variant="outline" data-e2e="busy-form-finish" onClick={() => busy.value = false}>
          Finish
        </Button>
        <DemoNote>
          submitted {submits.value} {submits.value === 1 ? "time" : "times"}
        </DemoNote>
      </Cluster>
    </form>
  )
}

/**
 * The clipboard is a port: the first two buttons copy through the browser API, the third through
 * the injected callback, so the host app can route copies through its own clipboard service.
 */
function CopyButtonDemo() {
  const lastCopy = useSignal("nothing yet")
  return (
    <Stack>
      <Cluster>
        <CopyButton textToCopy="INV-0007" />
        <CopyButton textToCopy="INV-0007" title="Copy number" />
      </Cluster>
      <Cluster>
        <CopyButton
          textToCopy="INV-0007"
          title="Copy via port"
          copy={(text) => {
            lastCopy.value = text
          }}
        />
        <DemoNote>port received: {lastCopy.value}</DemoNote>
      </Cluster>
    </Stack>
  )
}

/**
 * One link with a `navigate` port that only records where it was asked to go, and one without.
 * A plain click on the first shows its href below instead of leaving the page; Ctrl, Meta, Shift,
 * Alt or a middle click opens it the browser's way. `pages/checks/ui.ts` drives both with real
 * clicks.
 */
function LinkDemo() {
  const navigated = useSignal<string[]>([])
  return (
    <Stack gap="sm">
      <Cluster>
        <Link
          href="#/system"
          class="pc-link"
          data-e2e="link-routed"
          navigate={(href) => navigated.value = [...navigated.value, href]}
        >
          Open the system page
        </Link>
        <Link href="https://jsr.io/@spy4x/preact-ui" class="pc-link" data-e2e="link-plain">
          The package on JSR
        </Link>
      </Cluster>
      <span class="text-sm text-muted" data-e2e="link-navigated">
        {navigated.value.length === 0
          ? "navigate not called yet"
          : `navigate called ${navigated.value.length} ${
            navigated.value.length === 1 ? "time" : "times"
          }, last with ${navigated.value.at(-1)}`}
      </span>
    </Stack>
  )
}

export const buttonDemos = {
  Button: {
    summary:
      "A native button in the library's variants and sizes; every other button attribute passes through.",
    wide: true,
    props: [
      {
        name: "variant",
        type: "ButtonVariant",
        default: `"primary"`,
        description: "One of the six looks in the rows above.",
      },
      {
        name: "size",
        type: `"sm" | "md" | "lg"`,
        default: `"md"`,
        description: "The button's height and padding.",
      },
      {
        name: "type",
        type: `"button" | "submit" | "reset"`,
        default: `"button"`,
        description: "A button submits a form only when you say so.",
      },
      {
        name: "busy",
        type: "boolean",
        default: "false",
        description:
          "Shows a spinner, sets `aria-busy` and ignores presses, but keeps focus on the button.",
      },
      {
        name: "busyLabel",
        type: "ComponentChildren",
        description: "Shown instead of the children while busy. An icon button shows no label.",
      },
      {
        name: "ref",
        type: "Ref<HTMLButtonElement>",
        description: "Reaches the native `<button>`, so it can be focused.",
      },
    ],
    snippet: `<Button variant="primary" size="md" onClick={save}>Save</Button>
<Button variant="danger" disabled>Delete</Button>
<Button type="submit" busy={saving.value} busyLabel="Confirming…">Confirm</Button>`,
    render: () => (
      <Stack gap="lg">
        <ButtonMatrix />
        <ButtonClickDemo />
        <BusyButtonDemo />
        <BusySubmitDemo />
      </Stack>
    ),
  },
  CopyButton: {
    summary: "Copies a piece of text to the clipboard, as an icon alone or with a title.",
    wide: false,
    props: [
      { name: "textToCopy", type: "string", description: "What lands on the clipboard." },
      {
        name: "title",
        type: "string",
        description: "A visible label; without it the button shows only the icon.",
      },
      {
        name: "copy",
        type: "(text) => void",
        default: "the clipboard",
        description: "Replaces the clipboard, to route copies through your own service.",
      },
    ],
    snippet: `<CopyButton textToCopy={invoice.id} />
<CopyButton textToCopy={invoice.id} title="Copy id" copy={app.clipboard.copy} />`,
    render: () => <CopyButtonDemo />,
  },
  Link: {
    summary:
      "A real link that hands plain clicks to your router and leaves new tabs, windows and downloads to the browser.",
    wide: false,
    props: [
      { name: "href", type: "string", description: "Where it goes; works before any script runs." },
      {
        name: "navigate",
        type: "(href) => void",
        description:
          "Called on a plain click instead of the browser navigating. Left out, every click is the browser's.",
      },
      {
        name: "onClick",
        type: "(event) => void",
        description: "Runs first; `preventDefault()` in it keeps `navigate` out of that click.",
      },
      {
        name: "class",
        type: "string",
        description:
          "The link has no look of its own; every other anchor attribute passes through.",
      },
    ],
    snippet: `<Link href="/reports" navigate={router.navigate} class="pc-link">Reports</Link>`,
    render: () => <LinkDemo />,
  },
} satisfies DemoFragment
