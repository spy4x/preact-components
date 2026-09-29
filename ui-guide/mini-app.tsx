/**
 * The overview's live mini app: a small dashboard built from nothing but the library's own
 * components, wired to local state.
 *
 * It exists to show a reader what an app built from these packages looks like before they read a
 * single card: a frame with a filter column, `Kpi` tiles and a `LineChart` from `charts/`, a
 * sortable `DataTable`, a button that raises a `Toastr` toast from a `createToastStore`, and a
 * `Modal` holding a `Field` form. Every number and row is neutral demo data written here; the
 * component holds no app state, reads no address and makes no request.
 *
 * Rules it keeps, from `AGENTS.md`'s wave-eight notes:
 *
 * - **No signal is read and written in one render.** Everything the render reads is `useState`, and
 *   every write happens in an event handler. The toast store's list is a signal, read here and
 *   written only by its own methods from handlers.
 * - **Server and browser render the same text.** Nothing depends on the clock, the locale or a
 *   browser API; the toast stack and the dialog are empty until a press, so the served markup and
 *   the first client render agree.
 *
 * The browser checks in `pages/checks/ui-guide.ts` find it by `data-e2e="mini-app"` and drive the
 * toast and the dialog by keyboard.
 */

import { KpiGrid } from "@spy4x/preact-charts/kpi"
import { Kpi } from "@spy4x/preact-charts/kpi"
import { LineChart, type LineSeries } from "@spy4x/preact-charts/line-chart"
import { IconPlus, IconRocket } from "@spy4x/preact-icons"
import { createToastStore } from "@spy4x/preact-signals/toast"
import { Badge, type BadgeColor } from "@spy4x/preact-ui/badge"
import { Button } from "@spy4x/preact-ui/button"
import { DataTable } from "@spy4x/preact-ui/data-table"
import { Field } from "@spy4x/preact-ui/field"
import { Input } from "@spy4x/preact-ui/input"
import { Cluster, Stack } from "@spy4x/preact-ui/layout"
import { Modal } from "@spy4x/preact-ui/modal"
import { Toastr } from "@spy4x/preact-ui/toastr"
import type { SortRule } from "@spy4x/platform/universal/sort"
import type { JSX } from "preact"
import { useId, useMemo, useState } from "preact/hooks"

/** A project's state, which the filter column and the status badge read. */
export type ProjectStatus = "healthy" | "building" | "failing" | "paused"

/** One row of the mini app's table. Neutral demo data: no person, price or invoice. */
export interface MiniProject {
  id: string
  name: string
  status: ProjectStatus
  builds: number
}

/** Each status's word and badge colour. A status with no entry does not compile. */
const STATUS: Record<ProjectStatus, { label: string; color: BadgeColor }> = {
  healthy: { label: "Healthy", color: "green" },
  building: { label: "Building", color: "blue" },
  failing: { label: "Failing", color: "red" },
  paused: { label: "Paused", color: "gray" },
}

/** The rows the app starts with. */
export const MINI_PROJECTS: readonly MiniProject[] = [
  { id: "atlas", name: "Atlas", status: "healthy", builds: 128 },
  { id: "beacon", name: "Beacon", status: "building", builds: 96 },
  { id: "comet", name: "Comet", status: "failing", builds: 41 },
  { id: "drift", name: "Drift", status: "healthy", builds: 212 },
  { id: "ember", name: "Ember", status: "paused", builds: 17 },
]

/** A week of builds, as literals: a chart fed from the clock would render differently every build. */
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const BUILDS: LineSeries[] = [
  {
    name: "Passed",
    points: days.map((day, index) => ({ x: day, y: [18, 24, 21, 30, 27, 12, 9][index] })),
  },
  {
    name: "Failed",
    points: days.map((day, index) => ({ x: day, y: [2, 1, 4, 2, 3, 0, 1][index] })),
  },
]

/** The filter column's entries: every project, then one per status. */
type Filter = "all" | ProjectStatus

/** How long the mini app's toast stays when nobody reads it: long enough to reach its dismiss. */
const TOAST_MS = 8_000

/** The words the mini app's own table and dialog print, as its frame's caller would write them. */
const COLUMN_HEADERS = { name: "Project", status: "Status", builds: "Builds" } as const

/**
 * The live mini app. Takes no props: it is a demo, and everything it shows is its own.
 *
 * @returns The app's frame.
 */
export function MiniApp(): JSX.Element {
  const [projects, setProjects] = useState<MiniProject[]>(() => [...MINI_PROJECTS])
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<SortRule<"name" | "status" | "builds">[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  // One store for the life of the app; it owns no timer, so nothing needs tearing down.
  const toasts = useMemo(() => createToastStore(), [])
  const formId = useId()
  const inputId = useId()

  const shown = filter === "all"
    ? projects
    : projects.filter((project) => project.status === filter)
  const count = (status: Filter) =>
    status === "all" ? projects.length : projects.filter((row) => row.status === status).length
  const totalBuilds = projects.reduce((total, project) => total + project.builds, 0)

  const closeDialog = () => {
    setDialogOpen(false)
    setDraft("")
    setError(null)
  }
  const create = (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = draft.trim()
    if (name.length === 0) {
      setError("Give the project a name.")
      return
    }
    setProjects([...projects, {
      id: `new-${projects.length}`,
      name,
      status: "building",
      builds: 0,
    }])
    setFilter("all")
    closeDialog()
    toasts.success({ body: `Project “${name}” created.`, duration: TOAST_MS })
  }

  return (
    <div
      data-e2e="mini-app"
      class="@container relative isolate overflow-hidden rounded-xl border border-subtle bg-surface text-left shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-lg bg-accent-900 text-accent-foreground dark:bg-accent-700">
            <IconRocket class="size-4" />
          </span>
          <span class="font-semibold text-foreground">Orbit</span>
          <Badge text="Demo" color="purple" type="outline" />
        </div>
        <Cluster>
          <Button
            variant="outline"
            size="sm"
            data-e2e="mini-app-toast"
            onClick={() =>
              toasts.info({
                body: `Checks queued for ${projects.length} projects.`,
                duration: TOAST_MS,
              })}
          >
            Run checks
          </Button>
          <Button size="sm" data-e2e="mini-app-new" onClick={() => setDialogOpen(true)}>
            <IconPlus class="size-4" />New project
          </Button>
        </Cluster>
        {
          /* Right after the buttons that raise it, so Tab from them reaches a toast's dismiss
          control next. Pinned to the frame's corner rather than the window's. */
        }
        <Toastr
          toasts={toasts.list.value}
          onDismiss={toasts.remove}
          dataE2E="mini-app-toasts"
          class="absolute top-auto right-4 bottom-4 left-4 z-10 ml-auto w-auto max-w-sm"
        />
      </div>

      <div class="flex flex-col @3xl:flex-row">
        <div
          role="group"
          aria-label="Filter projects by status"
          class="flex flex-wrap gap-1 border-b border-subtle p-2 @3xl:w-48 @3xl:shrink-0 @3xl:flex-col @3xl:border-r @3xl:border-b-0 @3xl:p-3"
        >
          {(["all", ...Object.keys(STATUS)] as Filter[]).map((entry) => (
            <Button
              key={entry}
              variant="ghost"
              size="sm"
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
              class="justify-between aria-pressed:bg-selected-soft aria-pressed:text-selected aria-pressed:hover:bg-selected-soft-hover"
            >
              <span>{entry === "all" ? "All projects" : STATUS[entry].label}</span>
              <span class="text-xs text-muted tabular-nums">
                {count(entry)}
              </span>
            </Button>
          ))}
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-4 p-4 @3xl:p-6">
          <KpiGrid minWidth="8rem">
            <Kpi label="Projects" value={projects.length} />
            <Kpi label="Builds" value={totalBuilds} sub="all time" tone="neutral" />
            <Kpi label="Failing" value={count("failing")} tone="negative" />
            <Kpi label="Median build" value="2m 41s" tone="neutral" />
          </KpiGrid>
          <div class="grid gap-4 @4xl:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4 rounded-lg border border-subtle p-4">
              <p class="text-sm font-semibold text-foreground">Builds this week</p>
              <LineChart
                series={BUILDS}
                ariaLabel="Builds this week"
                height={220}
                yDomain={[0, 40]}
                yFormat={(value) => value.toFixed(0)}
              />
            </div>
            <div class="min-w-0">
              <DataTable
                caption="Projects"
                captionHidden
                columns={[
                  { key: "name", header: COLUMN_HEADERS.name, sortable: true },
                  {
                    key: "status",
                    header: COLUMN_HEADERS.status,
                    sortable: true,
                    render: (row) => (
                      <Badge text={STATUS[row.status].label} color={STATUS[row.status].color} />
                    ),
                  },
                  { key: "builds", header: COLUMN_HEADERS.builds, sortable: true, align: "right" },
                ]}
                rows={shown}
                rowKey={(row) => row.id}
                sort={sort}
                onSortChange={setSort}
                empty="No project has this status."
                class="@max-lg:[&_:is(th,td)]:px-3"
              />
            </div>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <Modal
          open
          onClose={closeDialog}
          title="New project"
          cancelLabel="Close"
          dataE2E="mini-app-dialog"
          footer={
            <>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" form={formId} data-e2e="mini-app-create">Create</Button>
            </>
          }
        >
          <form id={formId} onSubmit={create} noValidate>
            <Stack gap="sm">
              <Field
                id={inputId}
                label="Project name"
                hint="It starts building as soon as it is created."
                error={error}
                required
              >
                <Input
                  value={draft}
                  autoFocus
                  autocomplete="off"
                  onInput={(event) => setDraft(event.currentTarget.value)}
                  data-e2e="mini-app-name"
                />
              </Field>
            </Stack>
          </form>
        </Modal>
      )}
    </div>
  )
}

/** The mini app's code, as the overview's code row shows and copies it: the shape, not every line. */
export const MINI_APP_SNIPPET = `import { Kpi, KpiGrid } from "@spy4x/preact-charts/kpi"
import { LineChart } from "@spy4x/preact-charts/line-chart"
import { createToastStore } from "@spy4x/preact-signals/toast"
import { Badge, Button, Cluster, DataTable, Field, Input, Modal, Toastr } from "@spy4x/preact-ui"
import { useMemo, useState } from "preact/hooks"

export function Dashboard({ projects }: { projects: Project[] }) {
  const toasts = useMemo(() => createToastStore(), [])
  const [sort, setSort] = useState([])
  const [open, setOpen] = useState(false)

  return (
    <>
      <Cluster>
        <Button variant="outline" onClick={() => toasts.info({ body: "Checks queued." })}>
          Run checks
        </Button>
        <Button onClick={() => setOpen(true)}>New project</Button>
      </Cluster>
      <Toastr toasts={toasts.list.value} onDismiss={toasts.remove} />

      <KpiGrid>
        <Kpi label="Projects" value={projects.length} />
        <Kpi label="Failing" value={1} tone="negative" />
      </KpiGrid>
      <LineChart ariaLabel="Builds this week" series={builds} />
      <DataTable
        caption="Projects"
        rows={projects}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        columns={[
          { key: "name", header: "Project", sortable: true },
          { key: "status", header: "Status", render: (row) => <Badge text={row.status} /> },
          { key: "builds", header: "Builds", sortable: true, align: "right" },
        ]}
      />

      {open && (
        <Modal open title="New project" onClose={() => setOpen(false)}>
          <Field id="name" label="Project name" required>
            <Input />
          </Field>
        </Modal>
      )}
    </>
  )
}`
