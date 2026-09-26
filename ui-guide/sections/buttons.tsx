import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  Cluster,
  CopyButton,
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
          <span class="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">{sizeLabel}</span>
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
        <span class="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">disabled</span>
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
      <span class="text-sm text-gray-600 dark:text-gray-300">
        clicked {clicks.value} {clicks.value === 1 ? "time" : "times"}
      </span>
    </Cluster>
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
        name: "ref",
        type: "Ref<HTMLButtonElement>",
        description: "Reaches the native `<button>`, so it can be focused.",
      },
    ],
    snippet: `<Button variant="primary" size="md" onClick={save}>Save</Button>
<Button variant="danger" disabled>Delete</Button>`,
    render: () => (
      <Stack gap="lg">
        <ButtonMatrix />
        <ButtonClickDemo />
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
} satisfies DemoFragment
