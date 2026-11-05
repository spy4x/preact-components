/**
 * The host page's demo of `enhanceChecklist` from `@spy4x/preact-ui`: a helper that wires
 * server-rendered checkboxes, so it has no card in the catalogue. `pages/e2e/ui.spec.ts` drives
 * this section: a tick survives a reload, reaches a second tab, and Clear ticks then Undo puts the
 * same ticks back.
 */

import { useSignal } from "@preact/signals"
import { buttonClasses } from "@spy4x/preact-ui/button"
import {
  type ChecklistControl,
  type ChecklistState,
  enhanceChecklist,
} from "@spy4x/preact-ui/checklist"
import { useEffect, useRef } from "preact/hooks"

/** The storage key; the browser check reads the same one. */
export const CHECKLIST_DEMO_KEY = "preact-components.guide-checklist.v1"

/** Two sections of checkboxes with stable ids, as a server would render them. */
const SECTIONS = [
  {
    section: "security",
    title: "Security",
    items: [["checklist-demo-backups", "Backups restore"], [
      "checklist-demo-2fa",
      "Two-factor sign-in",
    ]],
  },
  {
    section: "legal",
    title: "Legal",
    items: [["checklist-demo-terms", "Terms published"], [
      "checklist-demo-privacy",
      "Privacy policy published",
    ]],
  },
]

const TOTAL = SECTIONS.reduce((sum, group) => sum + group.items.length, 0)

/** The section: the list, its count, and Clear ticks with Undo built on `clear` and `restore`. */
export function ChecklistDemo() {
  const list = useRef<HTMLDivElement>(null)
  const control = useRef<ChecklistControl>()
  const checked = useSignal(0)
  const cleared = useSignal<string[]>([])

  useEffect(() => {
    if (!list.current) return
    control.current = enhanceChecklist(list.current, {
      key: CHECKLIST_DEMO_KEY,
      storage: () => localStorage,
      onChange: (state: ChecklistState) => {
        checked.value = state.checked
      },
    })
    return control.current
  }, [])

  return (
    <section data-e2e="checklist" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        A checklist that remembers
      </h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>enhanceChecklist</code> from <code>@spy4x/preact-ui</code>{" "}
        keeps these ticks in this browser: reload the page or open it in a second tab and they are
        still there.
      </p>
      <div ref={list} class="mt-3 flex flex-col gap-4">
        {SECTIONS.map((group) => (
          <div key={group.section} data-checklist-section={group.section}>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.title}</h3>
            <ul role="list" class="mt-2 flex flex-col gap-2">
              {group.items.map(([id, title]) => (
                <li key={id} class="flex items-center gap-2">
                  <input type="checkbox" id={id} class="pc-checkbox" />
                  <label for={id} class="text-sm">{title}</label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <p data-e2e="checklist-count" class="text-sm text-gray-600 dark:text-gray-300">
          {`${checked.value} of ${TOTAL} checked`}
        </p>
        {cleared.value.length > 0
          ? (
            <button
              type="button"
              class={buttonClasses("ghost", "sm")}
              onClick={() => {
                control.current?.restore(cleared.value)
                cleared.value = []
              }}
            >
              Undo
            </button>
          )
          : checked.value > 0 && (
            <button
              type="button"
              class={buttonClasses("ghost", "sm")}
              onClick={() => {
                cleared.value = control.current?.clear() ?? []
              }}
            >
              Clear ticks
            </button>
          )}
      </div>
    </section>
  )
}
