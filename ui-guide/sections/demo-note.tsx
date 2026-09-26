import type { ComponentChildren } from "preact"

/** Props of {@link DemoNote}. */
export interface DemoNoteProps {
  children: ComponentChildren
  /** A `data-e2e` hook, for a readout a browser check reads. */
  e2e?: string
}

/**
 * A demo's small grey caption: what the example beside it shows, or a value a port received.
 *
 * @param props See {@link DemoNoteProps}.
 */
export function DemoNote({ children, e2e }: DemoNoteProps) {
  return <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e={e2e}>{children}</p>
}
