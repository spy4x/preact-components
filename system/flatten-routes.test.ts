import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  flattenRoutes,
  hrefSegments,
  orderedRoutes,
  type RouteNode,
  routeSpecificity,
  sortRoutes,
} from "./flatten-routes.ts"

/** A route map shaped like the ones in the source apps: children nested under their list route. */
const routes = {
  dashboard: { href: "/", component: "Dashboard" },
  groups: {
    href: "/groups",
    component: "GroupList",
    children: {
      create: { href: "/groups/create", component: "GroupEditor" },
      edit: { href: "/groups/:id", component: "GroupEditor" },
    },
  },
  reports: {
    href: "/reports",
    component: "ReportList",
    children: {
      detail: {
        href: "/reports/:id",
        component: "ReportDetail",
        children: { nested: { href: "/reports/:id/comments", component: "Comments" } },
      },
    },
  },
  uiGuide: { href: "/ui-guide", component: "UIGuide" },
  notFound: { href: "/404", component: "NotFound" },
}

const hrefs = (list: RouteNode[]): string[] => list.map((route) => route.href)

describe("hrefSegments", () => {
  it("strips the leading slash", () => {
    expect(hrefSegments("/groups/create")).toEqual(["groups", "create"])
  })

  it("returns nothing for the root", () => {
    expect(hrefSegments("/")).toEqual([])
  })

  it("ignores a query string and a hash", () => {
    expect(hrefSegments("/groups?page=2#top")).toEqual(["groups"])
  })
})

describe("routeSpecificity", () => {
  it("counts segments and dynamic segments", () => {
    expect(routeSpecificity("/groups/:id")).toEqual({ segments: 2, dynamic: 1 })
    expect(routeSpecificity("/groups/create")).toEqual({ segments: 2, dynamic: 0 })
  })

  it("treats a splat as dynamic", () => {
    expect(routeSpecificity("/docs/*").dynamic).toBe(1)
    expect(routeSpecificity("/docs/*").segments).toBe(2)
  })
})

describe("flattenRoutes", () => {
  it("emits every route exactly once", () => {
    const flat = flattenRoutes(routes)

    expect(flat).toHaveLength(9)
    expect(new Set(flat).size).toBe(9)
  })

  it("puts a child before its parent", () => {
    const flat = flattenRoutes(routes)

    expect(flat.findIndex((route) => route.href === "/groups/create"))
      .toBeLessThan(flat.findIndex((route) => route.href === "/groups"))
  })

  it("puts the deepest descendant first", () => {
    const flat = flattenRoutes(routes)

    expect(flat.findIndex((route) => route.href === "/reports/:id/comments"))
      .toBeLessThan(flat.findIndex((route) => route.href === "/reports/:id"))
  })

  it("keeps sibling declaration order", () => {
    const flat = flattenRoutes(routes)

    expect(flat.findIndex((route) => route.href === "/groups/create"))
      .toBeLessThan(flat.findIndex((route) => route.href === "/groups/:id"))
  })

  it("returns nothing for an empty map", () => {
    expect(flattenRoutes({})).toEqual([])
  })
})

describe("sortRoutes", () => {
  it("ranks a static path above the dynamic pattern that would swallow it", () => {
    const sorted = sortRoutes([
      { href: "/groups/:id" },
      { href: "/groups/create" },
    ])

    expect(hrefs(sorted)).toEqual(["/groups/create", "/groups/:id"])
  })

  it("ranks a deeper path above a shallower one", () => {
    const sorted = sortRoutes([{ href: "/groups" }, { href: "/groups/create" }])

    expect(hrefs(sorted)).toEqual(["/groups/create", "/groups"])
  })

  it("ranks the root last", () => {
    const sorted = sortRoutes([{ href: "/" }, { href: "/404" }, { href: "/a/b" }])

    expect(hrefs(sorted)).toEqual(["/a/b", "/404", "/"])
  })

  it("keeps the original order for hrefs that tie completely", () => {
    const sorted = sortRoutes([
      { href: "/a/:id" },
      { href: "/b/:id" },
      { href: "/c/:id" },
    ])

    expect(hrefs(sorted)).toEqual(["/a/:id", "/b/:id", "/c/:id"])
  })

  it("breaks a remaining tie by longer href", () => {
    const sorted = sortRoutes([{ href: "/g/:id" }, { href: "/groups/:id" }])

    expect(hrefs(sorted)).toEqual(["/groups/:id", "/g/:id"])
  })

  it("does not mutate its input", () => {
    const input: RouteNode[] = [{ href: "/groups/:id" }, { href: "/groups/create" }]
    sortRoutes(input)

    expect(hrefs(input)).toEqual(["/groups/:id", "/groups/create"])
  })

  it("keeps the payload of each route", () => {
    const sorted = sortRoutes(routes.groups.children ? Object.values(routes.groups.children) : [])

    expect(sorted[0]).toBe(routes.groups.children.create)
  })
})

describe("orderedRoutes", () => {
  it("returns the full ordering a Switch needs", () => {
    expect(hrefs(orderedRoutes(routes))).toEqual([
      "/reports/:id/comments",
      "/groups/create",
      "/reports/:id",
      "/groups/:id",
      "/ui-guide",
      "/reports",
      "/groups",
      "/404",
      "/",
    ])
  })

  it("is idempotent when re-run over its own output", () => {
    const once = orderedRoutes(routes)
    const twice = sortRoutes(once)

    expect(hrefs(twice)).toEqual(hrefs(once))
  })
})
