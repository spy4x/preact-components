import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { createElement } from "preact"
import { render } from "preact-render-to-string"
import { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
import { CopyBlock } from "./copy-block.tsx"
import { CopyBlockBody, type CopyBlockBodyProps } from "./copy-block-body.tsx"

/** A clipboard port, in the shape {@link CopyButtonProps} takes. */
type CopyPort = (text: string) => void | Promise<void>

/** One element of the body's tree, reduced to what these assertions read. */
interface Element {
  type: unknown
  props: Record<string, unknown>
}

/**
 * The children `CopyBlockBody` returns: the `<code>`, the copy control and the live region.
 *
 * The body is invoked directly — it calls no hook — so its vnodes are the props it handed down, and
 * that is what the copy-port assertions below are about.
 */
function bodyOf(props: CopyBlockBodyProps): Element[] {
  const root = CopyBlockBody(props) as unknown as Element
  return root.props.children as unknown as Element[]
}

/** The copy control's props, as the body handed them down. */
function controlOf(props: CopyBlockBodyProps): CopyButtonProps {
  const control = bodyOf(props).find((child) => child.type === CopyButton)
  if (!control) throw new Error("CopyBlockBody rendered no CopyButton")
  return control.props as unknown as CopyButtonProps
}

/** The live region the body renders, as markup. */
function statusOf(props: CopyBlockBodyProps): string {
  const status = bodyOf(props)[2]
  return render(createElement(status.type as never, status.props as never))
}

/** The `<code>` element's opening tag, as `CopyBlock` renders it. */
function codeTag(html: string): string {
  return html.match(/<code[^>]*>/)?.[0] ?? ""
}

/** The classes on the `<code>` element, one per entry. */
function codeClasses(html: string): string[] {
  return codeTag(html).match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? []
}

const command = "deno add jsr:@spy4x/preact-ui jsr:@spy4x/preact-icons jsr:@spy4x/preact-theme"

/** Body props for a block nothing has happened to. */
function idle(overrides: Partial<CopyBlockBodyProps> = {}): CopyBlockBodyProps {
  return { text: command, copied: false, onCopy: () => {}, ...overrides }
}

describe("CopyBlock", () => {
  it("renders the text as real, selectable text inside a monospace code element", () => {
    const html = render(<CopyBlock text={command} />)

    expect(codeTag(html)).toContain("font-mono")
    expect(html).toContain(`>${command}</code>`)
  })

  it("wraps long text inside its box by default, so nothing is clipped", () => {
    const classes = codeClasses(render(<CopyBlock text={command} />))

    expect(classes).toContain("whitespace-pre-wrap")
    expect(classes).toContain("wrap-anywhere")
    expect(classes).not.toContain("whitespace-pre")
    expect(classes).not.toContain("overflow-hidden")
    expect(classes).not.toContain("truncate")
  })

  it("keeps a single-line block on one line and scrolls it inside its own box", () => {
    const classes = codeClasses(render(<CopyBlock text={command} singleLine />))

    expect(classes).toContain("whitespace-pre")
    expect(classes).toContain("overflow-x-auto")
    expect(classes).not.toContain("whitespace-pre-wrap")
  })

  it("lets the code shrink inside the row instead of pushing the button out", () => {
    expect(codeClasses(render(<CopyBlock text={command} />))).toContain("min-w-0")
  })

  it("renders a copy control named Copy by default, and by the caller's label when given", () => {
    expect(render(<CopyBlock text={command} />)).toContain('aria-label="Copy"')
    const html = render(<CopyBlock text={command} copyLabel="Copy install command" />)
    expect(html).toContain('aria-label="Copy install command"')
    expect(html).toContain('title="Copy install command"')
  })

  it("hands the copy control the whole text", () => {
    expect(controlOf(idle()).textToCopy).toBe(command)
  })

  it("routes a press through the caller's port with the text, and marks it copied", () => {
    const copied: string[] = []
    let announced = 0
    const port: CopyPort = (text) => {
      copied.push(text)
    }

    controlOf(idle({ copy: port, onCopy: () => announced++ })).copy?.(command)

    expect(copied).toEqual([command])
    expect(announced).toBe(1)
  })

  it("does not wait on the caller's port when it is async", () => {
    const copied: string[] = []
    const port: CopyPort = (text) => {
      copied.push(text)
      return new Promise(() => {})
    }

    controlOf(idle({ copy: port })).copy?.(command)

    expect(copied).toEqual([command])
  })

  it("forwards the copied-for window to the control, 1500ms unless told otherwise", () => {
    expect(controlOf(idle()).copiedForMs).toBe(1500)
    expect(controlOf(idle({ copiedForMs: 900 })).copiedForMs).toBe(900)
  })

  it("announces a copy through a polite live region, empty until one happens", () => {
    expect(statusOf(idle())).toBe('<span role="status" aria-live="polite" class="sr-only"></span>')
    expect(statusOf(idle({ copied: true }))).toBe(
      '<span role="status" aria-live="polite" class="sr-only">Copied</span>',
    )
  })

  it("takes the confirmation word from the caller rather than conjugating the label", () => {
    const status = statusOf(
      idle({ copied: true, copyLabel: "Copy command", copiedLabel: "Command copied" }),
    )

    expect(status).toContain(">Command copied<")
    expect(status).not.toContain("commanded")
  })

  it("renders an empty live region on the server", () => {
    expect(render(<CopyBlock text={command} />)).toContain(
      '<span role="status" aria-live="polite" class="sr-only"></span>',
    )
  })

  it("appends a caller class to the box", () => {
    expect(render(<CopyBlock text={command} class="max-w-md" />)).toContain("max-w-md")
  })

  it("renders none of its own props into the markup", () => {
    const html = render(<CopyBlock text={command} singleLine copiedLabel="Done" />)

    expect(html).not.toContain("singleLine")
    expect(html).not.toContain("copiedLabel")
    expect(html).not.toContain("copiedForMs")
  })
})
