// An island that renders a library `ImageGallery` with no `class` (`island-bundle.test.ts`).
import { render } from "preact"
import { ImageGallery } from "@spy4x/preact-ui/image-gallery"

render(<ImageGallery images={[{ src: "/a.webp", alt: "A screenshot" }]} />, document.body)
