// An island that renders a library `YouTubeVideo` (`island-bundle.test.ts`).
import { render } from "preact"
import { YouTubeVideo } from "@spy4x/preact-ui/youtube-video"

render(
  <YouTubeVideo
    videoId="aqz-KE-bpKQ"
    title="A video"
    poster={{ src: "/poster.webp", width: 1280, height: 720 }}
  />,
  document.body,
)
