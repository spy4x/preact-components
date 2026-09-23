import { options } from "preact"
import type { Ref, VNode } from "preact"

/**
 * Marks a wrapper function so the `options` hook below can find it. A `Symbol` rather than a
 * string property, so nothing outside this module can set it by accident, and so it cannot
 * collide with `preact/compat`'s own marker if some app that also depends on this library loads
 * compat for an unrelated reason.
 */
const FORWARDS_REF = Symbol("forwardRef")

/** A component {@link forwardRef} produced, carrying the marker the `options` hook looks for. */
interface ForwardedType {
  [FORWARDS_REF]: true
}

/**
 * Preact's `createElement` strips `ref` off a vnode's props into `vnode.ref`, for every vnode
 * type — the reason `Input`, `Button`, `Checkbox` and `Radio` need this file at all (see
 * {@link forwardRef}'s doc). The "before diff" options hook is what runs early enough to put
 * `ref` back onto `props` before the component's own function is called: it fires first inside
 * `diff()`, for every vnode, which is also why `preact/hooks` chains its own state through this
 * exact hook rather than a documented one.
 *
 * Preact's source names it `options._diff` (`preact/src/diff/index.js`), but the published
 * package resolves to its built bundle, which carries the mangled property name instead —
 * confirmed against `dist/preact.module.js` of the pinned version, where the same call site reads
 * `options.__b`; `preact/compat`'s own bundle patches `__b` for the same reason. A build that
 * mangles `_diff` differently would fail loudly, not silently: the browser check this file exists
 * for calls `.focus()` through a forwarded ref and asserts the real element took focus.
 *
 * Runs once: every file in this package that calls {@link forwardRef} imports this same module
 * instance, so the hook is installed exactly once no matter how many of them load.
 */
const previousDiff = (options as { __b?(vnode: VNode): void }).__b
;(options as { __b?(vnode: VNode): void }).__b = (vnode: VNode) => {
  // A text child's vnode carries `type: null` (see `preact/src/diff/children.js`), so `type` has
  // to be checked for existence before it is indexed — not only for being a string.
  const type = vnode.type as unknown as Partial<ForwardedType> | string | null
  if (type && typeof type !== "string" && type[FORWARDS_REF] && vnode.ref) {
    ;(vnode.props as { ref?: Ref<unknown> }).ref = vnode.ref
    vnode.ref = null
  }
  previousDiff?.(vnode)
}

/**
 * Wrap a render function so its component forwards the `ref` it is given to whatever the render
 * function does with the second argument, instead of Preact applying that `ref` to the component
 * itself.
 *
 * Preact strips `ref` off a function component's props and applies it to the component instance
 * rather than a DOM node, so `<Input ref={box} />` type-checks and throws at `box.current.focus()`
 * time without something putting `ref` back. `preact/compat` ships a `forwardRef` that does this,
 * and it is the obvious choice — except that importing `preact/compat` anywhere in a process
 * installs a **second**, much bigger patch on `options.vnode` that rewrites every DOM vnode's
 * props (attribute order, `class`/`className`, `defaultValue`, `select multiple`, several event
 * names) for the whole app, not only the components that asked for a ref. A probe that imported
 * only `preact/compat`, calling nothing in it, reordered an unrelated component's rendered
 * attributes and broke its own pre-existing test: `ui/date-range-picker.test.tsx`'s "associates
 * each field label with its own input" reads `for="…"` before `class="…"` in the markup, and
 * `preact/compat` started emitting `class` before `for` instead, for every label on the page, the
 * moment it was imported. That is too wide a blast radius for four components' refs, in a library
 * other apps embed, so this file borrows only the one `options` hook forwarding a ref actually
 * needs — the "before diff" hook, the same one `preact/hooks` already chains under for its own
 * state — and nothing else `preact/compat` carries.
 *
 * @param render Receives the props with `ref` removed, and the ref itself — `null` when the
 * caller passed none, the same as `preact/compat`'s `forwardRef`.
 * @returns A component whose JSX props type carries `ref?: Ref<Instance>`, alongside `Props`.
 */
export function forwardRef<Instance, Props>(
  render: (props: Props, ref: Ref<Instance> | null) => VNode | null,
): (props: Props & { ref?: Ref<Instance> }) => VNode | null {
  function Forwarded(props: Props & { ref?: Ref<Instance> }): VNode | null {
    const { ref, ...rest } = props
    return render(rest as Props, ref ?? null)
  }
  ;(Forwarded as unknown as ForwardedType)[FORWARDS_REF] = true
  return Forwarded
}
