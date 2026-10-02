import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options, type VNode } from "preact"
import { render } from "preact-render-to-string"
import { ImageGallery, type ImageGalleryImage, thumbnailKey } from "./image-gallery.tsx"
import { Lightbox, type LightboxProps } from "./lightbox.tsx"

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
  it("keeps a thumbnail's key stable when an earlier, differently-sourced image is removed", () => {
    const before = [{ src: "a.png" }, { src: "b.png" }, { src: "c.png" }]
    const after = [{ src: "b.png" }, { src: "c.png" }] // "a.png" removed

    // The same key for "b.png" before and after is what keeps Preact's reconciliation — and so a
    // focused thumbnail, or the element the lightbox restores focus to by reference — on the same
    // image once an earlier one is gone. A key by position alone gives "b.png" "1" before removal
    // and "0" after, which is a *different* key for the same image.
    expect(thumbnailKey(before, 1)).toBe(thumbnailKey(after, 0))
  })

  it("does not keep a later copy's key stable when an earlier copy of the same src is removed", () => {
    // The one residual case this helper does not fix, documented rather than hidden: two
    // thumbnails sharing a src still collide with each other if the earlier one goes, because the
    // later one's own occurrence count recomputes. Narrower than the bug this replaces — it takes
    // two thumbnails sharing a source, not any two thumbnails anywhere in the list.
    const before = [{ src: "a.png" }, { src: "a.png" }, { src: "b.png" }]
    const after = [{ src: "a.png" }, { src: "b.png" }] // the first "a.png" removed

    expect(thumbnailKey(before, 1)).not.toBe(thumbnailKey(after, 0))
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
    const html = render(<ImageGallery images={IMAGES} class="scroll-smooth" />)

    expect(html).toContain("scroll-smooth")
  })

  it("threads controls through to the lightbox it renders", () => {
    // The dialog is closed during a server render, so its HTML is the same for either value; the
    // props the `Lightbox` element was created with are what show the value arrived.
    const seen: LightboxProps[] = []
    const previous = options.vnode
    options.vnode = (vnode: VNode) => {
      if (vnode.type === Lightbox) seen.push(vnode.props as unknown as LightboxProps)
      previous?.(vnode)
    }
    try {
      render(<ImageGallery images={IMAGES} controls="below" />)
    } finally {
      options.vnode = previous
    }

    expect(seen.map((props) => props.controls)).toEqual(["below"])
  })

  it("keeps the default grid's markup and classes exactly as they were before the strip existed", () => {
    // Rendered from the component as it stood before `layout` was added (#539), and pasted here: the
    // default must not move by one class or one attribute.
    const thumb =
      "block cursor-pointer overflow-hidden rounded-md border border-subtle transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
    const before = `<ul class="flex flex-wrap gap-3">` +
      `<li><button type="button" class="${thumb}" aria-label="A hero"><img src="a.png" alt class="size-20 object-cover sm:size-24"/></button></li>` +
      `<li><button type="button" class="${thumb}" aria-label="A team"><img src="tb.png" alt class="size-20 object-cover sm:size-24"/></button></li>` +
      `</ul>`
    const images = [
      { src: "a.png", alt: "A hero" },
      { src: "b.png", alt: "A team", thumbSrc: "tb.png" },
    ]

    for (
      const html of [
        render(<ImageGallery images={images} />),
        render(<ImageGallery images={images} layout="grid" />),
      ]
    ) {
      expect(html.slice(0, html.indexOf("<dialog"))).toBe(before)
    }
  })
})

describe('ImageGallery with layout="strip"', () => {
  it("lays the images out in one row that scrolls sideways and snaps to each image", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)
    const list = html.match(/<ul class="([^"]*)"/)?.[1].split(" ") ?? []
    const items = [...html.matchAll(/<li class="([^"]*)"/g)].map((match) => match[1].split(" "))

    expect(list).toEqual(
      expect.arrayContaining(["flex", "snap-x", "snap-mandatory", "overflow-x-auto"]),
    )
    expect(list).not.toContain("flex-wrap")
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item).toEqual(expect.arrayContaining(["snap-start", "shrink-0"]))
    }
  })

  it("shows each full-size image uncropped, not the small square thumbnail", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)

    expect(html).toContain('src="https://acme.example/img/b.png"')
    expect(html).not.toContain("https://acme.example/thumb/b.png")
    expect(html).not.toContain("object-cover")
    expect(html).not.toContain("size-20")
  })

  it("keeps every image a real named button, with room for its focus ring inside the row", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)

    expect((html.match(/<button type="button"/g) ?? []).length).toBe(3)
    expect(html).toContain('aria-label="A team"')
    expect(html).toContain("focus-visible:ring-2")
    expect(html.match(/<ul class="([^"]*)"/)?.[1].split(" ")).toContain("p-1")
  })

  it("keeps the caller's utilities on the strip's row", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" class="max-w-xl" />)

    expect(html.match(/<ul class="([^"]*)"/)?.[1].split(" ")).toEqual(
      expect.arrayContaining(["snap-x", "max-w-xl"]),
    )
  })
})
