/**
 * The live `Timeline` demo: a made-up build run that adds a step every couple of seconds, inside
 * a box that scrolls, so following, the "new events" button and Pause can be tried in place.
 */

import { useSignal } from "@preact/signals"
import { Timeline, type TimelineItem, type TimelineTone } from "@spy4x/preact-ui"
import type { JSX } from "preact"
import { useEffect } from "preact/hooks"

/** How often the demo's run adds a step; the browser spec moves the page's clock by it. */
export const LIVE_TIMELINE_TICK_MS = 2000

/** The demo keeps only its latest steps, as a caller showing a window of a long run would. */
export const LIVE_TIMELINE_KEEP = 8

/** The steps the run cycles through. */
const STEPS: readonly { title: string; tone?: TimelineTone; description?: string }[] = [
  { title: "Cloned the repository", description: "main at 4f2a91c" },
  { title: "Installed dependencies" },
  { title: "Ran the linter", tone: "warning", description: "2 warnings" },
  { title: "Ran 128 tests", tone: "success" },
  { title: "Built the bundle", description: "412 kB" },
  { title: "Uploaded the artifact" },
  { title: "Retried a flaky test", tone: "danger", description: "Timed out after 30 s" },
  { title: "Deployed to staging", tone: "success" },
]

/** Step `index` of the run, ten seconds after the one before it. */
function step(index: number): TimelineItem {
  const seconds = index * 10
  const clock = `10:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${
    String(seconds % 60).padStart(2, "0")
  }`
  return {
    id: index,
    ...STEPS[index % STEPS.length],
    at: `2026-03-04T${clock}Z`,
    when: clock,
  }
}

/** The steps the demo starts with: few enough that the end shows on a phone, so it follows. */
export const LIVE_TIMELINE_START = 2

/**
 * A live timeline fed by a timer, stopped when the card unmounts. The box has a fixed height, so a
 * new step never moves the rest of the page while the run fills it.
 */
export function LiveTimelineDemo(): JSX.Element {
  const items = useSignal<TimelineItem[]>(
    Array.from({ length: LIVE_TIMELINE_START }, (_, index) => step(index)),
  )
  useEffect(() => {
    const timer = setInterval(() => {
      const last = items.value[items.value.length - 1]
      items.value = [...items.value, step(Number(last.id) + 1)].slice(-LIVE_TIMELINE_KEEP)
    }, LIVE_TIMELINE_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return (
    <div
      class="h-72 overflow-y-auto rounded-lg border border-subtle p-4"
      data-e2e="timeline-live-box"
    >
      <Timeline live label="Build run" items={items.value} dataE2E="timeline-live" />
    </div>
  )
}
