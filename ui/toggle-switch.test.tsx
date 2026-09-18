import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ToggleSwitch } from "./toggle-switch.tsx"

describe("ToggleSwitch", () => {
  it("reports its state as a switch", () => {
    const on = render(<ToggleSwitch value onToggle={() => {}} />)
    const off = render(<ToggleSwitch value={false} onToggle={() => {}} />)

    expect(on).toContain('role="switch"')
    expect(on).toContain('aria-checked="true"')
    expect(off).toContain('aria-checked="false"')
  })

  it("colours the track by state", () => {
    expect(render(<ToggleSwitch value onToggle={() => {}} />)).toContain("bg-purple-900")
    expect(render(<ToggleSwitch value={false} onToggle={() => {}} />)).toContain("bg-gray-200")
  })

  it("slides the knob by state", () => {
    expect(render(<ToggleSwitch value onToggle={() => {}} />)).toContain("translate-x-5")
    expect(render(<ToggleSwitch value={false} onToggle={() => {}} />)).toContain("translate-x-0")
  })

  it("uses the post-Tailwind-3.4 shrink utility", () => {
    const html = render(<ToggleSwitch value onToggle={() => {}} />)

    expect(html).toContain("shrink-0")
    expect(html).not.toContain("flex-shrink-0")
  })

  it("uses the shadow-sm utility instead of the removed bare shadow", () => {
    const html = render(<ToggleSwitch value onToggle={() => {}} />)

    expect(html).toContain("shadow-sm")
  })

  it("hides the knob from assistive tech", () => {
    expect(render(<ToggleSwitch value onToggle={() => {}} />)).toContain('aria-hidden="true"')
  })

  it("labels the switch when a label is given", () => {
    expect(render(<ToggleSwitch value onToggle={() => {}} label="Archive" />))
      .toContain('aria-label="Archive"')
  })

  it("renders a disabled switch", () => {
    const html = render(<ToggleSwitch value onToggle={() => {}} disabled />)

    expect(html).toContain("disabled")
    expect(html).toContain("disabled:cursor-not-allowed")
  })

  it("defaults to type button so it never submits a form", () => {
    expect(render(<ToggleSwitch value onToggle={() => {}} />)).toContain('type="button"')
  })
})
