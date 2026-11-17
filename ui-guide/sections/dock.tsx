/**
 * `Dock`'s card, spread at the end of the Feedback section after `DecisionCard`'s. The dock is
 * pinned to the window, so it would cover the guide; it shows only after "Show the dock". It holds
 * `DecisionCard`'s demo queue, one item at a time, with the count of items left on its toggle.
 *
 * The card binds `d` on the page to open and close the dock, the way an app would; inside the dock
 * `d` does nothing, and the card's keys (`1` to `9`, `n`, `e`) work only while focus is inside it.
 * "A new item arrives" puts an answered item back, to show that a change of content never moves
 * focus. `pages/e2e/ui/dock.spec.ts` drives the keys, Escape, the focus, the toast offset and axe.
 */

import { Button, Cluster, DecisionCard, Dock, Stack, useHotkeys } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { QUEUE } from "./decision-card.tsx"
import type { DemoFragment } from "../registry.ts"

function DockDemo() {
  const shown = useSignal(false)
  const open = useSignal(true)
  const inside = useSignal(false)
  const answered = useSignal(0)
  const last = useSignal("")
  useHotkeys(
    [{ keys: "d", description: "Open or close the dock", handler: () => open.value = !open.value }],
    { enabled: shown.value },
  )
  const left = QUEUE.length - answered.value
  const item = QUEUE[answered.value]
  const next = (answer: string) => {
    last.value = answer
    answered.value += 1
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
        <Button
          variant="secondary"
          disabled={!shown.value || answered.value === 0}
          onClick={() => answered.value -= 1}
          data-e2e="dock-arrive"
        >
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
          count={left}
          header={
            <p class="text-xs text-muted" data-e2e="dock-position">
              {left === 0 ? "All answered" : `Item ${answered.value + 1} of ${QUEUE.length}`}
            </p>
          }
          onFocusWithinChange={(now) => inside.value = now}
        >
          {item === undefined
            ? <p class="text-sm text-muted">Nothing waits for you.</p>
            : (
              <DecisionCard
                key={item.id}
                kind={item.kind}
                title={item.title}
                meta={item.meta}
                context={item.context}
                options={item.options}
                onChoose={item.options && ((option, note) => next(withNote(option.label, note)))}
                onSend={item.options || item.answer ? (text) => next(`"${text}"`) : undefined}
                onDone={item.done ? (note) => next(withNote("Marked done", note)) : undefined}
                headingLevel={3}
                autoFocus={inside.value}
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
    onChoose={(option, note) => answer(item, option, note)}
    autoFocus={inside.value} // only follow the reader's own answer
    hotkeys={inside.value} // 1 to 9, n and e only while focus is in the dock
  />
</Dock>`,
    render: () => <DockDemo />,
  },
}
