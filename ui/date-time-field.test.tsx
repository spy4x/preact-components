import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DateTimeField } from "./date-time-field.tsx"

const noop = () => {}

describe("DateTimeField", () => {
  it("shows a stored instant as the wall clock of the zone it is typed in", () => {
    const html = render(
      <DateTimeField
        id="at"
        label="Goes live at"
        value="2026-10-25T08:30:00.000Z"
        timeZone="Europe/Berlin"
        onChange={noop}
      />,
    )
    expect(html).toContain('type="datetime-local"')
    expect(html).toContain('value="2026-10-25T09:30"')
  })

  it("names the zone and its offset at the chosen moment beside the input", () => {
    const summer = render(
      <DateTimeField
        id="at"
        label="At"
        value="2026-07-01T10:00:00Z"
        timeZone="Europe/Berlin"
        onChange={noop}
      />,
    )
    const winter = render(
      <DateTimeField
        id="at"
        label="At"
        value="2026-12-01T10:00:00Z"
        timeZone="Europe/Berlin"
        onChange={noop}
      />,
    )
    expect(summer).toContain(
      '<span id="at-zone" class="text-sm text-muted">Time zone: Berlin, Europe · GMT+2</span>',
    )
    expect(winter).toContain("Time zone: Berlin, Europe · GMT+1")
  })

  it("describes the input by its zone line, then the field's messages", () => {
    const html = render(
      <DateTimeField
        id="at"
        label="At"
        value={null}
        timeZone="UTC"
        onChange={noop}
        error="Pick a time in the future."
        hint="It goes live on its own."
      />,
    )
    expect(html).toContain('aria-describedby="at-zone at-error at-hint"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toMatch(/ value aria-invalid/)
  })

  it("converts min and max to the zone's wall clock", () => {
    const html = render(
      <DateTimeField
        id="at"
        label="At"
        value={null}
        timeZone="Asia/Kolkata"
        min="2026-10-23T00:00:00Z"
        max="2026-10-24T00:00:00Z"
        onChange={noop}
      />,
    )
    expect(html).toContain('min="2026-10-23T05:30"')
    expect(html).toContain('max="2026-10-24T05:30"')
  })

  it("reads an unknown zone as UTC instead of failing the page", () => {
    const html = render(
      <DateTimeField
        id="at"
        label="At"
        value="2026-10-25T08:30:00Z"
        timeZone="Mars/Olympus"
        onChange={noop}
      />,
    )
    expect(html).toContain('value="2026-10-25T08:30"')
    expect(html).toContain("Time zone: UTC")
  })

  it("marks a required field on its label and its input", () => {
    const html = render(
      <DateTimeField id="at" label="At" value={null} timeZone="UTC" onChange={noop} required />,
    )
    expect(html).toContain('<span aria-hidden="true" class="ml-1 text-danger">*</span>')
    expect(html).toContain("required")
  })
})
