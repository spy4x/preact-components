import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options } from "preact"
import { render } from "preact-render-to-string"
import { CopyButton } from "./copy-button.tsx"
import {
  CopyButtonBody,
  type CopyButtonBodyProps,
  type CopyStatus,
  copyText,
} from "./copy-button-body.tsx"

describe("CopyButton", () => {
  it("renders an icon-only button when no label is given", () => {
    const html = render(<CopyButton textToCopy="abc" />)

    expect(html).toContain("size-9")
    expect(html).toContain('aria-label="Copy"')
  })

  it("renders an outlined button with the label text when a title is given", () => {
    const html = render(<CopyButton textToCopy="abc" title="Copy link" />)

    expect(html).toContain("border-control")
    expect(html).toContain("Copy link")
    expect(html).not.toContain('aria-label="Copy"')
  })

  it("takes a custom label for tooltip and accessible name", () => {
    const html = render(<CopyButton textToCopy="abc" copyLabel="Copy API key" />)

    expect(html).toContain('title="Copy API key"')
    expect(html).toContain('aria-label="Copy API key"')
  })

  it("shows the clipboard glyph before anything is copied", () => {
    expect(render(<CopyButton textToCopy="abc" />)).toContain("<rect")
  })

  it("defaults to type button", () => {
    expect(render(<CopyButton textToCopy="abc" />)).toContain('type="button"')
  })

  it("appends a caller class", () => {
    expect(render(<CopyButton textToCopy="abc" class="ml-2" />)).toContain("ml-2")
  })
})

describe("CopyButton's copy port", () => {
  it("hands its text to the caller's port when clicked", () => {
    // No DOM here: the `<button>`'s click handler is read off the element tree as it is created.
    const copied: string[] = []
    let click: (() => void) | undefined
    const previous = options.vnode
    options.vnode = (vnode) => {
      const props = vnode.props as { onClick?: () => void }
      if (vnode.type === "button" && props.onClick) click = props.onClick
      previous?.(vnode)
    }
    try {
      render(
        <CopyButton textToCopy="deno add jsr:@std/path" copy={(text) => void copied.push(text)} />,
      )
    } finally {
      options.vnode = previous
    }

    click?.()

    expect(click).toBeDefined()
    expect(copied).toEqual(["deno add jsr:@std/path"])
  })
})

describe("CopyButton's copy result", () => {
  it("counts a port that returns nothing as a copy that worked", async () => {
    expect(await copyText("abc", () => {})).toBe(true)
  })

  it("counts a port that returns false as a failed copy", async () => {
    expect(await copyText("abc", () => false)).toBe(false)
  })

  it("counts a port that rejects as a failed copy", async () => {
    expect(await copyText("abc", () => Promise.reject(new Error("denied")))).toBe(false)
  })

  it("counts a port that throws as a failed copy", async () => {
    expect(
      await copyText("abc", () => {
        throw new Error("denied")
      }),
    ).toBe(false)
  })

  it("reads a text function each time a copy runs", async () => {
    let value = "before"
    const copied: string[] = []
    const pending = copyText(() => value, (text) => void copied.push(text))
    value = "after"
    await pending
    expect(copied).toEqual(["before"])
    expect(await copyText(() => value, (text) => void copied.push(text))).toBe(true)
    expect(copied).toEqual(["before", "after"])
  })
})

/** Body props for an icon-only button in the given status. */
function body(status: CopyStatus, overrides: Partial<CopyButtonBodyProps> = {}) {
  return render(
    <CopyButtonBody textToCopy="abc" status={status} onPress={() => {}} {...overrides} />,
  )
}

describe("CopyButton's confirmation", () => {
  it("shows a cross and announces the failure after a failed copy, never the checkmark", () => {
    const html = body("failed")

    expect(html).toContain('d="M18 6 6 18M6 6l12 12"')
    expect(html).not.toContain('d="m5 13 4 4L19 7"')
    expect(html).toContain(
      '<span role="status" aria-live="polite" class="sr-only">Copy failed</span>',
    )
  })

  it("draws the failure cross in the danger colour", () => {
    expect(body("failed")).toMatch(/<svg class="[^"]*text-danger[^"]*"/)
  })

  it("shows the checkmark and announces the copy after a copy that worked", () => {
    const html = body("copied")

    expect(html).toContain('d="m5 13 4 4L19 7"')
    expect(html).toContain('<span role="status" aria-live="polite" class="sr-only">Copied</span>')
  })

  it("keeps the live region empty before anything is copied", () => {
    expect(body("idle")).toContain('<span role="status" aria-live="polite" class="sr-only"></span>')
  })

  it("replaces a visible title with the confirmation text while it shows", () => {
    expect(body("idle", { title: "Copy number" })).toContain("Copy number")
    const copied = body("copied", { title: "Copy number" })
    expect(copied).not.toContain("Copy number")
    expect(copied).toMatch(/<\/svg>Copied<\/button>/)
    const failed = body("failed", { title: "Copy number" })
    expect(failed).not.toContain("Copy number")
    expect(failed).toContain('<span class="text-danger">Copy failed</span></button>')
  })

  it("takes both confirmation words from the caller", () => {
    expect(body("copied", { copiedLabel: "Id copied" })).toContain(">Id copied</span>")
    expect(body("failed", { failedLabel: "Id not copied" })).toContain(">Id not copied</span>")
  })

  it("renders the live region after the button, not inside it", () => {
    expect(body("copied")).toMatch(/<\/button><span role="status"/)
  })

  it("keeps an icon-only button's accessible name while a confirmation shows", () => {
    expect(body("copied")).toContain('aria-label="Copy"')
    expect(body("failed")).toContain('aria-label="Copy"')
  })
})

describe("CopyButton's passthrough", () => {
  it("passes data attributes and other button attributes to its button", () => {
    const html = render(
      <CopyButton textToCopy="abc" data-umami-event="copy-install" id="install-copy" />,
    )

    expect(html).toMatch(/<button[^>]* data-umami-event="copy-install"/)
    expect(html).toMatch(/<button[^>]* id="install-copy"/)
  })

  it("lets a caller's aria-label name the button", () => {
    expect(render(<CopyButton textToCopy="abc" aria-label="Copy the invoice id" />)).toMatch(
      /<button[^>]* aria-label="Copy the invoice id"/,
    )
    expect(
      render(<CopyButton textToCopy="abc" title="Copy id" aria-label="Copy the invoice id" />),
    ).toMatch(/<button[^>]* aria-label="Copy the invoice id"/)
  })

  it("runs the caller's onClick before the copy starts", () => {
    const calls: string[] = []
    let click: ((event: unknown) => void) | undefined
    const previous = options.vnode
    options.vnode = (vnode) => {
      const props = vnode.props as { onClick?: (event: unknown) => void }
      if (vnode.type === "button" && props.onClick) click = props.onClick
      previous?.(vnode)
    }
    try {
      render(
        <CopyButton
          textToCopy="abc"
          onClick={() => void calls.push("onClick")}
          copy={() => void calls.push("copy")}
        />,
      )
    } finally {
      options.vnode = previous
    }

    click?.({})

    expect(calls).toEqual(["onClick", "copy"])
  })
})

describe("CopyButton hotkey", () => {
  it("passes its hotkey to the button: a hint beside a title, none on the icon alone", () => {
    const titled = render(<CopyButton textToCopy="x" title="Copy id" hotkey="c" />)
    expect(titled).toContain('aria-keyshortcuts="C"')
    expect(titled).toContain("data-hotkey-hint")
    const icon = render(<CopyButton textToCopy="x" hotkey="c" />)
    expect(icon).toContain('aria-keyshortcuts="C"')
    expect(icon).not.toContain("data-hotkey-hint")
  })
})
