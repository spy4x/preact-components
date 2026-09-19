/**
 * The Signals section.
 *
 * A placeholder: the section is being written. `For` and `Show` are the package's only components —
 * everything else in `signals/` is a factory or a pure function an app calls itself — so both cards
 * exist from the start and neither is made of more than a signal.
 *
 * The stores are the part a reader actually struggles with (`buildModelStore`, `createListState`,
 * `createTableState`, `useUrlFilters`), and they need a written-up live example rather than a card:
 * they are listed as helpers in `../registry.ts`, not as pending demos.
 */

import { For, Show } from "@preact-components/signals/signals"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

/** Each signal is created per render, so two catalogues never share one. */
function ForDemo() {
  const each = useSignal(["alpha", "beta", "gamma"])

  return (
    <ul class="list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
      <For each={each}>{(value, index) => <li>{`${index + 1}. ${String(value)}`}</li>}</For>
    </ul>
  )
}

/** `Show` takes a signal rather than a boolean, even when nothing ever flips it. */
function ShowDemo() {
  const visible = useSignal(true)

  return (
    <div class="space-y-2 text-sm text-gray-700 dark:text-gray-200">
      <Show when={visible} fallback={<p>hidden</p>}>
        {(value) => <p>{`shown, and the signal's value is ${String(value)}`}</p>}
      </Show>
      <button
        type="button"
        class="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
        onClick={() => (visible.value = !visible.value)}
      >
        Toggle
      </button>
    </div>
  )
}

export const signalsDemos = {
  For: {
    summary:
      "Placeholder — this section is being written. Renders a signal's array by keying each item on its own identity, so an append keeps the rows above it mounted. `children` is a function; `fallback` covers an absent array, not an empty one.",
    snippet: `<For each={items}>{(value, index) => <li>{index}: {value}</li>}</For>`,
    render: () => <ForDemo />,
  },
  Show: {
    summary:
      "Placeholder — this section is being written. Renders `children` while a signal is truthy and `fallback` otherwise; `children` may be a function of the value, which is how a narrowed value reaches the JSX.",
    snippet: `<Show when={visible} fallback={<p>hidden</p>}>
  {(value) => <p>{value}</p>}
</Show>`,
    render: () => <ShowDemo />,
  },
} satisfies DemoFragment<"For" | "Show">
