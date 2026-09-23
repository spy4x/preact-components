import type { Signal } from "@preact/signals-core"

/**
 * Merge `patch` into `signal`'s current value and notify subscribers.
 *
 * `signal.value` is replaced with a new object — `{ ...current, ...patch }` — never mutated in
 * place. Preact signals detect a change by reference, so writing into the existing object would
 * leave subscribers unnotified; the fresh object is what makes the update observable. One
 * assignment is already atomic, so this does not wrap the write in `batch()`; a caller merging
 * several signals in one gesture batches around its own calls to `patchSignal`.
 *
 * Reads the current value with `signal.peek()`, not `signal.value`, both for the guard and for the
 * spread. `peek()` is untracked: a tracked read inside an `effect()` or `useSignalEffect()` that
 * calls `patchSignal` on the same signal it is reacting to would otherwise subscribe that effect to
 * the write it is about to make, re-run itself, read again, write again, and eventually throw
 * `Error: Cycle detected` once Preact's re-run limit is hit.
 *
 * Refuses with a `TypeError` when the signal's current value is not a plain object — `null`, an
 * array, a `Date`, a `Map`, a primitive such as a string or number, or an instance of any class,
 * built-in or user-defined, that carries its own prototype. Spreading any of those does not do what
 * a caller merging a "patch" means: spreading a `Date`, a class instance, or a primitive produces
 * `{}` or copies only its enumerable own properties, spreading an array produces an object keyed by
 * index, and spreading `null` throws a `TypeError` anyway, just one with a message that does not
 * name this function. Throwing here up front, before the spread, makes the mistake visible at the
 * call site instead of inside a diff of an unrelated shape. An object created with
 * `Object.create(null)` is accepted — it has no prototype to differ from `Object.prototype` — but
 * the merged result is an ordinary object: the spread that builds it always produces one with
 * `Object.prototype`, so the null prototype is not carried forward.
 *
 * `patch` is refused by the same rule, for the same reason, but that is the only check it gets:
 * nothing here confirms that every key `patch` sets exists on `T` or holds the type `T` declares
 * for it. An extra key reached through a variable, rather than typed as an object literal, is
 * written even though `T` has no such field, and `{ age: undefined }` type-checks against
 * `Partial<T>` and overwrites a `number` field with `undefined` at runtime — `Partial<T>` makes
 * every key optional, not every value required to be the field's own type when present, so neither
 * mistake is caught by the compiler or by this function. A `computed(...)` signal also type-checks
 * as this function's `Signal<T>` parameter, since a read-only value is still structurally assignable
 * to a mutable one, but the eventual `signal.value = …` throws `TypeError: Cannot set property value
 * … which has only a getter` — a message that does not name `patchSignal`.
 *
 * An empty `patch` still writes: the result is a new object even though every key is unchanged, so
 * subscribers are still notified exactly once. `patchSignal` never inspects `patch` to decide
 * whether anything "really" changed — a caller who wants to skip the notification for a no-op patch
 * checks `Object.keys(patch).length` itself before calling.
 */
export function patchSignal<T extends object>(signal: Signal<T>, patch: Partial<T>): void {
  const current = signal.peek()
  if (!isPlainObject(current)) {
    throw new TypeError(
      `patchSignal: signal.value must be a plain object, got ${describeValue(current)}`,
    )
  }
  if (!isPlainObject(patch)) {
    throw new TypeError(`patchSignal: patch must be a plain object, got ${describeValue(patch)}`)
  }
  signal.value = { ...current, ...patch }
}

/**
 * True for `{}`-style objects: not `null`, not an array, and not an instance of any class — built-in
 * (`Date`, `Map`, …) or user-defined — that has its own prototype.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Short, safe-to-throw description of a rejected value, for the error message. */
function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (Array.isArray(value)) return "an array"
  if (typeof value !== "object") return `a ${typeof value}`
  return `an instance of ${value.constructor?.name ?? "an unknown class"}`
}
