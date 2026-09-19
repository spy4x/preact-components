import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Tooltip } from "./tooltip.tsx"

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
    expect(html).toContain('tabindex="0"')
  })

  it("starts with the surface hidden and free of pointer events", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)
    const surface = tooltipSurface(html)

    expect(surface).toContain("pointer-events-none")
    expect(surface).toContain("opacity-0")
    // Not the `hidden` utility: a display:none surface leaves the accessibility tree, so
    // aria-describedby would resolve to nothing.
    expect(surface).toContain("invisible")
    expect(surface.match(/class="([^"]*)"/)?.[1].split(" ")).not.toContain("hidden")
  })

  it("never traps focus: the surface is not focusable", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)
    const surface = html.slice(html.indexOf('role="tooltip"'))

    expect(surface).not.toContain("tabindex")
  })

  it("drops the tab stop when the trigger content is interactive", () => {
    const html = render(
      <Tooltip label="Retry" content="Retries" focusable={false}>
        <button type="button">Retry</button>
      </Tooltip>,
    )

    expect(html).not.toContain('tabindex="0"')
    expect(html).toContain("aria-describedby=")
  })

  it("anchors above the trigger by default", () => {
    const html = render(<Tooltip label="Retry" content="Retries">x</Tooltip>)

    expect(html).toContain("bottom-full left-1/2")
    expect(html).toContain("-translate-x-1/2")
  })

  it("anchors to each requested side", () => {
    expect(render(<Tooltip label="a" content="c" placement="right">x</Tooltip>))
      .toContain("top-1/2 left-full ml-2 -translate-y-1/2")
    expect(render(<Tooltip label="a" content="c" placement="bottom">x</Tooltip>))
      .toContain("top-full left-1/2 mt-2 -translate-x-1/2")
    expect(render(<Tooltip label="a" content="c" placement="left">x</Tooltip>))
      .toContain("top-1/2 right-full mr-2 -translate-y-1/2")
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
