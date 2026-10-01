import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  Cluster,
  CopyButton,
  Input,
  Link,
  Stack,
  ThemeToggle,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { createThemeStore } from "@spy4x/preact-signals/theme"
import { useEffect, useRef, useState } from "preact/hooks"
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
 * `Button` given `href`: a link that looks like the button beside it. The first has a `navigate`
 * port that only records where it was asked to go, so a plain click shows its href below instead
 * of leaving the page, while a Ctrl, Meta, Shift, Alt or middle click opens it the browser's way.
 * The disabled one has no href. The last is `size="none"`, sized by its own class.
 * `pages/checks/ui.ts` drives the first with real clicks and measures its focus ring.
 */
function ButtonLinkDemo() {
  const navigated = useSignal<string[]>([])
  return (
    <Stack gap="sm">
      <Cluster>
        <Button
          href="#/system"
          data-e2e="button-link-routed"
          navigate={(href) => navigated.value = [...navigated.value, href]}
        >
          Open the system page
        </Button>
        <Button href="https://jsr.io/@spy4x/preact-ui" variant="outline">
          The package on JSR
        </Button>
        <Button href="#/system" variant="outline" disabled data-e2e="button-link-disabled">
          Disabled link
        </Button>
        <Button href="#/system" variant="secondary" size="none" class="px-6 py-3">
          size="none", sized by class
        </Button>
      </Cluster>
      <span class="text-sm text-muted" data-e2e="button-link-navigated">
        {navigated.value.length === 0
          ? "navigate not called yet"
          : `navigate called ${navigated.value.length} ${
            navigated.value.length === 1 ? "time" : "times"
          }, last with ${navigated.value.at(-1)}`}
      </span>
    </Stack>
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
 * the injected callback, so the host app can route copies through its own clipboard service. The
 * fourth's port always fails, to show the failure state. `pages/checks/ui.ts` presses the fourth
 * twice, and drives the first two with a clipboard it replaces.
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
      <Cluster>
        <CopyButton textToCopy="INV-0007" title="Copy, then fail" copy={() => false} />
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

/**
 * A theme store of the card's own, so pressing the demo never changes the guide's palette: it keeps
 * nothing in storage and paints nothing (`apply` does nothing), and it reads the device's real
 * colour scheme, so the cycle starts from the opposite of whatever the device asks for. The readout
 * shows what an app's store would now paint.
 */
function ThemeToggleDemo() {
  const [store] = useState(() => createThemeStore({ storage: null, apply: () => {} }))
  useEffect(() => store.attach(), [store])
  return (
    <Stack gap="sm">
      <Cluster>
        <ThemeToggle store={store} />
        <DemoNote e2e="theme-toggle-readout">
          preference {store.preference.value}, an app would paint {store.actual.value}
        </DemoNote>
      </Cluster>
      <Cluster justify="between" data-e2e="theme-toggle-header">
        <span class="text-sm font-medium">At the end of a header</span>
        <ThemeToggle store={store} />
      </Cluster>
    </Stack>
  )
}

export const buttonDemos = {
  Button: {
    summary:
      "A native button in the library's variants and sizes, or a link that looks like one; every other attribute passes through.",
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
        type: `"sm" | "md" | "lg" | "none"`,
        default: `"md"`,
        description:
          'The button\'s height and padding. `"none"` sets no padding, gap or text size; size it with `class`.',
      },
      {
        name: "href",
        type: "string",
        description:
          "Renders an `<a>` with the same classes instead of a `<button>` (`ButtonLinkProps`).",
      },
      {
        name: "navigate",
        type: "(href) => void",
        description:
          "A link's router port: a plain click calls it instead of the browser navigating; modified clicks stay the browser's.",
      },
      {
        name: "disabled",
        type: "boolean",
        description:
          'On a link: drops `href`, sets `role="link"` and `aria-disabled`, and dims it; it leaves the tab order.',
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
<Button type="submit" busy={saving.value} busyLabel="Confirming…">Confirm</Button>
<Button href="/reports" navigate={router.navigate}>Reports</Button>
<Button href="/book" size="none" class="px-6 py-3">Book a call</Button>`,
    render: () => (
      <Stack gap="lg">
        <ButtonMatrix />
        <ButtonClickDemo />
        <BusyButtonDemo />
        <BusySubmitDemo />
        <ButtonLinkDemo />
      </Stack>
    ),
  },
  CopyButton: {
    summary: "Copies a piece of text to the clipboard, as an icon alone or with a title.",
    wide: false,
    props: [
      {
        name: "textToCopy",
        type: "string | () => string",
        description: "What lands on the clipboard; a function is read at click time.",
      },
      {
        name: "title",
        type: "string",
        description:
          "A visible label, replaced by the confirmation while it shows; without it, the icon alone.",
      },
      {
        name: "copy",
        type: "(text) => void | boolean | Promise",
        default: "the clipboard",
        description:
          "Replaces the clipboard; throwing, rejecting or returning false shows the failure state.",
      },
      {
        name: "copiedLabel",
        type: "string",
        default: `"Copied"`,
        description: "Shown and announced after a copy that worked.",
      },
      {
        name: "failedLabel",
        type: "string",
        default: `"Copy failed"`,
        description: "Shown and announced after a copy that failed.",
      },
      {
        name: "copiedForMs",
        type: "number",
        default: "1500",
        description: "How long either confirmation stays.",
      },
      {
        name: "data-*, id, …",
        type: "button attributes",
        description: "Passed to the button, for analytics among other things.",
      },
    ],
    snippet: `<CopyButton textToCopy={invoice.id} />
<CopyButton textToCopy={invoice.id} title="Copy id" copy={app.clipboard.copy} />
<CopyButton textToCopy={() => input.value} data-umami-event="copy-input" />`,
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
  ThemeToggle: {
    summary:
      "One icon button that steps the theme through auto, the opposite of the device and the device's own, with an Auto mode hint on the switch back to auto.",
    wide: false,
    props: [
      {
        name: "store",
        type: "ThemeToggleStore",
        description:
          "Your app's `createThemeStore()`; you call its `attach()`, the button calls `cycle()`.",
      },
      {
        name: "labels",
        type: "Partial<ThemeToggleLabels>",
        default: "English",
        description: "The accessible name for each state and the hint's text.",
      },
      {
        name: "hintForMs",
        type: "number",
        default: "2000",
        description: "How long the Auto mode hint stays up.",
      },
      {
        name: "class",
        type: "string",
        description: "Utilities appended to the wrapper around the button and its hint.",
      },
    ],
    snippet: `const theme = createThemeStore()
useEffect(() => theme.attach(), [])

<ThemeToggle store={theme} />`,
    render: () => <ThemeToggleDemo />,
  },
} satisfies DemoFragment
