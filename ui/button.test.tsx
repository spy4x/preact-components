import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import type { VNode } from "preact"
import { Button, buttonClasses, type ButtonProps } from "./button.tsx"
import { onAppPage } from "./testdata/page-at.ts"

/** The `class` attribute of the first element in `html`. */
function classOf(html: string): string {
  return /class="([^"]*)"/.exec(html)?.[1] ?? "no class attribute"
}

/** A click as `followLinkClick` reads it, recording whether it was cancelled. */
function click(modifiers: { ctrlKey?: boolean } = {}) {
  return {
    button: 0,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
}

/**
 * An app's own wrapper that adds a prop to `ButtonProps`. It compiles only while `ButtonProps` stays
 * an interface an `interface` can extend, which is what keeps the link form a minor release.
 */
interface WrappedButtonProps extends ButtonProps {
  marker: string
}

function WrappedButton({ marker, ...props }: WrappedButtonProps) {
  return <Button {...props} data-marker={marker} />
}

describe("Button", () => {
  it("defaults to a primary button that does not submit a form", () => {
    const html = render(<Button>Save</Button>)

    expect(html).toContain('type="button"')
    expect(html).toContain("bg-accent-900")
    expect(html).toContain("Save")
  })

  it("swaps the palette per variant", () => {
    expect(render(<Button variant="outline">Cancel</Button>)).toContain(
      "border-control",
    )
    expect(render(<Button variant="danger">Delete</Button>)).toContain("bg-danger-fill")
    expect(render(<Button variant="ghost">More</Button>)).toContain("bg-transparent")
  })

  it("renders a square box for the icon variant", () => {
    const html = render(<Button variant="icon" size="lg" aria-label="Close" />)

    expect(html).toContain("size-10")
    expect(html).toContain('aria-label="Close"')
    expect(html).not.toContain("px-4")
  })

  it("scales the padding with size", () => {
    expect(render(<Button size="sm">S</Button>)).toContain("text-xs")
    expect(render(<Button size="lg">L</Button>)).toContain("text-base")
  })

  it("passes native attributes straight through", () => {
    const html = render(
      <Button type="submit" disabled title="Ship it" data-e2e="submit">
        Go
      </Button>,
    )

    expect(html).toContain('type="submit"')
    expect(html).toContain("disabled")
    expect(html).toContain('title="Ship it"')
    expect(html).toContain('data-e2e="submit"')
  })

  it("renders an existing button's markup exactly as before the link form existed", () => {
    expect(render(<Button>Save</Button>)).toBe(
      '<button type="button" class="inline-flex items-center justify-center gap-2 rounded-md ' +
        "font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus " +
        "focus-visible:ring-offset-2 focus-visible:ring-offset-focus focus-visible:outline-hidden " +
        "disabled:pointer-events-none disabled:opacity-50 bg-accent-900 text-accent-foreground " +
        "hover:bg-accent-800 dark:bg-accent-600 dark:hover:bg-accent-700 px-3 py-2 text-sm" +
        '">Save</button>',
    )
  })

  it("still accepts the props of an interface that extends ButtonProps", () => {
    const html = render(<WrappedButton marker="kept" variant="outline">Go</WrappedButton>)

    expect(html).toContain('data-marker="kept"')
    expect(html).toContain("<button")
  })

  it("appends a caller class instead of replacing the variant", () => {
    const html = render(<Button class="w-full">Wide</Button>)

    expect(html).toContain("w-full")
    expect(html).toContain("bg-accent-900")
  })
})

describe("Button size none", () => {
  it("sets no padding, gap or text size, so the caller's class sizes it", () => {
    const classes = classOf(render(<Button size="none" class="px-6 py-3 text-lg">Book</Button>))
      .split(" ")

    for (
      const set of ["gap-2", "px-2", "px-3", "px-4", "py-2", "text-xs", "text-sm", "text-base"]
    ) {
      expect(classes).not.toContain(set)
    }
    expect(classes).toContain("rounded-md")
    expect(classes).toContain("focus-visible:ring-2")
    expect(classes.slice(-3)).toEqual(["px-6", "py-3", "text-lg"])
  })

  it("gives an icon button no box size", () => {
    const classes = classOf(render(<Button variant="icon" size="none" aria-label="Add" />))

    expect(classes).not.toMatch(/(^| )size-/)
  })
})

describe("Button as a link", () => {
  onAppPage()

  it("renders an anchor with the classes the same button would have", () => {
    const link = render(
      <Button href="/reports" variant="outline" size="lg" class="w-full">Reports</Button>,
    )
    const button = render(<Button variant="outline" size="lg" class="w-full">Reports</Button>)

    expect(link).toMatch(/^<a href="\/reports" class="/)
    expect(link).toContain(">Reports</a>")
    expect(classOf(link)).toBe(classOf(button))
    expect(link).not.toContain("type=")
  })

  it("passes anchor attributes through", () => {
    const html = render(
      <Button href="https://example.com" target="_blank" rel="noopener" data-e2e="out">Out</Button>,
    )

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain('data-e2e="out"')
  })

  it("renders a disabled link with no href, marked as an unavailable link and dimmed", () => {
    const html = render(<Button href="/reports" disabled>Reports</Button>)

    expect(html).not.toContain("href=")
    expect(html).toContain('role="link"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/\sdisabled[\s=>]/)
    expect(classOf(html).split(" ")).toEqual(
      expect.arrayContaining(["pointer-events-none", "opacity-50"]),
    )
  })

  it("hands a plain click to navigate and leaves a Ctrl click to the browser", () => {
    const routed: string[] = []
    const vnode = Button({
      href: "/reports",
      navigate: (href: string) => routed.push(href),
    }) as VNode<
      { onClick: (event: ReturnType<typeof click>) => void }
    >

    const plain = click()
    vnode.props.onClick(plain)
    const ctrl = click({ ctrlKey: true })
    vnode.props.onClick(ctrl)

    expect(plain.defaultPrevented).toBe(true)
    expect(ctrl.defaultPrevented).toBe(false)
    expect(routed).toEqual(["/reports"])
  })

  it("gives a disabled link no click handler that could navigate", () => {
    const routed: string[] = []
    const vnode = Button({
      href: "/reports",
      disabled: true,
      navigate: (href: string) => routed.push(href),
    }) as VNode<{ onClick?: unknown }>

    expect(vnode.props.onClick).toBeUndefined()
  })

  it("types a link's navigate and onClick arguments from context, with no annotation", () => {
    const html = render(
      <Button
        href="/reports"
        navigate={(href) => href.toUpperCase()}
        onClick={(event) => event.currentTarget.href}
      >
        Reports
      </Button>,
    )

    expect(html).toContain('href="/reports"')
  })

  it("refuses busy on a link at the type level", () => {
    // @ts-expect-error A link starts no work of its own, so it takes no `busy`.
    const html = render(<Button href="/reports" busy>Reports</Button>)

    expect(html).toContain("<a")
  })
})

describe("Button busy", () => {
  it("marks a busy button busy and unavailable without disabling it", () => {
    const html = render(<Button busy>Confirm</Button>)

    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/\sdisabled[\s=>]/)
    expect(html).toContain("animate-spin")
    expect(html).toContain("Confirm")
  })

  it("swaps in the busy label while busy", () => {
    const html = render(<Button busy busyLabel="Confirming…">Confirm</Button>)

    expect(html).toContain("Confirming…")
    expect(html).not.toContain(">Confirm<")
  })

  it("renders neither busy mark nor busy label while idle", () => {
    const html = render(<Button busyLabel="Confirming…">Confirm</Button>)

    expect(html).not.toContain("aria-busy")
    expect(html).not.toContain("aria-disabled")
    expect(html).not.toContain("animate-spin")
    expect(html).not.toContain("Confirming…")
    expect(html).toContain("Confirm")
  })

  it("puts the spinner in place of an icon button's icon", () => {
    const html = render(
      <Button variant="icon" busy busyLabel="Deleting…" aria-label="Delete">
        <span class="icon-glyph" />
      </Button>,
    )

    expect(html).toContain("animate-spin")
    expect(html).toContain('aria-label="Delete"')
    expect(html).not.toContain("icon-glyph")
    expect(html).not.toContain("Deleting…")
  })
})

describe("Button hotkey", () => {
  it("announces the key with aria-keyshortcuts and shows it in a hint hidden from screen readers", () => {
    const html = render(<Button hotkey="n">New note</Button>)
    expect(html).toContain('aria-keyshortcuts="N"')
    expect(html).toMatch(
      /New note<span aria-hidden="true" data-hotkey-hint class="hidden pointer-fine:inline-flex"><kbd[^>]*>N<\/kbd><\/span><\/button>/,
    )
  })

  it("writes mod as Control in the server render, before the platform is known", () => {
    expect(render(<Button hotkey="mod+s">Save</Button>)).toContain(
      'aria-keyshortcuts="Control+S"',
    )
  })

  it("leaves the hint out when hotkeyHint is false, and keeps the announcement", () => {
    const html = render(<Button hotkey="n" hotkeyHint={false}>New note</Button>)
    expect(html).toContain('aria-keyshortcuts="N"')
    expect(html).not.toContain("<kbd")
  })

  it("shows no hint on an icon button unless asked", () => {
    const icon = render(<Button variant="icon" hotkey="n" aria-label="New note">+</Button>)
    expect(icon).toContain('aria-keyshortcuts="N"')
    expect(icon).not.toContain("<kbd")
    expect(render(<Button variant="icon" hotkey="n" hotkeyHint aria-label="New">+</Button>))
      .toContain("<kbd")
  })

  it("draws the hint's keys with the kbdLabels given", () => {
    expect(render(<Button hotkey="ctrl+n" kbdLabels={{ ctrl: "Strg" }}>Neu</Button>))
      .toContain(">Strg</kbd>")
  })

  it("gives a link the same announcement and hint", () => {
    const html = render(<Button href="/new" hotkey="n">New</Button>)
    expect(html).toContain('aria-keyshortcuts="N"')
    expect(html).toContain("<kbd")
  })

  it("renders a button without a hotkey with no announcement, no hint and no hotkey attributes", () => {
    const html = render(<Button>Save</Button>)
    expect(html).toBe(
      `<button type="button" class="${buttonClasses()}">Save</button>`,
    )
  })

  it("puts none of its hotkey props on the element", () => {
    const html = render(<Button hotkey="n" hotkeyHint kbdLabels={{}}>New</Button>)
    expect(html).not.toMatch(/hotkey=|hotkeyhint|kbdlabels/i)
  })
})

describe("buttonClasses", () => {
  it("appends a caller's classes after its own, merging nothing", () => {
    // Two utilities of the groups the variant and size already set: a merge would drop those.
    const classes = buttonClasses("outline", "md", "rounded-full px-8")

    expect(classes.endsWith(" rounded-full px-8")).toBe(true)
    expect(classes.split(" ")).toContain("rounded-md")
    expect(classes.split(" ")).toContain("px-3")
  })

  it("keeps utilities from other groups", () => {
    const classes = buttonClasses("primary", "sm", "mt-2")

    expect(classes).toContain("mt-2")
    expect(classes).toContain("px-2")
  })
})
