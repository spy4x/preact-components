/**
 * The dashboard cards of the `ui/` display section: a widget card in each of its states, the stat
 * body, the grid that lays widgets out, and the dialog that reorders and hides them.
 *
 * The cards render their real markup; the skeleton's delay, the retry and every change in the
 * dialog are proven in a browser by `pages/e2e/ui.spec.ts`.
 */

import { useSignal } from "@preact/signals"
import { Button } from "@spy4x/preact-ui/button"
import { DropdownItem } from "@spy4x/preact-ui/dropdown"
import { Cluster, Stack } from "@spy4x/preact-ui/layout"
import {
  LayoutCustomiser,
  type LayoutEntry,
  mergeLayout,
  setLayoutHidden,
} from "@spy4x/preact-ui/layout-customiser"
import {
  DashboardGrid,
  WidgetCard,
  WidgetStat,
  type WidgetStatus,
} from "@spy4x/preact-ui/widget-card"
import type { DemoFragment } from "../registry.ts"
import { DemoNote } from "./demo-note.tsx"

/** The demo dashboard's widgets, in their default order. */
const demoWidgets = [
  { id: "count", title: "Notes", size: "stat" },
  { id: "changed", title: "Notes changed", size: "stat" },
  { id: "trend", title: "Notes over time", size: "full" },
] as const

const statuses: readonly WidgetStatus[] = ["ready", "loading", "error", "empty"]

/** A widget card whose status the reader switches, and whose retry is counted. */
function WidgetCardDemo() {
  const status = useSignal<WidgetStatus>("ready")
  const retries = useSignal(0)
  return (
    <Stack gap="sm">
      <Cluster gap="sm">
        {statuses.map((each) => (
          <Button
            key={each}
            variant={status.value === each ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={status.value === each ? "true" : "false"}
            data-e2e={`widget-status-${each}`}
            onClick={() => status.value = each}
          >
            {each}
          </Button>
        ))}
      </Cluster>
      <WidgetCard
        title="Notes"
        caption="In the group now"
        status={status.value}
        loadingLabel="Loading the note count"
        errorMessage="We could not load the note count. Check your connection and try again."
        onRetry={() => {
          retries.value++
          status.value = "loading"
        }}
        emptyLabel="No notes yet"
        menu={<DropdownItem onClick={() => status.value = "empty"}>Hide widget</DropdownItem>}
        dataE2E="widget-card-demo"
      >
        <WidgetStat value={31} lines={["+4 vs previous 30 days"]} />
      </WidgetCard>
      <DemoNote e2e="widget-retries">Retries: {retries.value}</DemoNote>
    </Stack>
  )
}

/** A dashboard with a customise dialog: the grid follows every change the dialog reports. */
function LayoutCustomiserDemo() {
  const layout = useSignal<LayoutEntry[]>(mergeLayout(null, demoWidgets.map((each) => each.id)))
  const open = useSignal(false)
  const changes = useSignal(0)
  const titled = layout.value.map((entry) => ({
    ...entry,
    title: demoWidgets.find((each) => each.id === entry.id)?.title ?? entry.id,
  }))
  const apply = (next: LayoutEntry[]) => {
    changes.value++
    layout.value = next
  }
  return (
    <Stack gap="sm">
      <Cluster justify="between">
        <DemoNote e2e="layout-order">
          Shown: {titled.filter((each) => !each.hidden).map((each) => each.title).join(", ") ||
            "none"}
        </DemoNote>
        <Button variant="outline" data-e2e="layout-open" onClick={() => open.value = true}>
          Customise
        </Button>
      </Cluster>
      <DemoNote e2e="layout-changes">Changes: {changes.value}</DemoNote>
      <DashboardGrid
        label="Widgets"
        items={layout.value.filter((entry) => !entry.hidden).map((entry) => {
          const widget = demoWidgets.find((each) => each.id === entry.id)!
          return {
            id: widget.id,
            size: widget.size,
            content: (
              <WidgetCard
                title={widget.title}
                status="ready"
                size={widget.size}
                loadingLabel={`Loading ${widget.title}`}
                menu={
                  <DropdownItem
                    onClick={() => apply(setLayoutHidden(layout.value, widget.id, true))}
                  >
                    Hide widget
                  </DropdownItem>
                }
              >
                <WidgetStat value={widget.size === "stat" ? 12 : "…"} />
              </WidgetCard>
            ),
          }
        })}
      />
      <LayoutCustomiser
        open={open.value}
        onClose={() => open.value = false}
        title="Customise overview"
        description="Choose which widgets you see and their order."
        items={titled}
        onChange={apply}
        onReset={() => apply(mergeLayout(null, demoWidgets.map((each) => each.id)))}
        labels={{ list: "Widgets" }}
        dataE2E="layout-customiser"
      />
    </Stack>
  )
}

/** The dashboard cards, merged into the display section. */
export const dashboardDemos = {
  WidgetCard: {
    summary:
      "One dashboard widget's card, with a title, a muted caption, its own menu, and a body that loads, fails with a retry or goes empty on its own.",
    wide: false,
    props: [
      {
        name: "status",
        type: `"loading" | "error" | "empty" | "ready"`,
        description: "Which body to draw; the skeleton waits 300 ms before it shows.",
      },
      { name: "title", type: "string", description: "The heading; with `href`, a link." },
      {
        name: "menu",
        type: "ComponentChildren",
        description: "`DropdownItem`s for the card's three-dots menu.",
      },
      {
        name: "onRetry",
        type: "() => void",
        description: "Reads the widget again from the error body's button.",
      },
    ],
    snippet: `<WidgetCard
  title="Notes"
  caption="In the group now"
  status={count.status}
  loadingLabel="Loading the note count"
  errorMessage="We could not load the note count."
  onRetry={count.reload}
  menu={<DropdownItem onClick={hide}>Hide widget</DropdownItem>}
>
  <WidgetStat value={count.value} lines={["+4 vs previous 30 days"]} />
</WidgetCard>`,
    render: () => <WidgetCardDemo />,
  },
  WidgetStat: {
    summary:
      "A stat widget's body: one large number in tabular figures and muted lines under it, never coloured as good or bad.",
    wide: false,
    props: [
      { name: "value", type: "string | number", description: "The number, already formatted." },
      {
        name: "lines",
        type: "ComponentChildren[]",
        description: "What it counts, and its change against the period before.",
      },
    ],
    snippet: `<WidgetStat value="1.2M" valueLabel="1,234,567" lines={["In the group now"]} />`,
    render: () => (
      <WidgetStat value={9} lines={["Added or edited in this range", "−2 vs previous 30 days"]} />
    ),
  },
  DashboardGrid: {
    summary:
      "Lays widgets out in order, consecutive stats sharing one row that fills the width and each full widget on a row of its own.",
    wide: true,
    props: [
      {
        name: "items",
        type: `{ id, size: "stat" | "full", content }[]`,
        description: "The widgets, in the order they are shown.",
      },
      { name: "label", type: "string", description: "The region's accessible name." },
    ],
    snippet:
      `<DashboardGrid label="Widgets" items={widgets.map((w) => ({ id: w.id, size: w.size, content: w.render() }))} />`,
    render: () => (
      <DashboardGrid
        label="Demo widgets"
        items={demoWidgets.map((widget) => ({
          id: widget.id,
          size: widget.size,
          content: (
            <WidgetCard title={widget.title} status="ready" loadingLabel="Loading">
              <WidgetStat value={widget.size === "stat" ? 12 : "…"} />
            </WidgetCard>
          ),
        }))}
      />
    ),
  },
  LayoutCustomiser: {
    summary:
      "A dialog that reorders and hides a page's parts with a sortable list and a switch per row, reporting every change at once so there is nothing to save.",
    wide: true,
    props: [
      {
        name: "items",
        type: "{ id, title, hidden }[]",
        description: "Every part the person may see, in the current order.",
      },
      {
        name: "onChange",
        type: "(layout: { id, hidden }[]) => void",
        description: "The whole new layout after one move or one switch.",
      },
      { name: "onReset", type: "() => void", description: "Puts the default layout back." },
      {
        name: "error",
        type: "string | null",
        description: "Why the last change could not be saved.",
      },
    ],
    snippet: `<LayoutCustomiser
  open={open.value}
  onClose={() => open.value = false}
  title="Customise overview"
  items={mergeLayout(saved, available).map((e) => ({ ...e, title: titleOf(e.id) }))}
  onChange={save}
  onReset={() => save(mergeLayout(null, available))}
/>`,
    render: () => <LayoutCustomiserDemo />,
  },
} satisfies DemoFragment
