/**
 * `Dock`'s card, spread at the end of the Feedback section after `DecisionCard`'s. The dock is
 * pinned to the window, so it would cover the guide; it shows only after "Show the dock". It holds
 * `DecisionCard`'s demo queue, one item at a time, with the count of items waiting on its toggle.
 *
 * The card binds `d` on the page to open and close the dock, the way an app would; inside the dock
 * `d` does nothing, and the item's keys (`1` to `9`, `n`, `e`) work only while focus is inside it.
 * "A new item arrives" adds an item at the end of the queue, to show that a change of content
 * never moves focus. `pages/e2e/ui/dock.spec.ts` drives the keys, Escape, the focus, the layout,
 * the toast offset and axe.
 */

import { Button, Cluster, DecisionCard, Dock, Stack, useHotkeys } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { QUEUE, type QueueItem } from "./decision-card.tsx"
import type { DemoFragment } from "../registry.ts"

/** An item in the dock's queue; `serial` keys it, since the demo's items come round again. */
interface Waiting {
  serial: number
  item: QueueItem
}

function DockDemo() {
  const shown = useSignal(false)
  const open = useSignal(true)
  const inside = useSignal(false)
  // Focus follows to the next item only after an answer given from inside the dock.
  const follow = useSignal(false)
  const queue = useSignal<readonly Waiting[]>(QUEUE.map((item, serial) => ({ serial, item })))
  const arrivals = useSignal(QUEUE.length)
  const last = useSignal("")
  useHotkeys(
    [{ keys: "d", description: "Open or close the dock", handler: () => open.value = !open.value }],
    { enabled: shown.value },
  )
  const current = queue.value[0]
  const next = (answer: string) => {
    last.value = answer
    follow.value = inside.value
    queue.value = queue.value.slice(1)
  }
  const arrive = () => {
    follow.value = false
    queue.value = [
      ...queue.value,
      { serial: arrivals.value, item: QUEUE[arrivals.value % QUEUE.length] },
    ]
    arrivals.value += 1
  }
  const withNote = (answer: string, note: string) => note === "" ? answer : `${answer} (${note})`
  return (
    <Stack gap="md">
      <p class="text-sm text-muted">
        Press D outside the dock to open or close it. Inside it, D does nothing, and the item's own
        keys work only there.
      </p>
      <Cluster>
        <Button
          variant="secondary"
          aria-pressed={shown.value}
          onClick={() => shown.value = !shown.value}
          data-e2e="dock-show"
        >
          Show the dock
        </Button>
        <Button variant="secondary" disabled={!shown.value} onClick={arrive} data-e2e="dock-arrive">
          A new item arrives
        </Button>
      </Cluster>
      <p role="status" class="text-sm text-muted" data-e2e="dock-last">
        {last.value === "" ? "No answer yet." : `Last answer: ${last.value}`}
      </p>
      {shown.value && (
        <Dock
          open={open.value}
          onOpenChange={(next) => open.value = next}
          label="Decisions"
          count={queue.value.length}
          header={
            <p class="text-xs text-muted">
              Answers stay in this demo; nothing is sent.
            </p>
          }
          onFocusWithinChange={(now) => inside.value = now}
        >
          {current === undefined
            ? <p class="text-sm text-muted">Nothing waits for you.</p>
            : (
              <DecisionCard
                key={current.serial}
                kind={current.item.kind}
                title={current.item.title}
                meta={current.item.meta}
                context={current.item.context}
                options={current.item.options}
                onChoose={current.item.options &&
                  ((option, note) => next(withNote(option.label, note)))}
                onSend={current.item.options || current.item.answer
                  ? (text) => next(`"${text}"`)
                  : undefined}
                onDone={current.item.done
                  ? (note) => next(withNote("Marked done", note))
                  : undefined}
                headingLevel={3}
                autoFocus={follow.value}
                hotkeys={inside.value}
              />
            )}
        </Dock>
      )}
    </Stack>
  )
}

export const dockDemos: DemoFragment = {
  Dock: {
    summary:
      "A panel pinned to the bottom-end corner of every page for what waits on the reader, such as decisions: one button with a count when collapsed, never modal.",
    props: [
      { name: "open", type: "boolean", description: "Whether the dock is expanded." },
      {
        name: "onOpenChange",
        type: "(open: boolean) => void",
        description: "Called by the toggle, and by Escape inside the dock.",
      },
      {
        name: "label",
        type: "string",
        description: "The toggle's text and the expanded region's name.",
      },
      {
        name: "count",
        type: "number",
        description: "A badge on the toggle, which is then named “Decisions: 3”.",
      },
      {
        name: "header",
        type: "ComponentChildren",
        description: "A fixed row above the content, which scrolls.",
      },
      {
        name: "onFocusWithinChange",
        type: "(inside: boolean) => void",
        description: "Tells whether focus is inside, such as to turn the content's keys on.",
      },
      {
        name: "labels",
        type: "Partial<DockLabels>",
        description: "Replaces the English toggle name.",
      },
    ],
    snippet: `const inside = useSignal(false)

<Dock
  open={open.value}
  onOpenChange={(next) => open.value = next}
  label="Decisions"
  count={items.length}
  onFocusWithinChange={(now) => inside.value = now}
>
  <DecisionCard
    key={item.id}
    title={item.question}
    options={item.options}
    onChoose={(option, note) => answer(item, option, note)} // set answeredInside = inside.value
    autoFocus={answeredInside.value} // focus follows only the reader's own answer
    hotkeys={inside.value} // 1 to 9, n and e only while focus is in the dock
  />
</Dock>`,
    render: () => <DockDemo />,
  },
}
