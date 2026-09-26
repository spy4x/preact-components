import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  Cluster,
  CopyButton,
  ExportButton,
  type ExportButtonColumn,
  GeoButton,
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

/** Geolocation is a port too: the coordinates land in local state instead of an app store. */
function GeoButtonDemo() {
  const result = useSignal("not asked yet")
  return (
    <Stack gap="sm">
      <Cluster>
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
      </Cluster>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        onLocation or onError: {result.value}
      </p>
    </Stack>
  )
}

/** A row of the demo table {@link ExportButtonDemo} writes to CSV. */
interface AttendeeRow {
  id: number
  name: string
  note: string
}

/** One row's `note` starts with `=`, on purpose — it is what proves the formula guard in the file. */
const attendeeRows: AttendeeRow[] = [
  { id: 1, name: "Ada Lovelace", note: "Bringing cake, tea for the room" },
  { id: 2, name: "Grace Hopper", note: "=SUM(A1:A2)" },
]

const attendeeColumns: ExportButtonColumn<AttendeeRow>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "note", header: "Note" },
]

/**
 * Two ways to supply rows: `rows` for data already in hand, `getRows` for "export everything the
 * current filter matches," fetched only once the button is pressed. Both write the same two rows
 * here, one of them a note that reads like a spreadsheet formula — opening the downloaded file
 * shows it prefixed with `'` instead of evaluated.
 */
function ExportButtonDemo() {
  return (
    <Cluster>
      <ExportButton
        columns={attendeeColumns}
        rows={attendeeRows}
        fileName="attendees.csv"
        class="js-export-rows"
      />
      <ExportButton
        columns={attendeeColumns}
        // 600ms rather than a near-instant resolve: long enough for a browser check to sample
        // focus mid-flight (proving it stays on the button while the export is pending, not only
        // once it settles), short enough not to make the catalogue feel sluggish to a visitor.
        getRows={() =>
          new Promise<AttendeeRow[]>((resolve) => setTimeout(() => resolve(attendeeRows), 600))}
        fileName="attendees-async.csv"
        label="Export (fetched)"
        class="js-export-async"
      />
    </Cluster>
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
  ExportButton: {
    summary:
      "Downloads a list of rows as a CSV file that a spreadsheet opens without running formulas.",
    wide: false,
    props: [
      {
        name: "columns",
        type: "ExportButtonColumn<T>[]",
        description: "Each column's row key and header.",
      },
      {
        name: "rows",
        type: "T[]",
        description: "Rows already in hand; or pass `getRows` instead.",
      },
      {
        name: "getRows",
        type: "() => T[] | Promise<T[]>",
        description: "Fetches the rows only when the button is pressed.",
      },
      { name: "fileName", type: "string", description: "The downloaded file's name." },
    ],
    snippet: `<ExportButton
  columns={[{ key: "id", header: "ID" }, { key: "name", header: "Name" }]}
  getRows={() => api.attendees.list()}
  fileName="attendees.csv"
/>`,
    render: () => <ExportButtonDemo />,
  },
  GeoButton: {
    summary: "Asks the browser where the user is and hands the position to your callback.",
    wide: true,
    snippet: `<GeoButton
  onLocation={(position) => map.center.set(position)}
  onError={(message) => app.toast.error({ body: message })}
/>`,
    render: () => <GeoButtonDemo />,
  },
} satisfies DemoFragment
