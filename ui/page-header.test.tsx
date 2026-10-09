import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type ComponentChildren, Fragment, isValidElement, type VNode } from "preact"
import { IconPlus } from "@spy4x/preact-icons"
import { DropdownItem } from "./dropdown.tsx"
import { MoreMenu, PageAction, PageHeader, TOUCH_TARGET } from "./page-header.tsx"

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

type Click = ReturnType<typeof click>

/**
 * The anchor a component draws for `href`: the first element in its tree whose props carry that
 * `href`, rendered one level down (it is a `Button`), so its `onClick` is the one the browser runs.
 */
function anchorFor(tree: ComponentChildren, href: string): VNode<{ onClick?: (e: Click) => void }> {
  const queue: ComponentChildren[] = [tree]
  while (queue.length > 0) {
    const node = queue.shift()
    if (Array.isArray(node)) {
      queue.push(...node)
      continue
    }
    if (!isValidElement(node)) continue
    const props = node.props as { href?: string; children?: ComponentChildren }
    if (props.href === href && typeof node.type === "function") {
      return (node.type as (p: unknown) => VNode<{ onClick?: (e: Click) => void }>)(node.props)
    }
    if (typeof node.type === "function" && node.type !== Fragment) {
      queue.push((node.type as (p: unknown) => ComponentChildren)(node.props))
    } else queue.push(props.children)
  }
  throw new Error(`no element with href ${href}`)
}

/** Presses the anchor with a plain click and a Ctrl click, and returns what `navigate` received. */
function pressBoth(anchor: VNode<{ onClick?: (e: Click) => void }>, routed: string[]) {
  const plain = click()
  anchor.props.onClick?.(plain)
  const afterPlain = [...routed]
  const ctrl = click({ ctrlKey: true })
  anchor.props.onClick?.(ctrl)
  return { afterPlain, afterCtrl: [...routed], ctrlCancelled: ctrl.defaultPrevented }
}

describe("PageHeader", () => {
  it("draws the title as the page's one-line h1, with its full text as the tooltip", () => {
    const html = render(<PageHeader title="Notes" subtitle="Personal" />)
    expect(html).toMatch(
      /<h1 [^>]*title="Notes"[^>]*><span class="block truncate">Notes<\/span><\/h1>/,
    )
    expect(html).toContain(">Personal</p>")
  })

  it("draws a heading inside the h1 in place of the title text, which stays the tooltip", () => {
    const html = render(
      <PageHeader title="Trip" heading={<input aria-label="List name" value="Trip" />} />,
    )
    expect(html).toMatch(/<h1 [^>]*title="Trip"[^>]*><input aria-label="List name"/)
    expect(html).not.toContain(">Trip</h1>")
  })

  it("tags the title and the subtitle for end-to-end tests", () => {
    const html = render(
      <PageHeader title="Notes" subtitle="Team" titleDataE2E="title" subtitleDataE2E="group" />,
    )
    expect(html).toMatch(/<h1 [^>]*data-e2e="title"[^>]*><span [^>]*>Notes<\/span><\/h1>/)
    expect(html).toMatch(/<p [^>]*data-e2e="group"[^>]*>Team<\/p>/)
  })

  it("names the back arrow after the page it returns to, and draws none without `back`", () => {
    const html = render(
      <PageHeader title="Trip" back={{ href: "/groups", label: "Back to groups" }} />,
    )
    const link = html.match(/<a [^>]*>/)?.[0] ?? ""
    expect(link).toContain(`aria-label="Back to groups"`)
    expect(link).toContain(`href="/groups"`)
    expect(link).toContain(TOUCH_TARGET)
    expect(render(<PageHeader title="Trip" />)).not.toContain("<a ")
  })

  it("puts supplementary actions behind one named More actions menu, only when there are some", () => {
    const withMenu = render(
      <PageHeader title="Trip" menu={<DropdownItem onClick={() => {}}>Leave</DropdownItem>} />,
    )
    expect(withMenu).toContain(`aria-label="More actions"`)
    expect(withMenu).toContain(">Leave</button>")
    expect(render(<PageHeader title="Trip" />)).not.toContain("More actions")
    const withAction = render(
      <PageHeader title="Trip" action={<PageAction label="New" Icon={IconPlus} />} />,
    )
    expect(withAction).not.toContain("More actions")
  })

  it("names the menu button after `menuLabel` when one is given", () => {
    const html = render(
      <PageHeader
        title="Trip"
        menuLabel="Trip actions"
        menu={<DropdownItem onClick={() => {}}>Leave</DropdownItem>}
      />,
    )
    expect(html).toContain(`aria-label="Trip actions"`)
    expect(html).not.toContain("More actions")
  })

  it("follows the back arrow through navigate on a plain click, and leaves a Ctrl click alone", () => {
    const routed: string[] = []
    const header = PageHeader({
      title: "Trip",
      back: { href: "/groups", label: "Back to groups" },
      navigate: (href) => routed.push(href),
    })
    const pressed = pressBoth(anchorFor(header, "/groups"), routed)
    expect(pressed.afterPlain).toEqual(["/groups"])
    expect(pressed.afterCtrl).toEqual(["/groups"])
    expect(pressed.ctrlCancelled).toBe(false)
  })

  it("draws a mark before the title, and nothing when there is none", () => {
    const withMark = render(<PageHeader title="Trip" mark={<span id="m">T</span>} />)
    expect(withMark.indexOf(`id="m"`)).toBeGreaterThan(-1)
    expect(withMark.indexOf(`id="m"`)).toBeLessThan(withMark.indexOf("<h1"))
    expect(render(<PageHeader title="Trip" />)).not.toContain(`id="m"`)
  })

  it("keeps the actions from shrinking, so a long title truncates instead", () => {
    const html = render(
      <PageHeader title="Trip" action={<PageAction label="New" Icon={IconPlus} />} />,
    )
    expect(html).toMatch(/<div class="flex min-w-0 flex-1 [^"]*"><h1/)
    expect(html).toMatch(/<div class="flex shrink-0 [^"]*"><button/)
  })
})

describe("MoreMenu", () => {
  it("names its three-dots trigger and its menu by `label`", () => {
    const html = render(
      <MoreMenu label="Actions for Ada" dataE2E="row-menu">
        <DropdownItem onClick={() => {}}>Remove</DropdownItem>
      </MoreMenu>,
    )
    expect(html).toContain(`aria-label="Actions for Ada"`)
    expect(html).toContain(`data-e2e="row-menu"`)
    expect(html).toContain(TOUCH_TARGET)
  })
})

describe("PageAction", () => {
  it("keeps its label as the accessible name while a phone shows only the icon", () => {
    const html = render(
      <PageAction label="New note" Icon={IconPlus} onClick={() => {}} dataE2E="note-new" />,
    )
    expect(html).toContain(`<span class="sr-only sm:not-sr-only">New note</span>`)
    const button = html.match(/<button [^>]*>/)?.[0] ?? ""
    expect(button).toContain(`data-e2e="note-new"`)
    expect(button).toContain(`type="button"`)
    expect(button).toContain(TOUCH_TARGET)
  })

  it("follows its link through navigate on a plain click, and leaves a Ctrl click alone", () => {
    const routed: string[] = []
    const action = PageAction({
      label: "New note",
      Icon: IconPlus,
      href: "/notes/new",
      navigate: (href) => routed.push(href),
    })
    const pressed = pressBoth(anchorFor(action, "/notes/new"), routed)
    expect(pressed.afterPlain).toEqual(["/notes/new"])
    expect(pressed.afterCtrl).toEqual(["/notes/new"])
    expect(pressed.ctrlCancelled).toBe(false)
  })

  it("disables the button form, and turns the link form into an unavailable link", () => {
    const button = render(<PageAction label="New" Icon={IconPlus} onClick={() => {}} disabled />)
    expect(button.match(/<button [^>]*>/)?.[0]).toMatch(/\sdisabled[\s=>]/)
    const link = render(<PageAction label="New" Icon={IconPlus} href="/new" disabled />)
    expect(link).toContain(`aria-disabled="true"`)
    expect(link).not.toContain("href=")
  })

  it("is a link when given `href`", () => {
    const html = render(<PageAction label="New note" Icon={IconPlus} href="/notes/new" />)
    expect(html).toMatch(/^<a [^>]*href="\/notes\/new"/)
    expect(html).not.toContain("<button")
  })
})
