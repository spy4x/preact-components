import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { SettingGroup, SettingList, SettingRow } from "./setting-row.tsx"

describe("SettingList", () => {
  it("draws its rows as one description list, divided by a rule, inside a card", () => {
    const html = render(
      <SettingList>
        <SettingRow label="Name" value="Ada" />
        <SettingRow label="E-mail" value="ada@example.com" />
      </SettingList>,
    )
    expect(html).toMatch(/^<div [^>]*><dl class="divide-y divide-subtle">/)
    expect(html.match(/<dt /g)?.length).toBe(2)
  })
})

describe("SettingRow", () => {
  it("names the setting in a dt and shows its value in a dd under it", () => {
    const html = render(<SettingRow label="Name" value="Ada" dataE2E="row-name" />)
    expect(html).toMatch(/data-e2e="row-name"/)
    expect(html).toMatch(/<dt [^>]*>Name<\/dt><dd [^>]*>Ada<\/dd>/)
  })

  it("puts the action in the second column across both lines, and draws no cell without one", () => {
    const withAction = render(
      <SettingRow label="Name" value="Ada" action={<button type="button">Edit name</button>} />,
    )
    expect(withAction).toMatch(
      /<dd class="col-start-2 row-span-2 row-start-1[^"]*"><button type="button">Edit name/,
    )
    expect(render(<SettingRow label="Name" value="Ada" />).match(/<dd /g)?.length).toBe(1)
  })

  it("lets a long value shrink rather than push the action off the row", () => {
    const html = render(<SettingRow label="Name" value="Ada" action={<span>x</span>} />)
    expect(html).toContain("grid-cols-[minmax(0,1fr)_auto]")
    expect(html).toMatch(/<dd class="min-w-0 [^"]*">Ada<\/dd>/)
  })
})

describe("SettingGroup", () => {
  it("names its section by its own h2, with the description under it", () => {
    const html = render(
      <SettingGroup title="Security" description="How you sign in." dataE2E="security">
        <p>rows</p>
      </SettingGroup>,
    )
    const labelledBy = html.match(/<section [^>]*aria-labelledby="([^"]+)"/)?.[1]
    expect(labelledBy).toBeDefined()
    expect(html).toContain(`<h2 id="${labelledBy}"`)
    expect(html).toMatch(/>Security<\/h2><p [^>]*>How you sign in.<\/p>/)
    expect(html).toContain(`data-e2e="security"`)
  })

  it("gives two groups with the same title different heading ids", () => {
    const html = render(
      <div>
        <SettingGroup title="Account">a</SettingGroup>
        <SettingGroup title="Account">b</SettingGroup>
      </div>,
    )
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBe(2)
    expect(ids[0]).not.toBe(ids[1])
  })
})
