import { expect } from "@std/expect"
import { afterEach, describe, it } from "@std/testing/bdd"
import type { VNode } from "preact"
import { App, type PageComponent } from "./app.ts"
import { asset, type Assets, Head, registerIslands, setAssets } from "./render.tsx"

const DEV: Assets = { buildId: "dev", css: [], script: null, preload: null, devScripts: [] }

/** A document with a head the page's `<Head>` fills. */
const Document: PageComponent<unknown> = ({ Component }) => (
  <html>
    <head>
      <title>Site</title>
      <meta name="description" content="Default" />
    </head>
    <body>
      <Component />
    </body>
  </html>
)

/** Renders `vnode` as the page at `path`, inside {@link Document}. */
async function render(vnode: VNode, path = "/"): Promise<Response> {
  const app = new App().appWrapper(Document).route("*", { default: () => vnode })
  return await app.handler()(new Request(`https://example.test${path}`))
}

// Islands, registered once for the whole file, as a server entry does.
function Counter({ start }: { start: number }) {
  return <button type="button">{start}</button>
}
function Takes({ onPick }: { onPick: () => void }) {
  return <button type="button" onClick={onPick}>pick</button>
}
function Outer({ label }: { label: string }) {
  return (
    <div>
      {label}
      <Counter start={1} />
    </div>
  )
}
registerIslands({
  "./islands/counter.tsx": { Counter, NOT_A_COMPONENT: 1 },
  "./islands/takes.tsx": { Takes },
  "./islands/outer.tsx": { Outer },
})

afterEach(() => setAssets(DEV))

describe("Head", () => {
  it("replaces the wrapper's title and same-named meta, in place", async () => {
    const html = await (await render(
      <>
        <Head>
          <title>Pricing</title>
          <meta name="description" content="Plans" />
        </Head>
        <p>body</p>
      </>,
    )).text()
    expect(html).toContain(
      `<head><title>Pricing</title><meta name="description" content="Plans"/></head>`,
    )
    expect(html).not.toContain("Default")
  })

  it("adds the other head elements at the end of the head, after the stylesheets", async () => {
    setAssets({ ...DEV, css: ["/assets/site.css"] })
    const html = await (await render(
      <Head>
        <link rel="canonical" href="https://example.test/" />
      </Head>,
    )).text()
    expect(html).toContain(
      `<link rel="stylesheet" href="/assets/site.css?__frsh_c=dev"/>` +
        `<link rel="canonical" href="https://example.test/"/></head>`,
    )
  })
})

describe("asset", () => {
  it("adds the build id to a path on this site, and leaves other addresses alone", () => {
    setAssets({ ...DEV, buildId: "b1" })
    expect(asset("/logo.svg#a")).toBe("/logo.svg?__frsh_c=b1#a")
    expect(asset("/logo.svg?__frsh_c=old")).toBe("/logo.svg?__frsh_c=old")
    expect(asset("//cdn.example/logo.svg")).toBe("//cdn.example/logo.svg")
    expect(asset("https://example.test/logo.svg")).toBe("https://example.test/logo.svg")
  })

  it("adds the build id to an image's src and every srcset entry", async () => {
    setAssets({ ...DEV, buildId: "b1" })
    const html = await (await render(
      <picture>
        <source srcset="/a.webp 1x, /b.webp 2x" />
        <img src="/a.png" alt="" />
      </picture>,
    )).text()
    expect(html).toContain(`srcset="/a.webp?__frsh_c=b1 1x, /b.webp?__frsh_c=b1 2x"`)
    expect(html).toContain(`src="/a.png?__frsh_c=b1"`)
  })
})

describe("active links", () => {
  it("marks a link to the current page with aria-current=page", async () => {
    const html = await (await render(<a href="/pricing/">Pricing</a>, "/pricing")).text()
    expect(html).toContain(`aria-current="page"`)
  })

  it("marks a link to an ancestor of the current page with aria-current=true", async () => {
    const html = await (await render(<a href="/blog">Blog</a>, "/blog/hello")).text()
    expect(html).toContain(`aria-current="true"`)
    expect(html).toContain(`data-ancestor="true"`)
  })

  it("leaves a link to another page unmarked", async () => {
    const html = await (await render(<a href="/about">About</a>, "/pricing")).text()
    expect(html).not.toContain("aria-current")
  })
})

describe("islands", () => {
  it("marks an island's HTML and lists its file, export and props for the browser", async () => {
    setAssets({ ...DEV, script: "/assets/client.js" })
    const html = await (await render(<Counter start={3} />)).text()
    expect(html).toContain(`<!--island:0--><button type="button">3</button><!--/island:0-->`)
    expect(html).toContain(
      `<script type="application/json" id="__islands">` +
        `[{"file":"./islands/counter.tsx","exportName":"Counter","props":{"start":3}}]</script>`,
    )
    expect(html).toContain(`<script type="module" src="/assets/client.js"></script></body>`)
  })

  it("loads no client script on a page without an island", async () => {
    setAssets({ ...DEV, script: "/assets/client.js" })
    const html = await (await render(<p>static</p>)).text()
    expect(html).not.toContain("<script")
  })

  it("marks only the outer island when one island renders another", async () => {
    const html = await (await render(<Outer label="x" />)).text()
    expect(html).toContain(`<!--island:0-->`)
    expect(html).not.toContain(`<!--island:1-->`)
  })

  it("escapes < in the props JSON, so no prop can close the script element", async () => {
    const html = await (await render(<Outer label="</script><b>" />)).text()
    expect(html).toContain(`"label":"\\u003c/script>\\u003cb>"`)
  })

  it("refuses an island prop that JSON cannot carry to the browser", async () => {
    const original = console.error
    console.error = () => {}
    try {
      const response = await render(<Takes onPick={() => {}} />)
      expect(response.status).toBe(500)
    } finally {
      console.error = original
    }
  })

  it("preloads the client script and the islands' chunks in a Link header", async () => {
    setAssets({
      ...DEV,
      script: "/assets/client.js",
      preload: {
        script: ["/assets/client.js", "/assets/preact.js"],
        islands: { "./islands/counter.tsx": ["/assets/counter.js", "/assets/preact.js"] },
      },
    })
    const response = await render(<Counter start={1} />)
    expect(response.headers.get("Link")).toBe(
      `</assets/client.js>; rel="modulepreload"; as="script", ` +
        `</assets/preact.js>; rel="modulepreload"; as="script", ` +
        `</assets/counter.js>; rel="modulepreload"; as="script"`,
    )
    expect((await render(<p>static</p>)).headers.get("Link")).toBeNull()
  })

  it("loads the dev scripts and the client script on every page in development", async () => {
    setAssets({ ...DEV, script: "/client.ts", devScripts: ["/@vite/client"] })
    const html = await (await render(<p>static</p>)).text()
    expect(html).toContain(
      `<script type="module" src="/@vite/client"></script>` +
        `<script type="module" src="/client.ts"></script></body>`,
    )
  })
})
