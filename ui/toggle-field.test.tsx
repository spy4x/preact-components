import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type VNode } from "preact"
import { render } from "preact-render-to-string"
import { ToggleField, type ToggleFieldProps } from "./toggle-field.tsx"

const onToggle = (_value: boolean) => {}

describe("ToggleField", () => {
  it("names the switch from the label element, since a button takes no for", () => {
    const html = render(
      <ToggleField id="archive" label="Archive projects" value onToggle={onToggle} />,
    )

    // The pair that makes the association real: the label carries an id, the button points at it.
    expect(html).toContain('id="archive-label"')
    expect(html).toContain('aria-labelledby="archive-label"')
    expect(html).toContain("Archive projects")
    expect(html).not.toContain("aria-label=")
  })

  it("writes no for at the button it labels", () => {
    // A `for` pointing at a `<button>` is not a weaker association, it is a dead one: buttons are
    // not labelable, so nothing activates and some engines log the dangling reference. Issue #67 is
    // the same defect for `Field` + `Checkbox`. The assertion is what stops a later "consistency"
    // pass from reintroducing it.
    const html = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)

    expect(html).not.toContain("for=")
    expect(html).toContain('aria-labelledby="archive-label"')
  })

  it("activates from the label, because a button gets no activation from a label", () => {
    // The mechanism behind "clicking the label toggles": an `onClick` on the label that flips the
    // value. `preact-render-to-string` drops every event handler — rendered markup cannot show one —
    // so the click is performed here instead, on the vnode the component actually returned. That
    // covers the part a browser cannot: `preventDefault` is what stops a second toggle where an
    // engine does activate the button through the label. The click itself stays browser-only.
    const click = clickLabel(field({ id: "archive", label: "Archive", value: true, onToggle }))

    expect(click.labelId).toBe("archive-label")
    expect(click.defaultPrevented()).toBe(true)
  })

  it("sends the flipped value when the label is activated", () => {
    const seen: boolean[] = []
    const push = (next: boolean) => seen.push(next)

    clickLabel(field({ id: "archive", label: "Archive", value: true, onToggle: push }))
    clickLabel(field({ id: "archive", label: "Archive", value: false, onToggle: push }))

    expect(seen).toEqual([false, true])
  })

  it("puts the label id and the switch id on different elements", () => {
    const html = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)

    expect(html.match(/id="archive"/g)?.length).toBe(1)
    expect(html.match(/id="archive-label"/g)?.length).toBe(1)
  })

  it("links the description through aria-describedby", () => {
    const html = render(
      <ToggleField
        id="archive"
        label="Archive"
        value
        onToggle={onToggle}
        description="Hidden from the active list"
      />,
    )

    expect(html).toContain('aria-describedby="archive-hint"')
    expect(html).toContain('id="archive-hint"')
    expect(html).toContain("Hidden from the active list")
    expect(html).toContain("text-gray-500")
  })

  it("renders no description paragraph and no wiring when description is absent", () => {
    const html = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)

    expect(html).not.toContain("archive-hint")
    expect(html).not.toContain('aria-describedby="')
  })

  it("renders no description paragraph for an empty description", () => {
    const html = render(
      <ToggleField id="archive" label="Archive" value onToggle={onToggle} description="" />,
    )

    expect(html).not.toContain("archive-hint")
    expect(html).not.toContain('aria-describedby="')
  })

  it("links the error as a live region alongside the description", () => {
    const html = render(
      <ToggleField
        id="archive"
        label="Archive"
        value
        onToggle={onToggle}
        description="Hidden from the active list"
        error="The plan does not include archiving"
      />,
    )

    expect(html).toContain('aria-describedby="archive-error archive-hint"')
    expect(html).toContain('id="archive-error"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("The plan does not include archiving")
    expect(html).toContain("text-red-700")
  })

  it("renders no error paragraph for an empty error", () => {
    const html = render(
      <ToggleField id="archive" label="Archive" value onToggle={onToggle} error="" />,
    )

    expect(html).not.toContain("archive-error")
    expect(html).not.toContain('aria-describedby="')
  })

  it("says nothing about describing the switch when neither message is set", () => {
    // `aria-describedby=""` is not harmless: it points the control at an element that does not
    // exist, which loses the `aria-labelledby` name in some screen readers.
    const html = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)

    expect(html).not.toContain('aria-describedby="')
  })

  it("disables the switch itself and dims the label", () => {
    const html = render(
      <ToggleField id="archive" label="Archive" value onToggle={onToggle} disabled />,
    )

    // The native attribute, read off the button's own tag: a bare `disabled` substring proves
    // nothing, because every switch's class list carries `disabled:cursor-not-allowed`.
    expect(buttonTags(html).some((tag) => /\sdisabled(\s|>|$)/.test(tag))).toBe(true)
    // The dimmed label is the visual half and must not be the only half: `aria-disabled` alone
    // leaves the switch focusable and clickable, which is why the attribute is on the control.
    expect(labelClasses(html)).toContain("opacity-50")
  })

  it("leaves the switch enabled and the label undimmed by default", () => {
    const html = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)

    expect(buttonTags(html).some((tag) => /\sdisabled(\s|>|$)/.test(tag))).toBe(false)
    expect(labelClasses(html)).not.toContain("opacity-50")
  })

  it("reports its state as a switch", () => {
    const on = render(<ToggleField id="archive" label="Archive" value onToggle={onToggle} />)
    const off = render(
      <ToggleField id="archive" label="Archive" value={false} onToggle={onToggle} />,
    )

    expect(on).toContain('role="switch"')
    expect(on).toContain('aria-checked="true"')
    expect(off).toContain('aria-checked="false"')
  })

  it("marks a required switch on the label only", () => {
    const html = render(
      <ToggleField id="archive" label="Archive" value onToggle={onToggle} required />,
    )

    expect(html).toContain('aria-hidden="true"')
    // A button carries no `required`, and `aria-required` on a `role="switch"` is not supported:
    // claiming it would be a lie to assistive tech. The attribute is what is asserted, not the word:
    // `required` as a substring could match a utility class and turn this into a passing no-op.
    expect(html).not.toContain('required="')
    expect(html).not.toContain("aria-required")
    expect(html).not.toContain(" required")
  })

  it("puts the caller's class on the wrapper, not on the control", () => {
    const html = render(
      <ToggleField
        id="archive"
        label="Archive"
        value
        onToggle={onToggle}
        class="sm:col-span-3"
      />,
    )

    expect(html).toContain('class="sm:col-span-3"')
    expect(html).toContain('id="archive"')
  })

  it("orders the row label, control, description", () => {
    const html = render(
      <ToggleField
        id="archive"
        label="Archive"
        value
        onToggle={onToggle}
        description="Hidden from the active list"
      />,
    )

    expect(html.indexOf("Archive</label>")).toBeLessThan(html.indexOf("<button"))
    expect(html.indexOf("<button")).toBeLessThan(html.indexOf("Hidden from the active list"))
  })
})

/**
 * Call `ToggleField` and hand back the element it returned, unwrapped from the JSX vnode.
 *
 * A rendered string has no handlers, so the click tests need the returned element itself. Calling the
 * component directly also means the walk in {@link clickLabel} starts at the wrapper the component
 * really produced, not at a `<ToggleField>` placeholder.
 *
 * @param props The field's props.
 * @returns The wrapper element `ToggleField` returned.
 */
function field(props: ToggleFieldProps): VNode {
  return ToggleField(props) as VNode
}

/**
 * Perform the label's click on the vnode the component returned, and report what it did.
 *
 * `preact-render-to-string` strips handlers, so a rendered string cannot show the mechanism that
 * makes "click the label, the switch flips" true. Walking the returned element tree reaches the
 * handler the component really wired, and the deliberately minimal fake event keeps the test free of
 * a DOM harness: it records the `preventDefault` call the component is required to make.
 *
 * The path is the component's own markup, not a guess at Preact internals: the wrapper's only child
 * is the row, and the row's first child is the label. A change to that structure fails here, which is
 * the point — the association is the component's contract, so a test that still passed after the
 * label moved would assert nothing.
 *
 * @param vnode The element `ToggleField` returned, before it is rendered to a string.
 * @returns The label element's `id`, and whether the handler called `preventDefault`.
 */
function clickLabel(
  vnode: VNode,
): { labelId: string | undefined; defaultPrevented: () => boolean } {
  const row = childrenOf(vnode)[0]
  const label = childrenOf(row)[0]
  const handlers = label.props as { id?: string; onClick?: (event: Event) => void }
  if (handlers.onClick === undefined) {
    throw new TypeError("ToggleField's label carries no click handler, so clicking it does nothing")
  }
  let prevented = false
  handlers.onClick({ preventDefault: () => prevented = true } as unknown as Event)

  return { labelId: handlers.id, defaultPrevented: () => prevented }
}

/**
 * The child elements of a vnode, whichever shape Preact stored its props in.
 *
 * A vnode built from JSX carries its props as a `[key, value]` pair list, not as a plain object, so
 * `vnode.props.children` is `undefined` and a naive walk reads nothing. Reading both shapes is what
 * keeps this helper from being an assertion that happens to pass because it never looked.
 *
 * @param vnode The element to read the children of.
 * @returns The child vnodes, in document order.
 * @throws When the vnode has no children at all, which means the walk has left the component's markup.
 */
function childrenOf(vnode: VNode): VNode[] {
  const props = vnode.props as { children?: VNode[] } | [string, unknown][]
  const children = Array.isArray(props)
    ? props.find(([key]) => key === "children")?.[1]
    : props.children
  if (!Array.isArray(children)) {
    throw new TypeError(`no child to walk into from <${String(vnode.type)}>`)
  }
  return children
}

/**
 * Every `<button>` opening tag in the markup, as written.
 *
 * The tag is handed over whole because a class list is the wrong place to look for `disabled`: the
 * switch's track always carries `disabled:cursor-not-allowed`, so `toContain("disabled")` on the
 * markup passes for a control that is not disabled at all. Reading the attribute needs the tag.
 *
 * @param html Markup produced by `render`.
 * @returns Each `<button …>` opening tag, in document order.
 * @throws When the markup holds no button, so a missing control cannot pass as an empty list.
 */
function buttonTags(html: string): string[] {
  const tags = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0])
  if (tags.length === 0) throw new TypeError("no button in the markup")
  return tags
}

/** The classes on the `<label>`, one entry per class. Companion to {@link controlClasses}. */
function labelClasses(html: string): string[] {
  const classes = html.match(/<label\b[^>]*?\sclass="([^"]*)"/)?.[1]
  if (classes === undefined) throw new TypeError("no label class in the markup")
  return classes.split(" ")
}
