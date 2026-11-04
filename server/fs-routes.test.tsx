import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { App, type Middleware, type PageProps, type RouteModule } from "./app.ts"
import { fsRoutes } from "./fs-routes.ts"

type Loader = () => Promise<RouteModule<unknown> & { handler?: unknown }>

/** A route file whose page prints `name` and the route's parameters. */
function named(name: string): Loader {
  return () =>
    Promise.resolve({
      default: ({ params }: PageProps<unknown>) => <p>{`${name} ${JSON.stringify(params)}`}</p>,
    })
}

/** The page text `app` answers `path` with. */
async function text(app: App<unknown>, path: string): Promise<string> {
  const response = await app.handler()(new Request(`https://example.test${path}`))
  return (await response.text()).replace("<!DOCTYPE html>", "")
}

describe("fsRoutes", () => {
  it("serves a fixed page before a language segment that would also match it", async () => {
    const app = new App()
    // The language routes come first, as a glob may list them.
    await fsRoutes(app, {
      "./routes/[lang].tsx": named("language"),
      "./routes/[[lang]]/index.tsx": named("home"),
      "./routes/[[lang]]/pricing.tsx": named("pricing"),
    })
    expect(await text(app, "/pricing")).toBe(`<p>pricing {&quot;lang&quot;:&quot;&quot;}</p>`)
    expect(await text(app, "/de/pricing")).toBe(`<p>pricing {&quot;lang&quot;:&quot;de&quot;}</p>`)
    expect(await text(app, "/de")).toBe(`<p>language {&quot;lang&quot;:&quot;de&quot;}</p>`)
    expect(await text(app, "/")).toBe(`<p>home {&quot;lang&quot;:&quot;&quot;}</p>`)
  })

  it("serves a route with no parameter before a parameter, and a parameter before the rest", async () => {
    const app = new App()
    await fsRoutes(app, {
      "./routes/blog/[...rest].tsx": named("rest"),
      "./routes/blog/[slug].tsx": named("slug"),
      "./routes/blog/feed.tsx": named("feed"),
    })
    expect(await text(app, "/blog/feed")).toContain("feed")
    expect(await text(app, "/blog/hello")).toContain("slug")
    expect(await text(app, "/blog/a/b")).toContain("rest")
  })

  it("runs a folder's middleware and layout for the routes in it and below, not beside it", async () => {
    const seen: string[] = []
    const middleware: Middleware<unknown> = (ctx) => {
      seen.push(ctx.url.pathname)
      return ctx.next()
    }
    const app = new App()
    await fsRoutes(app, {
      "./routes/docs/_middleware.ts": () => Promise.resolve({ handler: middleware }),
      "./routes/docs/_layout.tsx": () =>
        Promise.resolve({
          default: ({ Component }: PageProps<unknown>) => (
            <article>
              <Component />
            </article>
          ),
        }),
      "./routes/docs/deep/page.tsx": named("deep"),
      "./routes/about.tsx": named("about"),
    })
    expect(await text(app, "/docs/deep/page")).toMatch(/^<article><p>deep/)
    expect(await text(app, "/about")).toMatch(/^<p>about/)
    expect(seen).toEqual(["/docs/deep/page"])
  })

  it("wraps every page in _app and skips test files and other underscore files", async () => {
    const app = new App()
    await fsRoutes(app, {
      "./routes/_app.tsx": () =>
        Promise.resolve({
          default: ({ Component }: PageProps<unknown>) => (
            <body>
              <Component />
            </body>
          ),
        }),
      "./routes/index.tsx": named("home"),
      "./routes/index.test.tsx": named("test"),
      "./routes/_helpers.tsx": named("helpers"),
    })
    expect(await text(app, "/")).toMatch(/^<body><p>home/)
    expect((await app.handler()(new Request("https://example.test/index.test"))).status).toBe(404)
    expect((await app.handler()(new Request("https://example.test/_helpers"))).status).toBe(404)
  })
})
