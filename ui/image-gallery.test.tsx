import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ImageGallery, type ImageGalleryImage } from "./image-gallery.tsx"

const IMAGES: ImageGalleryImage[] = [
  { src: "https://acme.example/img/a.png", alt: "A hero" },
  {
    src: "https://acme.example/img/b.png",
    alt: "A team",
    thumbSrc: "https://acme.example/thumb/b.png",
  },
  { src: "https://acme.example/img/c.png", alt: "A product" },
]

describe("ImageGallery", () => {
  it("renders one named button per image", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain('aria-label="A hero"')
    expect(html).toContain('aria-label="A team"')
    expect(html).toContain('aria-label="A product"')
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it("uses thumbSrc for the thumbnail image, falling back to the full src", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain("https://acme.example/thumb/b.png")
    expect(html).toContain("https://acme.example/img/a.png")
    expect(html).toContain("https://acme.example/img/c.png")
    // The full-size src of the thumbnail that has its own thumbSrc is not also rendered as a src.
    expect(html).not.toContain('src="https://acme.example/img/b.png"')
  })

  it("renders every thumbnail image decorative, since the button already carries the name", () => {
    // `preact-render-to-string` renders `alt=""` as the bare attribute `alt` — see
    // `ui/avatar.test.tsx`'s `bareAltCount` for the same measurement.
    const html = render(<ImageGallery images={[IMAGES[0]]} />)

    expect(html.match(/alt(?=[\s>])/g) ?? []).toHaveLength(1)
  })

  it("renders the lightbox closed, with no image inside it, before anything is pressed", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain("<dialog")
    // The three thumbnail images are the only <img> tags; the lightbox itself carries none while closed.
    expect((html.match(/<img/g) ?? []).length).toBe(3)
  })

  it("drops an image with no description from the strip", () => {
    const images = [...IMAGES, { src: "https://acme.example/img/d.png", alt: "  " }]
    const html = render(<ImageGallery images={images} />)

    expect(html).not.toContain("https://acme.example/img/d.png")
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it("passes custom lightbox labels through", () => {
    const html = render(
      <ImageGallery
        images={IMAGES}
        label="Photo viewer"
        closeLabel="Dismiss"
        previousLabel="Earlier"
        nextLabel="Later"
        counterLabel={(position, total) => `image ${position}/${total}`}
      />,
    )

    expect(html).toContain('aria-label="Photo viewer"')
  })

  it("keeps the caller's utilities on the thumbnail strip", () => {
    const html = render(<ImageGallery images={IMAGES} class="gap-6" />)

    expect(html).toContain("gap-6")
  })
})
