import { expect } from "@std/expect"
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd"
import { RemoteEvent } from "@preact-components/signals/types"
import { render } from "preact-render-to-string"
import { canChange, type Region, RegionEditor, RegionList, regionStore } from "./regions.tsx"

/**
 * The worked example, rendered.
 *
 * This is the acceptance test for the API shape: a region is a schema, a store, and the slots that
 * are about regions. What is asserted here is what the ported files used to get wrong or repeat —
 * the rows the table shows, the count, the actions column, and which chrome the editor shows in
 * each mode.
 *
 * The editor's effects do not run under a server render, so this suite covers the markup and the
 * harness's rules; the load, validate and submit loops are covered against a fake store in
 * `crud-editor.test.ts`.
 */

const at = new Date("2025-03-04T12:00:00Z")

const row = (id: number, name: string, deletedAt: Date | null = null): Region => ({
  id,
  name,
  createdAt: at,
  updatedAt: at,
  deletedAt,
})

beforeAll(async () => {
  await regionStore.onWs(
    [row(1, "North"), row(2, "South"), row(3, "Old North", at)],
    RemoteEvent.LIST,
  )
})

afterAll(() => {
  canChange.value = true
})

describe("RegionList", () => {
  it("shows the active regions and leaves the archived ones out", () => {
    const html = render(<RegionList />)

    expect(html).toContain("North")
    expect(html).toContain("South")
    expect(html).not.toContain("Old North")
  })

  it("counts the active regions in the badge", () => {
    expect(render(<RegionList />)).toContain(`>2</span>`)
  })

  it("links every row to its editor", () => {
    const html = render(<RegionList />)

    expect(html).toContain(`href="/regions/1/edit"`)
    expect(html).toContain(`href="/regions/2/edit"`)
  })

  it("offers the add action to a user who may change regions", () => {
    expect(render(<RegionList />)).toContain(`href="/regions/add"`)
  })

  it("hides the add action from a user who may not", () => {
    canChange.value = false
    expect(render(<RegionList />)).not.toContain(`href="/regions/add"`)
    canChange.value = true
  })
})

describe("RegionEditor", () => {
  it("titles the add form for a new region", () => {
    expect(render(<RegionEditor mode="add" />)).toContain("Add Region")
  })

  it("titles the edit form for an existing region and links back to the list", () => {
    const html = render(<RegionEditor mode="edit" editId={1} />)

    expect(html).toContain("Edit Region")
    expect(html).toContain(`href="/regions"`)
  })

  it("offers the archive toggle only when a row exists", () => {
    expect(render(<RegionEditor mode="edit" editId={1} />)).toContain(`type="checkbox"`)
    expect(render(<RegionEditor mode="add" />)).not.toContain(`type="checkbox"`)
  })

  it("keeps save disabled until the row has been loaded from the store", () => {
    expect(render(<RegionEditor mode="edit" editId={1} />)).toContain("disabled")
  })

  it("renders the single field the region form has", () => {
    const html = render(<RegionEditor mode="add" />)

    expect(html).toContain(">Name</label>")
    expect(html).toContain(`type="text"`)
  })

  it("shows no dependency block when nothing blocks the archive", () => {
    expect(render(<RegionEditor mode="edit" editId={1} />)).not.toContain("please first archive")
  })

  it("always renders the form-level live region, named by Save's aria-describedby", () => {
    // A rule with no field of its own — a cross-field `.narrow`, a value arktype never turned into
    // an object — has nowhere else to show its message. Effects do not run under a server render, so
    // this cannot drive one onto the page (that transition is proven in the browser, in
    // `pages/checks/crud.ts`); what a server render can prove is that the region and the wiring exist
    // from the very first render, not only once an issue arrives.
    const html = render(<RegionEditor mode="add" />)

    const liveRegion = html.match(
      /id="([^"]+)" role="status" aria-live="polite" aria-atomic="true"/,
    )
    expect(liveRegion).not.toBeNull()
    expect(html).toContain(`aria-describedby="${liveRegion?.[1]}"`)
  })

  it("renders a read-only form for a user who may not change regions", () => {
    canChange.value = false
    const html = render(<RegionEditor mode="edit" editId={1} />)

    expect(html).not.toContain("Save")
    expect(html).not.toContain(`type="checkbox"`)
    canChange.value = true
  })
})
