import type { Signal } from "@preact/signals-core"

/**
 * Merge `patch` into `signal`'s current value and notify subscribers.
 *
 * `signal.value` is replaced with a new object — `{ ...signal.value, ...patch }` — never mutated
 * in place. Preact signals detect a change by reference, so writing into the existing object would
 * leave subscribers unnotified; the fresh object is what makes the update observable. One
 * assignment is already atomic, so this does not wrap the write in `batch()`; a caller merging
 * several signals in one gesture batches around its own calls to `patchSignal`.
 *
 * Refuses with a `TypeError` when `signal.value` is not a plain object — `null`, an array, a
 * `Date`, a `Map`, or a primitive such as a string or number. Spreading any of those does not do
 * what a caller merging a "patch" means: spreading a `Date` or a primitive produces `{}`, spreading
 * an array produces an object keyed by index, and spreading `null` throws a `TypeError` anyway, just
 * one with a message that does not name this function. Throwing here up front, before the spread,
 * makes the mistake visible at the call site instead of inside a diff of an unrelated shape.
 *
 * An empty `patch` still writes: the result is a new object even though every key is unchanged, so
 * subscribers are still notified exactly once. `patchSignal` never inspects `patch` to decide
 * whether anything "really" changed — a caller who wants to skip the notification for a no-op patch
 * checks `Object.keys(patch).length` itself before calling.
 */
export function patchSignal<T extends object>(signal: Signal<T>, patch: Partial<T>): void {
  if (!isPlainObject(signal.value)) {
    throw new TypeError(
      `patchSignal: signal.value must be a plain object, got ${describeValue(signal.value)}`,
    )
  }
  signal.value = { ...signal.value, ...patch }
}

/** True for `{}`-style objects: not `null`, not an array, and not an instance of a built-in class. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Short, safe-to-throw description of a rejected value, for the error message. */
function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "an array"
  if (typeof value !== "object") return `a ${typeof value}`
  return `an instance of ${value.constructor?.name ?? "an unknown class"}`
}
