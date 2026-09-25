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
  /**
   * Set from {@link forwardRef}'s `name` argument, not `render.name` — see the comment above
   * `marked.displayName = name` inside {@link forwardRef} for why `render.name` cannot be trusted.
   */
  displayName: string
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
 * `options.__b`; `preact/compat`'s own bundle patches `__b` for the same reason.
 *
 * `__b` is treated as stable within Preact 10 here, not guessed at: this workspace's own pinned
 * `@preact/signals` (2.5.1) hooks the same option under the same name for its own state
 * (`DIFF = "__b"` in its `src/internal.d.ts`, declaring support through 10.x and 11 pre-releases),
 * `preact-render-to-string` (6.7.0, this workspace's renderer) hard-codes the same name in its own
 * `src/lib/constants.js`, and `preact/debug`'s bundle patches it too — the same hook
 * {@link forwardRef}'s doc comment credits `preact/hooks` for chaining under.
 *
 * What would actually break this: a Preact release that mangles `_diff` to something other than
 * `__b`, or that changes how a function component receives `ref` (in which case delete this file
 * — Preact would be doing natively what it exists for). Neither is covered by any version range
 * this package or its dependents declare, and a Preact **major** is the likely place for either;
 * bumping the pinned `preact`/`preact/*` versions in this repo (a deliberate, single, exactly
 * pinned commit per `AGENTS.md`) is the moment to re-check both. It also assumes one single copy
 * of Preact in the module graph, the same assumption `preact/hooks` makes — two copies break
 * `preact/hooks`' own state the same way, so this is not a new fragility this file introduces.
 *
 * The failure mode differs by where it happens. Inside this repository, the browser checks in
 * `pages/checks/ui.ts` call `.focus()` through a forwarded ref and assert the real element took
 * it, so a broken hook fails a named check loudly, in CI, before anything ships. In an app that
 * only imports `@spy4x/preact-ui` — where this file runs the same way, but nothing asserts on
 * it — a broken hook would not raise or log anything: `ref` would silently go back to holding the
 * component instance, the original bug this file exists to fix, surfacing only the next time
 * something calls a DOM method on it.
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
 * props for the whole app, not only the components that asked for a ref: attribute order,
 * `class`/`className`, `defaultValue`, `select multiple`, and several event names remapped to
 * their native DOM equivalents — `onFocus`/`onBlur` become the bubbling `focusin`/`focusout`, and
 * `onChange` on a text `<input>` or `<textarea>` fires on every keystroke (the native `input`
 * event) instead of only when the value is committed (the native `change` event, what this
 * package's own `onChange` props mean everywhere else in it). A probe that imported only
 * `preact/compat`, calling nothing in it, reordered an unrelated component's rendered attributes
 * and broke its own pre-existing test: `ui/date-range-picker.test.tsx`'s "associates each field
 * label with its own input" reads `for="…"` before `class="…"` in the markup, and `preact/compat`
 * started emitting `class` before `for` instead, for every label on the page, the moment it was
 * imported; a second probe confirmed the event remapping separately, by dispatching a plain
 * `input` event at an `Input` with an `onChange` handler — zero calls without `preact/compat`
 * loaded, one call with it loaded and nothing else changed. That is too wide a blast radius for
 * four components' refs, in a library other apps embed, so this file borrows only the one
 * `options` hook forwarding a ref actually needs — the "before diff" hook, the same one
 * `preact/hooks` already chains under for its own state — and nothing else `preact/compat`
 * carries.
 *
 * @param name The component's name, for `preact/debug` warnings and devtools — see below for why
 * this is a separate argument rather than `render.name`.
 * @param render Receives the props with `ref` removed, and the ref itself — `null` when the
 * caller passed none, the same as `preact/compat`'s `forwardRef`.
 * @returns A component whose JSX props type carries `ref?: Ref<Instance>`, alongside `Props`.
 */
export function forwardRef<Instance, Props>(
  name: string,
  render: (props: Props, ref: Ref<Instance> | null) => VNode | null,
): (props: Props & { ref?: Ref<Instance> }) => VNode | null {
  function Forwarded(props: Props & { ref?: Ref<Instance> }): VNode | null {
    const { ref, ...rest } = props
    return render(rest as Props, ref ?? null)
  }
  const marked = Forwarded as unknown as ForwardedType & typeof Forwarded
  marked[FORWARDS_REF] = true
  // `preact/debug` and Preact devtools name a component by `displayName`, falling back to the
  // function's own name only when `displayName` is unset (`preact/debug`'s `getDisplayName`,
  // `debug/src/component-stack.js`) — without it, every one of the four callers here would print
  // "Forwarded", the wrapper's own name, since `render` is passed as an argument rather than
  // declared where the component is used.
  //
  // `name` is its own parameter rather than `render.name` on purpose, and the difference is not
  // cosmetic: each of the four callers writes `forwardRef(fn)` where `fn` is a function expression
  // with the *same* name as the `const` it initializes (`const Button = forwardRef(function
  // Button(...) {...})`), which reads fine as source but is exactly the shape a bundler cannot
  // leave alone. `deno bundle --platform browser` of a page that imports `Button` renamed
  // `function Button(...)` to `function Button2(...)`, to keep the outer binding and the inner
  // expression's own name from colliding once both land in one flattened module scope; the same
  // bundle with `--minify` — what `pages/build.ts` actually ships — went further and dropped the
  // name entirely, emitting `function({variant, ...}) {...}` with nothing after `function` at all.
  // Either way `render.name` in the shipped bundle is not `"Button"`, so a `preact/debug` warning
  // there would have named the wrong thing (or nothing) even with this fix, had it read
  // `render.name` instead of taking `name` as a literal string no bundler can touch. Set to the
  // plain name, not `preact/compat`'s `ForwardRef(${name})`: the printed name then matches exactly
  // what it was before this file existed — "in Button", not "in ForwardRef(Button)" — which is
  // what every *unbundled* render of this package still prints for every other component, since
  // nothing else in it is wrapped or renamed.
  marked.displayName = name
  return marked
}
