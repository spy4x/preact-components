import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createElement } from "preact"
import { render } from "preact-render-to-string"
import { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
import { CopyableText, CopyableTextBody, type CopyableTextBodyProps } from "./copyable-text.tsx"

/** A clipboard port, in the shape {@link CopyButtonProps} takes. */
type CopyPort = (text: string) => void | Promise<void>

/** One element of the body's tree, reduced to what these assertions read. */
interface Element {
  type: unknown
  props: Record<string, unknown>
}

/**
 * The children `CopyableTextBody` returns.
 *
 * The body is invoked directly — it calls no hook — so its vnodes are the props it handed down, and
 * that is what the copy-port assertions below are about. `CopyableText` itself cannot be invoked
 * that way: it calls `useState`, which only a render provides.
 *
 * @param props Body props, with the copied state a render would own.
 * @returns The value element, the copy control and the live region, in render order.
 */
function bodyOf(props: CopyableTextBodyProps): Element[] {
  const root = CopyableTextBody(props) as unknown as Element
  return root.props.children as unknown as Element[]
}

/** The value element of the body. */
function valueOf(props: CopyableTextBodyProps): Element {
  return bodyOf(props)[0]
}

/**
 * The copy control's props, as the body handed them down.
 *
 * @param props Body props under test.
 * @returns The control's props.
 */
function controlOf(props: CopyableTextBodyProps): CopyButtonProps {
  const control = bodyOf(props).find((child) => child.type === CopyButton)
  if (!control) throw new Error("CopyableTextBody rendered no CopyButton")

  return control.props as unknown as CopyButtonProps
}

/**
 * The live region the body renders, as markup, for a given copied state.
 *
 * @param props Body props under test.
 * @returns The region's rendered HTML.
 */
function statusOf(props: CopyableTextBodyProps): string {
  const status = bodyOf(props)[2]
  return render(createElement(status.type as never, status.props as never))
}

/** Body props for a component that has just been copied. */
function clicked(overrides: Partial<CopyableTextBodyProps> = {}): CopyableTextBodyProps {
  return { text: "inv_8f2c1d90", copied: true, onCopy: () => {}, ...overrides }
}

/** Body props for a component nothing has happened to. */
function idle(overrides: Partial<CopyableTextBodyProps> = {}): CopyableTextBodyProps {
  return { text: "inv_8f2c1d90", copied: false, onCopy: () => {}, ...overrides }
}

/**
 * Click the copy control, the way `CopyButton`'s own handler does.
 *
 * `CopyButton` calls the port it was handed with its own `textToCopy`. Driving the component's port
 * — not a placeholder — is what makes these assertions about the wiring `CopyableText` owns; calling
 * `copyToClipboard` with a port invented here would pass whatever the component did.
 *
 * @param props Body props under test.
 * @param expected The string the caller's port is expected to receive.
 */
function clickCopy(props: CopyableTextBodyProps, expected: string): void {
  controlOf(props).copy?.(expected)
}

describe("CopyableText", () => {
  it("renders the value in monospace", () => {
    const html = render(<CopyableText text="inv_8f2c1d90" />)

    expect(html).toContain("font-mono")
    expect(html).toContain("inv_8f2c1d90")
  })

  it("renders the value as the element's own text, so its accessible name is the whole string", () => {
    // The corollary of the truncation decision: nothing is cut out of the markup, nothing is hidden
    // from assistive tech with `aria-hidden`, and the value is not smuggled into a label either.
    const value = valueOf(idle({ text: "inv_8f2c1d90", truncate: true }))

    expect(value.props.children).toBe("inv_8f2c1d90")
    expect(value.props["aria-hidden"]).toBeUndefined()
    expect(value.props["aria-label"]).toBeUndefined()

    // The only `aria-hidden` in the markup belongs to `CopyButton`'s glyph.
    const html = render(<CopyableText text="inv_8f2c1d90" truncate />)
    expect(html).not.toContain('aria-label="inv_8f2c1d90"')
    expect(html).toContain(">inv_8f2c1d90<")
  })

  it("clips a truncated value with CSS rather than cutting the string", () => {
    const value = valueOf(idle({ text: "inv_8f2c1d90ab34cd56", truncate: true }))

    expect(value.props.class).toContain("truncate")
    expect(value.props.children).toBe("inv_8f2c1d90ab34cd56")
    expect(render(<CopyableText text="inv_8f2c1d90ab34cd56" truncate />))
      .toContain("inv_8f2c1d90ab34cd56")
  })

  it("offers the full value as a tooltip when truncation is on", () => {
    expect(render(<CopyableText text="inv_8f2c1d90ab34cd56" truncate />))
      .toContain('title="inv_8f2c1d90ab34cd56"')
  })

  it("takes a caller title over the text itself", () => {
    const html = render(<CopyableText text="inv_8f2c1d90ab34cd56" truncate title="Invoice 42" />)

    expect(html).toContain('title="Invoice 42"')
    expect(html).toContain("inv_8f2c1d90ab34cd56")
  })

  it("adds no tooltip to a value that is not truncated", () => {
    expect(valueOf(idle()).props.title).toBeUndefined()
    expect(render(<CopyableText text="inv_8f2c1d90" />)).not.toContain('title="inv_8f2c1d90"')
  })

  it("renders an integrated copy control", () => {
    const html = render(<CopyableText text="inv_8f2c1d90" />)

    expect(html).toContain('aria-label="Copy"')
    expect(html).toContain('type="button"')
    expect(html).toContain("<rect")
  })

  it("hands the copy control the untruncated value", () => {
    const control = controlOf(idle({ text: "inv_8f2c1d90ab34cd56", truncate: true }))

    expect(control.textToCopy).toBe("inv_8f2c1d90ab34cd56")
  })

  it("hands the copy control a port of its own, so the copy can be announced", () => {
    const control = controlOf(idle())

    expect(typeof control.copy, "no port to announce through").toBe("function")
  })

  it("routes the caller's injected port the value it was handed", () => {
    const copied: string[] = []
    const port: CopyPort = (text) => {
      copied.push(text)
    }

    clickCopy(idle({ copy: port }), "inv_8f2c1d90")

    expect(copied).toEqual(["inv_8f2c1d90"])
  })

  it("copies the full value, not the truncated one, through the caller's port", () => {
    const copied: string[] = []
    const port: CopyPort = (text) => {
      copied.push(text)
    }
    const props = idle({ text: "inv_8f2c1d90ab34cd56", truncate: true, copy: port })

    // This is the string a browser click copies when no port is injected, so it is also the one the
    // component's own port has to route when there is one.
    const control = controlOf(props)
    clickCopy(props, control.textToCopy)

    expect(copied).toEqual(["inv_8f2c1d90ab34cd56"])
  })

  it("does not wait on the caller's port when it is async", () => {
    const copied: string[] = []
    const port: CopyPort = (text) => {
      copied.push(text)
      return Promise.resolve()
    }

    clickCopy(idle({ copy: port }), "inv_8f2c1d90")

    // The copy is handed over and the click returns: `copyToClipboard` never awaits the port.
    expect(copied).toEqual(["inv_8f2c1d90"])
  })

  it("forwards the copy label and the copied-for window to the control", () => {
    const control = controlOf(idle({ copyLabel: "Copy API key", copiedForMs: 900 }))

    expect(control.copyLabel).toBe("Copy API key")
    expect(control.copiedForMs).toBe(900)
    expect(control.title).toBeUndefined()
  })

  it("labels the control for assistive tech with the caller's own words", () => {
    const html = render(<CopyableText text="inv_8f2c1d90" copyLabel="Copy API key" />)

    expect(html).toContain('aria-label="Copy API key"')
    expect(html).toContain('title="Copy API key"')
  })

  it("announces a copy through a polite live region, empty until one happens", () => {
    // `CopyButton` confirms a copy by swapping its glyph, which a screen reader is never told about
    // and which leaves its `aria-label` alone; this region is the confirmation instead. Empty before
    // a copy — a region that starts filled announces nothing on the first click.
    expect(statusOf(idle())).toBe('<span role="status" aria-live="polite" class="sr-only"></span>')
    expect(statusOf(clicked())).toBe(
      '<span role="status" aria-live="polite" class="sr-only">Copied</span>',
    )
  })

  it("confirms the caller's own click, not just any render", () => {
    // The port the body hands over is what a click reaches, so driving it is what a click does.
    let announced = 0
    const control = controlOf(idle({ copy: () => {}, onCopy: () => announced++ }))

    control.copy?.("inv_8f2c1d90")

    expect(announced).toBe(1)
  })

  it("takes the confirmation word from the caller rather than conjugating the label", () => {
    // Suffixing `copyLabel` would announce `"Copy API keyed"`, which is why the word is a prop.
    const status = statusOf(clicked({ copyLabel: "Copy API key", copiedLabel: "API key copied" }))

    expect(status).toContain(">API key copied<")
    expect(status).not.toContain("keyed")
  })

  it("appends a caller class to the wrapper", () => {
    expect(render(<CopyableText text="inv_8f2c1d90" class="mt-1" />)).toContain("mt-1")
  })

  it("renders no truncation prop of its own into the markup", () => {
    const html = render(<CopyableText text="inv_8f2c1d90" truncate />)

    expect(html).not.toContain("truncate=")
    expect(html).not.toContain("copiedForMs")
    expect(html).not.toContain("copyLabel=")
  })
})
