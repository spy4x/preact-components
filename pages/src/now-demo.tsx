/**
 * The host page's demo of `useNow` from `@spy4x/preact-signals`: a hook, so it has no card in the
 * catalogue. `pages/checks/signals.ts` drives this section.
 *
 * The reading starts unmounted, so the prerendered page carries no build-time clock, and the
 * "show"/"hide" button mounts and unmounts it: unmounting is where the hook removes its timer and
 * its listener, and only a real unmount proves that.
 */

import { useNow } from "@spy4x/preact-signals/now"
import { buttonClasses } from "@spy4x/preact-ui/button"
import { useState } from "preact/hooks"

/** The current time as the hook last read it, in UTC. */
function NowReading() {
  const now = useNow({ zone: "UTC" })
  return (
    <output data-e2e="now-reading" class="font-mono text-sm">
      {now.value.toISOString()}
    </output>
  )
}

/** The section: what the hook does, and a reading to mount and unmount. */
export function NowDemo() {
  const [shown, setShown] = useState(false)

  return (
    <section data-e2e="now-demo" class="border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">The current day</h2>
      <p class="measure mt-2 text-sm text-gray-600 dark:text-gray-300">
        <code>useNow</code> from <code>@spy4x/preact-signals</code>{" "}
        holds the current time on a signal that moves at each midnight in a given zone (UTC here)
        and whenever this tab becomes visible again. Switch tabs and come back: the time below
        moves.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-e2e="now-toggle"
          onClick={() => setShown((current) => !current)}
          class={buttonClasses("outline", "sm", "font-mono")}
        >
          {shown ? "hide" : "show"}
        </button>
        {shown && <NowReading />}
      </div>
    </section>
  )
}
