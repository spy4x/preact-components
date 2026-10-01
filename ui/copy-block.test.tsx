import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
import { CopyBlock, type CopyBlockProps } from "./copy-block.tsx"

/** One element of the block's tree, reduced to what these assertions read. */
interface Element {
  type: unknown
  props: Record<string, unknown>
}

/**
 * The copy control's props, as `CopyBlock` hands them down.
 *
 * `CopyBlock` calls no hook, so it is invoked directly and its vnodes are the props it passed on.
 */
function controlOf(props: CopyBlockProps): CopyButtonProps {
  const root = CopyBlock(props) as unknown as Element
  const children = root.props.children as unknown as Element[]
  const control = children.find((child) => child.type === CopyButton)
  if (!control) throw new Error("CopyBlock rendered no CopyButton")
  return control.props as unknown as CopyButtonProps
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
    expect(controlOf({ text: command }).textToCopy).toBe(command)
  })

  it("forwards the caller's port, labels and window to the copy control", () => {
    const port = () => false
    const control = controlOf({
      text: command,
      copy: port,
      copiedLabel: "Command copied",
      failedLabel: "Command not copied",
      copiedForMs: 900,
    })

    expect(control.copy).toBe(port)
    expect(control.copiedLabel).toBe("Command copied")
    expect(control.failedLabel).toBe("Command not copied")
    expect(control.copiedForMs).toBe(900)
  })

  it("renders one empty polite live region on the server, the copy control's own", () => {
    const html = render(<CopyBlock text={command} />)

    expect(html.match(/role="status"/g)?.length).toBe(1)
    expect(html).toContain('<span role="status" aria-live="polite" class="sr-only"></span>')
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
