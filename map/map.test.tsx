import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Map } from "./map.tsx"
import type { MapMarker } from "./types.ts"

const markers: MapMarker[] = [
  { id: "1", lat: 51.5, lng: -0.1, label: "London office", status: "on" },
  { id: "2", lat: 48.8, lng: 2.3, label: "Paris office", status: "unknown" },
]

/**
 * `Map` loads Leaflet with a dynamic `import()` inside an effect, and `useEffect` bodies never run
 * under `preact-render-to-string` — so every assertion here is about what the component renders
 * before that import resolves, which is also exactly what a server render produces. What happens
 * after hydration (Leaflet mounting into the box, the markers becoming live pins) is proven in
 * `pages/checks/map.ts`, in a real browser; see that file and issue #143.
 */
describe("Map", () => {
  it("renders an empty box at its default size, with no Leaflet markup and no throw", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={markers}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
      />,
    )

    expect(html).toContain("h-80")
    expect(html).toContain("w-full")
    expect(html).not.toContain("leaflet")
  })

  it("lets the caller's class win over the default height", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={[]}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
        class="h-40"
      />,
    )

    expect(html).toContain("h-40")
    expect(html).not.toContain("h-80")
  })

  it("shows the attribution text unconditionally, before any hydration could have run", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={[]}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example tiles"
      />,
    )

    expect(html).toContain("© Example tiles")
    expect(html).toContain('data-e2e="map-attribution"')
  })

  it("renders attribution containing markup as literal text, never as an element", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={[]}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution={`<img src=x onerror="alert(1)">`}
      />,
    )

    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    // The rest of the string is still literal escaped text — this is what proves it never became an
    // element rather than merely lacking the opening tag: a real onerror handler on a parsed <img>
    // would show up as the attribute `onerror="alert(1)"` with a real quote; here it is inert text
    // with the quote escaped to `&quot;`.
    expect(html).toContain(`onerror=&quot;alert(1)&quot;`)
  })

  it("names the map region with an English default, and a caller's own in its place", () => {
    const defaultHtml = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={[]}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
      />,
    )
    expect(defaultHtml).toContain('aria-label="Map"')

    const namedHtml = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={[]}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
        label="Depot locations"
      />,
    )
    expect(namedHtml).toContain('aria-label="Depot locations"')
  })

  it("renders the plain, non-interactive list of the same markers beside the box", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={markers}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
      />,
    )

    expect(html).toContain(">London office<")
    expect(html).toContain(">Paris office<")
    // The list is presentational — see map/README.md → "Keyboard and screen readers" — so nothing in
    // it is a button; the map's own pins, proven only in a browser, are the operable form.
    expect(html).not.toContain("<button")
  })

  it("passes the listLabel prop through to the list heading", () => {
    const html = render(
      <Map
        center={{ lat: 0, lng: 0 }}
        zoom={3}
        markers={markers}
        onMarkerClick={() => {}}
        tileUrl="https://tiles.example.com/{z}/{x}/{y}.png"
        attribution="© Example"
        listLabel="Sites"
      />,
    )

    expect(html).toContain(">Sites<")
  })
})
