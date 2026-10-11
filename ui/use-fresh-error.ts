import { useEffect, useState } from "preact/hooks"

/** What {@link useFreshError} holds as stale while no error is. No error can be equal to it. */
const NOTHING = Symbol("nothing")

/**
 * Hides an error left from an earlier attempt, so a dialog opened again does not start on the last
 * refusal.
 *
 * It returns the error to show and a function to call when the dialog opens. The error that is
 * there at that call is stale: the hook returns `null` in its place until the next attempt starts
 * (`pending` turns `true`). From then on every error is shown again, including one equal to the
 * stale one, so a second refusal with the same message is not swallowed.
 *
 * An error is compared by identity (`Object.is`): a message string by its text, an object by
 * reference. `undefined` counts as no error, and comes back as `null`.
 *
 * Call it in the component that outlives the dialog, such as the row that opens it, and call the
 * returned function in the same handler that opens the dialog. A component that mounts with its
 * dialog has no earlier attempt to hide and does not need this hook.
 *
 * @param error The last error of the action, or `null`.
 * @param pending `true` while the action runs.
 * @returns The error to show, and the function to call when the dialog opens.
 */
export function useFreshError<Failure>(
  error: Failure | null | undefined,
  pending: boolean,
): [Failure | null, () => void] {
  const [stale, setStale] = useState<unknown>(NOTHING)
  useEffect(() => {
    if (pending) setStale(NOTHING)
  }, [pending])
  const current = error ?? null
  return [
    current !== null && Object.is(current, stale) ? null : current,
    // An updater, so an error that is itself a function is stored and not called.
    () => setStale(() => current ?? NOTHING),
  ]
}
