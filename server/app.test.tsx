import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { App, compilePath, createDefine, HttpError, page, type PageProps } from "./app.ts"

/** Sends `path` to `app` and returns the response. */
function call<S>(app: App<S>, path: string, init?: RequestInit): Promise<Response> {
  return app.handler()(new Request(`https://example.test${path}`, init))
}

describe("App routing", () => {
  it("passes a route's parameters to its handler, decoded", async () => {
    const app = new App().get("/blog/:slug", (ctx) => ctx.text(ctx.params.slug))
    expect(await (await call(app, "/blog/hello%20world")).text()).toBe("hello world")
  })

  it("matches an optional segment with and without it, at the start of the path", async () => {
    const app = new App().get("/:lang?/pricing", (ctx) => ctx.text(`[${ctx.params.lang}]`))
    expect(await (await call(app, "/pricing")).text()).toBe("[]")
    expect(await (await call(app, "/de/pricing")).text()).toBe("[de]")
  })

  it("matches a lone optional segment at the root, with or without a trailing slash", () => {
    const pattern = compilePath("/:lang?")
    expect(pattern.test("/")).toBe(true)
    expect(pattern.test("/de")).toBe(true)
    expect(pattern.test("/de/")).toBe(true)
    expect(pattern.test("/de/x")).toBe(false)
  })

  it("matches the rest of the path with a wildcard", async () => {
    const app = new App().get("/s/*", (ctx) => ctx.text(ctx.params.path))
    expect(await (await call(app, "/s/a/b")).text()).toBe("a/b")
  })

  it("finds each method's handler when get and post share a path", async () => {
    const app = new App()
      .get("/form", (ctx) => ctx.text("got"))
      .post("/form", (ctx) => ctx.text("posted"))
    expect(await (await call(app, "/form")).text()).toBe("got")
    expect(await (await call(app, "/form", { method: "POST" })).text()).toBe("posted")
  })

  it("answers HEAD with the GET handler of a route module", async () => {
    const app = new App().route("/x", { handler: { GET: (ctx) => ctx.text("from get") } })
    const response = await call(app, "/x", { method: "HEAD" })
    expect(response.status).toBe(200)
  })

  it("answers 405 to a method the route module has no handler for", async () => {
    const app = new App().route("/x", { handler: { GET: (ctx) => ctx.text("get") } })
    const response = await call(app, "/x", { method: "DELETE" })
    expect(response.status).toBe(405)
    expect(await response.text()).toBe("Method Not Allowed")
  })

  it("answers 405 to a post to a page with no handler", async () => {
    const app = new App().route("/x", { default: () => <p>page</p> })
    expect((await call(app, "/x", { method: "POST" })).status).toBe(405)
  })

  it("answers an HttpError no middleware caught with its status and message", async () => {
    const app = new App().get("/x", () => {
      throw new HttpError(403)
    })
    const response = await call(app, "/x")
    expect(response.status).toBe(403)
    expect(await response.text()).toBe("Forbidden")
  })

  it("answers 404 to an address no route matches", async () => {
    expect((await call(new App(), "/nope")).status).toBe(404)
  })

  it("answers any other error with a plain 500 and logs it", async () => {
    const logged: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => logged.push(...args)
    try {
      const app = new App().get("/x", () => {
        throw new Error("secret detail")
      })
      const response = await call(app, "/x")
      expect(response.status).toBe(500)
      expect(await response.text()).toBe("Internal Server Error")
      expect(String(logged[0])).toContain("secret detail")
    } finally {
      console.error = original
    }
  })

  it("runs middleware in order, each passing on with next()", async () => {
    const app = new App<{ seen: string[] }>()
      .use(async (ctx) => {
        ctx.state.seen = ["first"]
        return await ctx.next()
      })
      .use((ctx) => {
        ctx.state.seen.push("second")
        return ctx.next()
      })
      .get("/", (ctx) => ctx.text(ctx.state.seen.join(",")))
    expect(await (await call(app, "/")).text()).toBe("first,second")
  })

  it("loads a lazy route module once, on its first request", async () => {
    let loads = 0
    const app = new App().route("/x", () => {
      loads++
      return Promise.resolve({ handler: (ctx) => ctx.text("lazy") })
    })
    await call(app, "/x")
    await call(app, "/x")
    expect(loads).toBe(1)
  })

  it("collapses repeated slashes in the address before routing", async () => {
    const app = new App().get("/a/b", (ctx) => ctx.text(ctx.url.pathname))
    expect(await (await call(app, "//a///b")).text()).toBe("/a/b")
  })
})

describe("Context", () => {
  it("collapses repeated slashes in a redirect to a path, so it stays on this site", async () => {
    const app = new App().get("/", (ctx) => ctx.redirect("//evil.example//x?next=//y"))
    const response = await call(app, "/")
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/evil.example/x?next=//y")
  })

  it("leaves a redirect to a full address as it is", async () => {
    const app = new App().get("/", (ctx) => ctx.redirect("https://example.test//x", 307))
    const response = await call(app, "/")
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://example.test//x")
  })

  it("sends text and HTML with their content types, unless the caller set one", async () => {
    const app = new App()
      .get("/t", (ctx) => ctx.text("t"))
      .get("/h", (ctx) => ctx.html("<p>h</p>"))
      .get("/j", (ctx) => ctx.text("{}", { headers: { "content-type": "application/json" } }))
    expect((await call(app, "/t")).headers.get("content-type")).toBe("text/plain;charset=UTF-8")
    expect((await call(app, "/h")).headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect((await call(app, "/j")).headers.get("content-type")).toBe("application/json")
  })
})

describe("route modules", () => {
  it("renders a page with the data, status and headers its handler gave", async () => {
    const define = createDefine<unknown>()
    const app = new App().route("/x", {
      handler: define.handlers({
        GET: () => page({ name: "Ada" }, { status: 201, headers: { "x-test": "1" } }),
      }),
      default: define.page(({ data }) => <p>{(data as { name: string }).name}</p>),
    })
    const response = await call(app, "/x")
    expect(response.status).toBe(201)
    expect(response.headers.get("x-test")).toBe("1")
    expect(await response.text()).toBe("<!DOCTYPE html><p>Ada</p>")
  })

  it("renders an async page by calling it for its markup", async () => {
    const app = new App().route("/x", {
      default: async ({ url }: PageProps<unknown>) => {
        await Promise.resolve()
        return <p>{url.pathname}</p>
      },
    })
    expect(await (await call(app, "/x")).text()).toBe("<!DOCTYPE html><p>/x</p>")
  })

  it("wraps a page in its layouts, outermost first, inside the app wrapper", async () => {
    const app = new App()
      .appWrapper(({ Component }) => (
        <html>
          <body>
            <Component />
          </body>
        </html>
      ))
      .layout("*", ({ Component }) => (
        <main>
          <Component />
        </main>
      ))
      .route("/x", { default: () => <p>page</p> }, {
        layouts: [({ Component }) => (
          <section>
            <Component />
          </section>
        )],
      })
    expect(await (await call(app, "/x")).text()).toBe(
      "<!DOCTYPE html><html><body><main><section><p>page</p></section></main></body></html>",
    )
  })
})
