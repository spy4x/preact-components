import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  CopyButton,
  GeoButton,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import { useRef } from "preact/hooks"
import { IconPlus } from "@preact-components/icons"
import { entries } from "../record.ts"
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

const JOKE = "Why did the developer go broke? Because he used up all his cache!"

function ButtonMatrix() {
  return (
    <div class="space-y-3">
      {entries(sizes).map(([size, sizeLabel]) => (
        <div key={size} class="flex flex-wrap items-center gap-2">
          <span class="w-10 text-xs text-gray-500 dark:text-gray-400">{sizeLabel}</span>
          {entries(variants).map(([variant, label]) => (
            <Button key={variant} variant={variant} size={size} title={`${variant} ${size}`}>
              {variant === "icon" ? <IconPlus class="size-4" /> : label}
            </Button>
          ))}
        </div>
      ))}
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <Button disabled>Disabled</Button>
        <Button variant="danger" disabled>
          Disabled danger
        </Button>
      </div>
    </div>
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
    <div class="flex flex-wrap items-center gap-3">
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
    </div>
  )
}

/**
 * The clipboard is a port: the first button copies through the browser API, the second through
 * the injected callback, so the host app can route copies through its own clipboard service.
 */
function CopyButtonDemo() {
  const lastCopy = useSignal("nothing yet")
  return (
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <CopyButton textToCopy={JOKE} />
        <CopyButton textToCopy={JOKE} title="Copy the joke" />
        <CopyButton
          textToCopy="devices/00000000-0000-0000-0000-000000000000"
          title="Copy through the injected port"
          copy={(text) => {
            lastCopy.value = text
          }}
        />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">port received: {lastCopy.value}</p>
    </div>
  )
}

/** Geolocation is a port too: the coordinates land in local state instead of an app store. */
function GeoButtonDemo() {
  const result = useSignal("not asked yet")
  return (
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <GeoButton
          onLocation={(position) =>
            result.value = `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`}
          onError={(message) => result.value = message}
        />
        <GeoButton
          title="Ask for the position"
          onLocation={() => result.value = "located"}
          onError={(message) => result.value = message}
        >
          Locate
        </GeoButton>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        onLocation / onError: {result.value}
      </p>
    </div>
  )
}

export const buttonDemos = {
  Button: {
    summary:
      "Native button with the library's variant and size vocabulary. All other button attributes pass through; `type` defaults to `button`.",
    snippet: `<Button variant="primary" size="md" onClick={save}>Save</Button>
<Button variant="danger" disabled>Delete</Button>`,
    render: () => (
      <div class="space-y-4">
        <ButtonMatrix />
        <ButtonClickDemo />
      </div>
    ),
  },
  CopyButton: {
    summary:
      "Copies `textToCopy`, icon-only without `title`. The optional `copy` port replaces the browser clipboard.",
    snippet: `<CopyButton textToCopy={invoice.id} />
<CopyButton textToCopy={invoice.id} title="Copy id" copy={app.clipboard.copy} />`,
    render: () => <CopyButtonDemo />,
  },
  GeoButton: {
    summary:
      "Asks the browser for the current position and routes it to `onLocation`; failures become an `onError` message.",
    snippet: `<GeoButton
  onLocation={(position) => map.center.set(position)}
  onError={(message) => app.toast.error({ body: message })}
/>`,
    render: () => <GeoButtonDemo />,
  },
} satisfies DemoFragment
