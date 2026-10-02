/**
 * What counts as a component, by name and value. This module imports nothing, so a script that
 * regenerates a file the catalogue imports can use the rule without loading that file.
 *
 * @module
 */

/**
 * Whether a value export is named the way a component is: PascalCase, an initial capital and a
 * lower-case letter after it. `LineChart` is; `clampProgress` and `DEFAULT_AXIS_COLOR` are not.
 *
 * @param name Value export name.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/**
 * Whether an export is a component: a function named like one. A PascalCase object — an enum such
 * as `ThemeValue` — is not, and neither is a class (`NpmVersionMismatchError`): both are helpers.
 *
 * @param name Value export name.
 * @param value The value it is bound to.
 */
export function isComponent(name: string, value: unknown): boolean {
  return isComponentName(name) && typeof value === "function" &&
    !/^class\b/.test(Function.prototype.toString.call(value))
}
