/**
 * The classes of `Field`'s error and hint lines, shared with the controls that still draw their own
 * deprecated label, hint and error (`FileInput`, `TagInput`), so the two renderings cannot drift.
 * Not an entry point of the package: an app wraps its control in `./field.tsx`'s `Field`.
 *
 * @module
 */

/** The error line under a field: `mt-2 text-sm text-danger`. */
export const fieldErrorClass = "mt-2 text-sm text-danger"

/** The hint line under a field: `mt-2 text-sm text-muted`. */
export const fieldHintClass = "mt-2 text-sm text-muted"
