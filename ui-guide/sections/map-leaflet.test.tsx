import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "../+index.tsx"

describe("the map page's Map card", () => {
  it("server-renders a placeholder inside its slot instead of the map", () => {
    const html = render(<UIGuide hash="#/map" />)

    expect(html.match(/data-e2e="map-slot"><div data-e2e="map-placeholder"/g)?.length).toBe(1)
    expect(html).not.toContain(`data-e2e="map-box"`)
  })

  it("serves wording that stays true without JavaScript: nothing promises a load", () => {
    const html = render(<UIGuide hash="#/map" />)

    const placeholders = [...html.matchAll(/data-e2e="map-placeholder"[^>]*>([^<]*)</g)]
      .map(([, text]) => text)
    expect(placeholders).toEqual(["Map: drawn in the browser with Leaflet"])
  })
})
