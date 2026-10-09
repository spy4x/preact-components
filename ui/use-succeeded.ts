import { useEffect, useRef } from "preact/hooks"

/**
 * Calls `onDone` once when an action that was pending ends without failing: how a dialog learns
 * that its form went through and it can close.
 *
 * It fires only when `pending` goes from `true` to `false` while `failed` is falsy. Mounting with
 * `pending` already `false` does not fire, a failure does not fire, and neither does clearing the
 * failure afterwards. `failed` takes any value: a boolean, or the error itself, where any truthy
 * value counts as a failure. A new `onDone` closure on every render never fires it again: the hook
 * reacts to `pending` and `failed` only, and calls the `onDone` of the render that ended the
 * action.
 *
 * @param pending `true` while the action runs.
 * @param failed The action's failure; any truthy value means it failed.
 * @param onDone Runs after the action succeeds.
 */
export function useSucceeded(pending: boolean, failed: unknown, onDone: () => void): void {
  const was = useRef(pending)
  useEffect(() => {
    if (was.current && !pending && !failed) onDone()
    was.current = pending
  }, [pending, failed])
}
