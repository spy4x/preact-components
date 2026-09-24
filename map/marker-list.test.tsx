import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MarkerList } from "./marker-list.tsx"
import type { MapMarker } from "./types.ts"

const places: MapMarker[] = [
  { id: "a", lat: 1, lng: 2, label: "Alpha site", status: "on" },
  { id: "b", lat: 3, lng: 4, label: "Beta site", status: "off" },
  { id: "c", lat: 5, lng: 6, label: "Gamma site" },
]

describe("MarkerList", () => {
  it("renders one real button per marker, each naming its place as text", () => {
    const html = render(<MarkerList markers={places} onMarkerClick={() => {}} />)

    for (const marker of places) {
      expect(html, marker.label).toContain(`>${marker.label}<`)
    }
    expect(html.match(/<button /g)?.length).toBe(places.length)
  })

  it("colours each row with the status class theme/preset.css reads, defaulting to unknown", () => {
    const html = render(<MarkerList markers={places} onMarkerClick={() => {}} />)

    expect(html).toContain("status-on")
    expect(html).toContain("status-off")
    // Gamma carries no `status`, so it falls back to "unknown" rather than being left unstyled.
    expect(html).toContain("status-unknown")
  })

  it("gives every row the same map-marker dot the live pins use", () => {
    const html = render(<MarkerList markers={places} onMarkerClick={() => {}} />)

    expect(html.match(/class="map-marker /g)?.length).toBe(places.length)
  })

  it("shows an English heading by default, and a caller's own in its place", () => {
    const defaultHtml = render(<MarkerList markers={places} onMarkerClick={() => {}} />)
    expect(defaultHtml).toContain(">Places<")

    const customHtml = render(
      <MarkerList markers={places} onMarkerClick={() => {}} label="Sites" />,
    )
    expect(customHtml).toContain(">Sites<")
    expect(customHtml).not.toContain(">Places<")
  })

  it("renders a label containing markup as literal text, never as an element", () => {
    // The regression this guards: a `dangerouslySetInnerHTML` or a template-built HTML string would
    // let this through as a real <img> tag with an onerror handler.
    const hostile: MapMarker[] = [
      { id: "x", lat: 0, lng: 0, label: `<img src=x onerror="alert(1)">` },
    ]
    const html = render(<MarkerList markers={hostile} onMarkerClick={() => {}} />)

    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    // Literal escaped text, not a parsed attribute — see the identical assertion in map.test.tsx.
    expect(html).toContain(`onerror=&quot;alert(1)&quot;`)
  })

  it("renders no markers as an empty, still-labelled list rather than throwing", () => {
    const html = render(<MarkerList markers={[]} onMarkerClick={() => {}} />)

    expect(html).toContain(">Places<")
    expect(html).not.toContain("<li>")
  })
})
