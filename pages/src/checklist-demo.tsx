/**
 * The host page's demo of `enhanceChecklist` from `@spy4x/preact-ui`: a helper that wires
 * server-rendered checkboxes, so it has no card in the catalogue. It follows the checklist row of
 * `docs/design-language.md`. `pages/e2e/ui.spec.ts` drives this section: a tick survives a reload,
 * reaches a second tab, Clear ticks is announced and moves focus to Undo, Undo puts the same ticks
 * back, and Undo goes away after `UNDO_MS`.
 */

import { useSignal } from "@preact/signals"
import { buttonClasses } from "@spy4x/preact-ui/button"
import {
  type ChecklistControl,
  type ChecklistState,
  enhanceChecklist,
} from "@spy4x/preact-ui/checklist"
import { Progress } from "@spy4x/preact-ui/progress"
import { useEffect, useRef } from "preact/hooks"

/** The storage key; the browser check reads the same one. */
export const CHECKLIST_DEMO_KEY = "preact-components.guide-checklist.v1"

/** How long Undo stays after Clear ticks; the browser check moves its clock past it. */
export const UNDO_MS = 10_000

/** What the live region says after Clear ticks; the browser check reads the same text. */
export const CLEARED_MESSAGE = "Ticks cleared. Undo is available."

/** Two sections of checkboxes with stable ids, as a server would render them. */
const SECTIONS = [
  {
    section: "security",
    title: "Security",
    items: [
      ["checklist-demo-backups", "Backups restore", "Restore last night's backup once, for real."],
      ["checklist-demo-2fa", "Two-factor sign-in", "Every admin account has it turned on."],
    ],
  },
  {
    section: "legal",
    title: "Legal",
    items: [
      ["checklist-demo-terms", "Terms published", "Linked from the footer and the sign-up form."],
      ["checklist-demo-privacy", "Privacy policy published", "It names every service you use."],
    ],
  },
]

const TOTAL = SECTIONS.reduce((sum, group) => sum + group.items.length, 0)

/** Where focus goes after the next render. */
type FocusTarget = "undo" | "clear" | "first-box"

/**
 * The section: the list, its count and progress bar, a polite live region, and Clear ticks with an
 * Undo built on `clear` and `restore` that goes away after `UNDO_MS`.
 */
export function ChecklistDemo() {
  const list = useRef<HTMLDivElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const clearButton = useRef<HTMLButtonElement>(null)
  const control = useRef<ChecklistControl>()
  const undoTimer = useRef<ReturnType<typeof setTimeout>>()
  const focusNext = useRef<FocusTarget>()
  const checked = useSignal(0)
  const cleared = useSignal<string[]>([])
  const spoken = useSignal("")

  const dropUndo = () => {
    clearTimeout(undoTimer.current)
    cleared.value = []
  }

  useEffect(() => {
    if (!list.current) return
    let started = false
    const unwire = enhanceChecklist(list.current, {
      key: CHECKLIST_DEMO_KEY,
      storage: () => localStorage,
      onChange: (state: ChecklistState) => {
        // The first report is the stored ticks coming back, which nobody needs to hear.
        if (started && state.checked === state.total && checked.value < state.total) {
          spoken.value = "All checked"
        }
        started = true
        checked.value = state.checked
        // A new tick after Clear makes the cleared ticks stale, so their Undo goes.
        if (state.checked > 0 && cleared.value.length > 0) dropUndo()
      },
    })
    control.current = unwire
    return () => {
      unwire()
      clearTimeout(undoTimer.current)
    }
  }, [])

  // Runs after every render, so the button it focuses exists by then.
  useEffect(() => {
    const target = focusNext.current
    focusNext.current = undefined
    if (target === "undo") undoButton.current?.focus()
    if (target === "clear") clearButton.current?.focus()
    if (target === "first-box") list.current?.querySelector("input")?.focus()
  })

  const clearTicks = () => {
    const ids = control.current?.clear() ?? []
    if (ids.length === 0) return
    cleared.value = ids
    spoken.value = CLEARED_MESSAGE
    focusNext.current = "undo"
    undoTimer.current = setTimeout(() => {
      // Focus on the vanishing button would fall to the page's start; keep it in the list.
      if (document.activeElement === undoButton.current) focusNext.current = "first-box"
      cleared.value = []
    }, UNDO_MS)
  }

  const undo = () => {
    const ids = cleared.value
    dropUndo()
    focusNext.current = "clear"
    control.current?.restore(ids)
    spoken.value = "Ticks restored"
  }

  const all = checked.value === TOTAL
  return (
    <section data-e2e="checklist" class="border-t border-subtle pt-6">
      <h2 class="text-lg font-semibold">A checklist that remembers</h2>
      <p class="measure mt-2 text-sm text-muted">
        <code>enhanceChecklist</code> from <code>@spy4x/preact-ui</code>{" "}
        keeps these ticks in this browser: reload the page or open it in a second tab and they are
        still there.
      </p>
      <div ref={list} class="mt-3 flex flex-col gap-4">
        {SECTIONS.map((group) => (
          <div key={group.section} data-checklist-section={group.section}>
            <h3 class="text-sm font-semibold">{group.title}</h3>
            <ul role="list" class="mt-2 flex flex-col gap-3">
              {group.items.map(([id, title, hint]) => (
                <li key={id} class="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={id}
                    aria-describedby={`${id}-hint`}
                    class="pc-checkbox peer mt-px"
                  />
                  <div class="flex flex-col text-sm peer-checked:text-muted">
                    <label for={id}>{title}</label>
                    <p id={`${id}-hint`} class="text-xs text-muted">{hint}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* `min-h-8` is the small button's height, so Clear and Undo appearing move nothing below. */}
      <div class="mt-3 flex min-h-8 items-center gap-3">
        <p data-e2e="checklist-count" class="shrink-0 text-sm text-muted">
          {`${checked.value} of ${TOTAL} checked`}
        </p>
        <Progress
          value={checked.value}
          max={TOTAL}
          showValue={false}
          tone={all ? "success" : "primary"}
          ariaLabel="Checklist progress"
          class="w-24 shrink-0"
        />
        {cleared.value.length > 0
          ? (
            <button
              key="undo"
              ref={undoButton}
              type="button"
              class={buttonClasses("ghost", "sm")}
              onClick={undo}
            >
              Undo
            </button>
          )
          : checked.value > 0 && (
            <button
              key="clear"
              ref={clearButton}
              type="button"
              class={buttonClasses("ghost", "sm")}
              onClick={clearTicks}
            >
              Clear ticks
            </button>
          )}
      </div>
      <p data-e2e="checklist-live" role="status" aria-live="polite" class="sr-only">
        {spoken.value}
      </p>
    </section>
  )
}
