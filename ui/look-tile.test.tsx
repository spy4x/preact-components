import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { LookTile, type LookTileProps } from "./look-tile.tsx"

/** A tile's photo width in a `LookGrid`, as the component writes it. */
const GRID_SIZES = "(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"

const PHOTO: LookTileProps["photo"] = {
  alt: "A brown zip jacket, worn open",
  variants: [
    { url: "/p/zip-480.avif", width: 480, height: 640, type: "image/avif" },
    { url: "/p/zip-960.avif", width: 960, height: 1280, type: "image/avif" },
    { url: "/p/zip-960.webp", width: 960, height: 1280, type: "image/webp" },
    { url: "/p/zip-480.webp", width: 480, height: 640, type: "image/webp" },
  ],
}

const TILE: LookTileProps = {
  href: "/jackets/zip-brown",
  name: "Zip jacket",
  price: "590.000 ₫",
  photo: PHOTO,
  sizes: [{ label: "S" }, { label: "M" }, { label: "L", soldOut: true }],
  colors: [{ name: "Brown", color: "#7a5230" }, { name: "Grey", color: "#8a8d91" }],
}

describe("LookTile", () => {
  it("is one link named by the item, with the price and the sizes read after it", () => {
    const html = render(<LookTile {...TILE} />)
    expect(html.match(/<a /g)?.length).toBe(1)
    expect(html).toContain('<a href="/jackets/zip-brown"')
    expect(html).toMatch(/<h2[^>]*><a[^>]*>Zip jacket<\/a><\/h2>/)
    expect(html.indexOf("Zip jacket")).toBeLessThan(html.indexOf("590.000 ₫"))
    expect(html.indexOf("590.000 ₫")).toBeLessThan(html.indexOf('aria-label="Sizes"'))
    // The link stretches over the whole tile, so the photo takes the click too.
    expect(html).toContain('<div class="relative flex')
    expect(html).toContain("after:absolute after:inset-0")
  })

  it("draws the photo from a srcset per type, widest fallback first sized for the grid", () => {
    const html = render(<LookTile {...TILE} />)
    expect(html).toContain(
      `<source type="image/avif" srcset="/p/zip-480.avif 480w, /p/zip-960.avif 960w" sizes="${GRID_SIZES}"`,
    )
    expect(html).toMatch(
      /<img src="\/p\/zip-960.webp" srcset="\/p\/zip-480.webp 480w, \/p\/zip-960.webp 960w"[^>]* width="960" height="1280" alt="A brown zip jacket, worn open"/,
    )
    expect(html).toContain("aspect-3/4")
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain("fetchpriority")
  })

  it("loads a priority photo at once, and takes the photo's own sizes", () => {
    const html = render(<LookTile {...TILE} priority photo={{ ...PHOTO, sizes: "50vw" }} />)
    expect(html).toContain('loading="eager" fetchpriority="high"')
    expect(html).toContain('sizes="50vw"')
  })

  it("strikes a sold-out size through, mutes it and says it is sold out, and draws the rest in the text colour", () => {
    const html = render(<LookTile {...TILE} />)
    expect(html).toMatch(
      /<li class="[^"]*text-muted"><s>L<\/s><span class="sr-only">, sold out<\/span><\/li>/,
    )
    expect(html).toMatch(/<li class="[^"]*text-foreground">S<\/li>/)
  })

  it("marks the chosen size in the accent and says so", () => {
    const html = render(<LookTile {...TILE} chosenSize="M" />)
    expect(html).toMatch(
      /<li class="[^"]*bg-selected[^"]*">M<span class="sr-only">, your size<\/span><\/li>/,
    )
    expect(html.match(/bg-selected/g)?.length).toBe(1)
  })

  it("names each colour dot for screen readers", () => {
    const html = render(<LookTile {...TILE} />)
    expect(html).toContain('<ul aria-label="Colours"')
    expect(html).toContain(
      '<span aria-hidden="true" class="block size-3 rounded-full border border-strong" style="background-color:#7a5230;"></span><span class="sr-only">Brown</span>',
    )
  })

  it("strikes the price and says sold out when nothing is left", () => {
    const html = render(<LookTile {...TILE} soldOut />)
    expect(html).toContain('<s class="text-muted">590.000 ₫</s>')
    expect(html).toContain(">Sold out</p>")
    expect(render(<LookTile {...TILE} />)).not.toContain("Sold out")
  })

  it("names the photo for a view transition into the item page", () => {
    const html = render(<LookTile {...TILE} viewTransitionName="look-zip-brown" />)
    expect(html).toMatch(/<img[^>]*style="view-transition-name:look-zip-brown;"/)
    expect(render(<LookTile {...TILE} />)).not.toContain("view-transition-name")
  })

  it("leaves out the sizes and colours it is not given", () => {
    const html = render(<LookTile {...TILE} sizes={[]} colors={undefined} />)
    expect(html).not.toContain("<ul")
  })

  it("takes its heading level and words", () => {
    const html = render(
      <LookTile
        {...TILE}
        headingLevel={3}
        chosenSize="M"
        labels={{ sizes: "Größen", sizeSoldOut: "ausverkauft", chosenSize: "deine Größe" }}
      />,
    )
    expect(html).toContain("</a></h3>")
    expect(html).toContain('aria-label="Größen"')
    expect(html).toContain(", ausverkauft<")
    expect(html).toContain(", deine Größe<")
  })

  it("refuses a photo with no stored width", () => {
    expect(() => render(<LookTile {...TILE} photo={{ alt: "", variants: [] }} />)).toThrow(
      "at least one variant",
    )
  })
})
