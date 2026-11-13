/**
 * `DecisionCard`'s card, spread at the end of the Feedback section: one card that walks a queue of
 * three items, a decision with a recommended option, a question and a to-do, the way an app moves
 * to the next item after each answer.
 *
 * The card on the page binds no key, because the guide page holds other demos that listen for `1`
 * and `n`. "Answer with the keyboard" opens the same queue in a `Modal`, as an app shows it on a
 * desktop: there the keys work, and the question takes focus as each item opens.
 * `pages/e2e/ui/decision-card.spec.ts` drives the keys, the focus and axe-core.
 */

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Cluster,
  DecisionCard,
  Modal,
  Stack,
} from "@spy4x/preact-ui"
import type { DecisionCardOption } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

interface QueueItem {
  id: string
  kind: string
  title: string
  meta: string
  context: string
  options?: DecisionCardOption[]
  /** The item takes a typed answer. */
  answer?: boolean
  /** The item is a to-do the reader marks done. */
  done?: boolean
}

/** The demo's queue. The recommended option is listed second, so the card's sorting shows. */
const QUEUE: readonly QueueItem[] = [
  {
    id: "release",
    kind: "Decision",
    title: "Release the billing fix today?",
    meta: "Asked by the release agent, 12 minutes ago",
    context:
      "The fix stops a second charge when a card payment is retried after a timeout. It passed every check, and two customers were charged twice this week. Releasing today means the change goes out at 18:00, after the evening's invoices are sent. Waiting a week bundles it with the tax update, which needs its own review. Dropping it leaves the retry as it is and refunds stay manual. The release notes are drafted; the support team has the reply ready. Nothing else in the queue depends on this answer, so it can wait if the risk feels wrong.",
    options: [
      { id: "wait", label: "Wait a week", description: "Ship it with the tax update." },
      {
        id: "ship",
        label: "Release today",
        description: "Goes out at 18:00.",
        recommended: true,
      },
      { id: "drop", label: "Drop the fix", description: "Refunds stay manual." },
    ],
  },
  {
    id: "region",
    kind: "Question",
    title: "Which region should the new server run in?",
    meta: "Asked by the infrastructure agent, an hour ago",
    context: "Most customers are in Europe; the backups already live in Falkenstein.",
    answer: true,
  },
  {
    id: "domain",
    kind: "To-do",
    title: "Renew the domain before it lapses",
    meta: "Due in 9 days",
    context: "The registrar charges the card on file. Renewing early keeps the same price.",
    done: true,
  },
]

/** The demo's queue position and last answer, shared by the card on the page and the dialog. */
interface QueueState {
  index: { value: number }
  last: { value: string }
  pending: boolean
}

/**
 * The card for the item at `state.index`. Answering it records the answer and moves to the next
 * item, which mounts afresh under its own `key`.
 */
function QueueCard(
  { state, live }: { state: QueueState; live: boolean },
) {
  const item = QUEUE[state.index.value]
  const next = (answer: string) => {
    state.last.value = answer
    state.index.value = (state.index.value + 1) % QUEUE.length
  }
  const withNote = (answer: string, note: string) => note === "" ? answer : `${answer} (${note})`
  return (
    <DecisionCard
      key={item.id}
      kind={item.kind}
      position={`Item ${state.index.value + 1} of ${QUEUE.length}`}
      title={item.title}
      meta={item.meta}
      context={item.context}
      options={item.options}
      onChoose={item.options && ((option, note) => next(withNote(option.label, note)))}
      onSend={item.options || item.answer ? (text) => next(`"${text}"`) : undefined}
      onDone={item.done ? (note) => next(withNote("Marked done", note)) : undefined}
      notice="Answers stay in this demo; nothing is sent."
      pending={state.pending}
      autoFocus={live}
      hotkeys={live}
    />
  )
}

function DecisionCardDemo() {
  const index = useSignal(0)
  const last = useSignal("")
  const pending = useSignal(false)
  const open = useSignal(false)
  const state = { index, last, pending: pending.value }
  return (
    <Stack gap="md">
      <Card data-e2e="decision-card">
        <CardBody>
          <QueueCard state={state} live={false} />
        </CardBody>
      </Card>
      <Cluster>
        <Button variant="secondary" data-e2e="decision-card-open" onClick={() => open.value = true}>
          Answer with the keyboard
        </Button>
        <Checkbox
          checked={pending.value}
          onChange={(event) => pending.value = event.currentTarget.checked}
          data-e2e="decision-card-pending"
        >
          Saving
        </Checkbox>
      </Cluster>
      <p role="status" class="text-sm text-muted" data-e2e="decision-card-last">
        {last.value === "" ? "No answer yet." : `Last answer: ${last.value}`}
      </p>
      {open.value && (
        <Modal
          open
          ariaLabel="Answer the queue"
          onClose={() => {
            open.value = false
          }}
          dataE2E="decision-card-dialog"
        >
          <QueueCard state={state} live />
        </Modal>
      )}
    </Stack>
  )
}

export const decisionCardDemos: DemoFragment = {
  DecisionCard: {
    summary:
      "One item of a queue to answer: options numbered 1 to 9 with the recommended one first, an own answer behind `n`, or Mark done on `e`.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "The question, drawn as the heading." },
      {
        name: "kind",
        type: "string",
        description: "A quiet badge above the question, such as Decision.",
      },
      {
        name: "position",
        type: "ComponentChildren",
        description: "Where the item sits in the queue, such as Decision 1 of 36.",
      },
      { name: "meta", type: "ComponentChildren", description: "A muted line under the question." },
      {
        name: "context",
        type: "string",
        description: "Plain text, never HTML; folded past 6 lines behind More.",
      },
      {
        name: "options",
        type: "{ id, label, description?, recommended? }[]",
        description: "One button each, all alike; the recommended one first; none preselected.",
      },
      {
        name: "onChoose",
        type: "(option, note: string) => void",
        description: "Called with the chosen option and the note.",
      },
      {
        name: "onSend",
        type: "(text: string) => void",
        description: "An own answer: open without options, behind the note's disclosure with them.",
      },
      {
        name: "onDone",
        type: "(note: string) => void",
        description: "Adds Mark done, pressed with `e`.",
      },
      { name: "notice", type: "ComponentChildren", description: "A quiet line at the bottom." },
      { name: "pending", type: "boolean", default: "false", description: "Disables every action." },
      {
        name: "headingLevel",
        type: "1 | 2 | 3 | 4 | 5 | 6",
        default: "2",
        description: "The question's heading level; `1` when the card is the page.",
      },
      {
        name: "autoFocus",
        type: "boolean",
        default: "false",
        description: "Focuses the question on mount; key each item so the next one mounts.",
      },
      {
        name: "hotkeys",
        type: "boolean",
        default: "true",
        description:
          "Turns `1` to `9`, `n`, `e` and `mod+enter` off, such as for a reader who switched single keys off.",
      },
      {
        name: "labels",
        type: "Partial<DecisionCardLabels>",
        description: "Replaces any English word: Recommended, More, Mark done and the rest.",
      },
    ],
    snippet: `<Modal open ariaLabel="Answer the queue" onClose={close}>
  <DecisionCard
    key={item.id}
    autoFocus
    kind="Decision"
    position={\`Decision \${index + 1} of \${items.length}\`}
    title={item.question}
    context={item.context}
    options={item.options} // one may carry recommended: true
    onChoose={(option, note) => answer(item, option, note)} // then show the next item
    onSend={(text) => answer(item, text)}
    pending={saving.value}
  />
</Modal>`,
    render: () => <DecisionCardDemo />,
  },
}
