/**
 * What `SWUpdater` needs that is no part of its public surface: how its words are resolved.
 * Internal to this package, so it is not in the package's exports; `sw-updater.test.tsx` imports
 * it from here.
 *
 * @module
 */

import {
  DEFAULT_SW_UPDATER_LABELS,
  type SWUpdaterLabels,
  type SWUpdaterProps,
} from "./sw-updater.tsx"

/**
 * The bar's words: `labels` over {@link DEFAULT_SW_UPDATER_LABELS}, and each deprecated prop
 * (`message`, `reloadLabel`, `dismissLabel`) over its label when passed.
 */
export function swUpdaterWords(
  props: Pick<SWUpdaterProps, "labels" | "message" | "reloadLabel" | "dismissLabel">,
): SWUpdaterLabels {
  const words = { ...DEFAULT_SW_UPDATER_LABELS, ...props.labels }
  return {
    message: props.message ?? words.message,
    reload: props.reloadLabel ?? words.reload,
    dismiss: props.dismissLabel ?? words.dismiss,
  }
}
