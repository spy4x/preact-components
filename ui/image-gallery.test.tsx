import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ImageGallery, type ImageGalleryImage, thumbnailKey } from "./image-gallery.tsx"

const IMAGES: ImageGalleryImage[] = [
  { src: "https://acme.example/img/a.png", alt: "A hero" },
  {
    src: "https://acme.example/img/b.png",
    alt: "A team",
    thumbSrc: "https://acme.example/thumb/b.png",
  },
  { src: "https://acme.example/img/c.png", alt: "A product" },
]

describe("thumbnailKey", () => {
  it("keeps a thumbnail's key stable when an earlier image is removed", () => {
    const before = [{ src: "a.png" }, { src: "b.png" }, { src: "c.png" }]
    const after = [{ src: "b.png" }, { src: "c.png" }] // "a.png" removed

    // The same key for "b.png" before and after is what keeps Preact's reconciliation — and so a
    // focused thumbnail, or the element the lightbox restores focus to by reference — on the same
    // image once an earlier one is gone. A key by position alone gives "b.png" "1" before removal
    // and "0" after, which is a *different* key for the same image.
    expect(thumbnailKey(before, 1)).toBe(thumbnailKey(after, 0))
  })

  it("gives two thumbnails sharing one src different keys", () => {
    const images = [{ src: "a.png" }, { src: "a.png" }]

    expect(thumbnailKey(images, 0)).not.toBe(thumbnailKey(images, 1))
  })

  it("counts only earlier occurrences of the same src, not later ones", () => {
    const images = [{ src: "a.png" }, { src: "b.png" }, { src: "a.png" }]

    expect(thumbnailKey(images, 0)).toBe("a.png#0")
    expect(thumbnailKey(images, 2)).toBe("a.png#1")
  })
})

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
      />,
    )

    expect(html).toContain('aria-label="Photo viewer"')
  })

  it("threads counterLabel through to the lightbox it renders", () => {
    // `Lightbox` computes its counter text unconditionally, on every render, not only once the
    // dialog is open — see `ui/lightbox.tsx`'s `counter` — so a spy recording its own calls proves
    // the prop actually reaches `Lightbox` rather than being dropped along the way. Reading the
    // rendered HTML could not show this: the dialog stays closed and the counter chip does not
    // appear in it either way.
    const seen: Array<[number, number]> = []
    const counterLabel = (position: number, total: number) => {
      seen.push([position, total])
      return `${position}/${total}`
    }

    render(<ImageGallery images={IMAGES} counterLabel={counterLabel} />)

    expect(seen).toEqual([[1, IMAGES.length]])
  })

  it("keeps the caller's utilities on the thumbnail strip", () => {
    const html = render(<ImageGallery images={IMAGES} class="gap-6" />)

    expect(html).toContain("gap-6")
  })
})
