import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Tooltip, type TooltipPlacement } from "./tooltip.tsx"

/**
 * What a rendered string can and cannot say about this component.
 *
 * These tests render to markup, so they reach the wiring — which element is described, which one
 * may carry a name, where the surface is anchored, and where its bridge to the trigger is. They
 * reach none of the behaviour: the Escape press that dismisses a hint, the pointer that keeps one
 * up, and the listener registered only while the trigger is engaged all need a browser, and are
 * proven in `pages/checks/ui.ts` instead.
 */

/** The `id` of the element carrying `role="tooltip"`, read back from rendered markup. */
function tooltipId(html: string): string {
  const match = html.match(/id="([^"]+)" role="tooltip"/)
  if (!match) throw new Error(`no tooltip surface in: ${html}`)
  return match[1]
}

/** The rendered `role="tooltip"` surface, attributes and content included. */
function tooltipSurface(html: string): string {
  const start = html.indexOf('role="tooltip"')
  if (start === -1) throw new Error(`no tooltip surface in: ${html}`)
  return html.slice(start)
}

describe("Tooltip", () => {
  it("describes the trigger with the tooltip it renders", () => {
    const html = render(
      <Tooltip label="Copy API key" content="Copies it to the clipboard">key</Tooltip>,
    )
    const id = tooltipId(html)

    expect(html).toContain(`aria-describedby="${id}"`)
    expect(html).toContain(`id="${id}" role="tooltip"`)
  })

  it("carries the tooltip id on exactly one element", () => {
    const html = render(<Tooltip label="Copy API key" content="Copies it">key</Tooltip>)
    const id = tooltipId(html)

    expect(html.split(`id="${id}"`)).toHaveLength(2)
    expect(html.split(`aria-describedby="${id}"`)).toHaveLength(2)
  })

  it("hangs the name and the description on a button, an element that may carry both", () => {
    const html = render(<Tooltip label="Copy API key" content="Copies it">key</Tooltip>)

    // The defect this pins: the name and the description used to sit on a `<span tabindex="0">`
    // with no role, and `aria-label` on a role-less element is not guaranteed to reach the
    // accessibility tree at all — so the trigger could announce as nothing, described by nothing.
    expect(html.startsWith('<button type="button"')).toBe(true)
    expect(html).toContain('aria-label="Copy API key"')
    expect(html).toContain("aria-describedby=")
    expect(html).not.toContain("tabindex")
  })

  it("keeps its own accessible name, so the tooltip stays supplementary", () => {
    const html = render(<Tooltip label="Copy API key" content="Copies it">key</Tooltip>)

    expect(html).toContain('aria-label="Copy API key"')
    expect(html).not.toContain("aria-labelledby")
    // The described target is a sibling of the trigger content, never inside it: the trigger's
    // name cannot be computed from the tooltip.
    expect(html).toContain(">key<span id=")
  })

  it("renders the tooltip text outside the trigger's own content", () => {
    const html = render(
      <Tooltip label="Retry" content="Retries the last sync">
        <span data-e2e="icon">x</span>
      </Tooltip>,
    )

    expect(html).toContain('data-e2e="icon">x</span><span id=')
    expect(html).toContain("Retries the last sync")
  })

  it("reveals on keyboard focus, not only hover", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)

    expect(html).toContain("group-focus-within:opacity-100")
    expect(html).toContain("group-hover:opacity-100")
    // A `<button>` is a tab stop of its own, so the wrapper needs no `tabindex` to be reachable.
    expect(html).toContain('<button type="button"')
  })

  it("starts with the surface hidden, and marks no hint as dismissed", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)
    const surface = tooltipSurface(html)

    expect(surface).toContain("opacity-0")
    // Not the `hidden` utility: a display:none surface leaves the accessibility tree, so
    // aria-describedby would resolve to nothing. The `hidden` *attribute* is what Escape adds, and
    // a freshly rendered hint has not been dismissed, so it carries neither.
    expect(surface).toContain("invisible")
    expect(surface.match(/class="([^"]*)"/)?.[1].split(" ")).not.toContain("hidden")
    expect(surface.startsWith('role="tooltip" hidden')).toBe(false)
  })

  it("lets the pointer rest on the surface, so the hint can be read", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)

    // `pointer-events-none` made the hint vanish the moment the pointer reached it, and reading a
    // hint by pointing at it is how anyone magnifying the screen reads one at all.
    expect(html).not.toContain("pointer-events-none")
  })

  it("bridges the gap to the trigger with padding rather than a margin", () => {
    // A margin is dead space: crossing it leaves the trigger's wrapper, so the hint is gone before
    // the pointer arrives. The padding belongs to the surface, so the two boxes touch.
    const bridges: Record<TooltipPlacement, string> = {
      top: "pb-2",
      right: "pl-2",
      bottom: "pt-2",
      left: "pr-2",
    }
    for (const [placement, bridge] of Object.entries(bridges)) {
      const html = render(
        <Tooltip label="a" content="c" placement={placement as TooltipPlacement}>x</Tooltip>,
      )
      const surface = tooltipSurface(html)

      expect(surface, `${placement} bridges the gap with ${bridge}`).toContain(bridge)
      expect(surface.match(/class="([^"]*)"/)?.[1]).not.toMatch(/\bm[btlr]-\d/)
    }
  })

  it("paints the hint on a bubble inside the surface, not on the surface itself", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)
    const surface = tooltipSurface(html)
    const surfaceClasses = surface.match(/class="([^"]*)"/)?.[1] ?? ""

    // The surface is the hoverable box; the bubble is what a reader sees. Keeping the background
    // off the surface is what stops the bridge painting a slab of background across the gap.
    expect(surfaceClasses).not.toContain("bg-gray-900")
    expect(surface).toContain('<span class="block rounded-md bg-gray-900')
    expect(surface).toContain(">Retries</span>")
  })

  it("never traps focus: the surface is not focusable", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)
    const surface = html.slice(html.indexOf('role="tooltip"'))

    expect(surface).not.toContain("tabindex")
  })

  it("groups an interactive trigger instead of nesting a button inside a button", () => {
    const html = render(
      <Tooltip label="Retry" content="Retries" focusable={false}>
        <button type="button">Retry</button>
      </Tooltip>,
    )

    // One tab stop for one control, and `role="group"` so the name and the description still land
    // on an element the accessibility tree keeps.
    expect(html.startsWith('<span role="group"')).toBe(true)
    expect(html).not.toContain("tabindex")
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Retry"')
    expect(html).toContain("aria-describedby=")
  })

  it("anchors above the trigger by default", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)

    expect(html).toContain("bottom-full left-1/2")
    expect(html).toContain("-translate-x-1/2")
  })

  it("anchors to each requested side", () => {
    expect(render(<Tooltip label="a" content="c" placement="right">x</Tooltip>))
      .toContain("top-1/2 left-full -translate-y-1/2 pl-2")
    expect(render(<Tooltip label="a" content="c" placement="bottom">x</Tooltip>))
      .toContain("top-full left-1/2 -translate-x-1/2 pt-2")
    expect(render(<Tooltip label="a" content="c" placement="left">x</Tooltip>))
      .toContain("top-1/2 right-full -translate-y-1/2 pr-2")
  })

  it("positions the wrapper so the surface has an anchor", () => {
    const html = render(<Tooltip label="a" content="c">x</Tooltip>)

    expect(html).toContain("relative inline-flex")
    expect(html).toContain("absolute z-50")
  })

  it("appends caller classes to wrapper and surface", () => {
    const html = render(
      <Tooltip label="a" content="c" class="ml-2" contentClass="max-w-sm">x</Tooltip>,
    )

    expect(html).toContain("ml-2")
    expect(html).toContain("max-w-sm")
  })
})
