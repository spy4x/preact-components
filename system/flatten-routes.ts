/**
 * Route ordering for a `wouter` `<Switch>`.
 *
 * `Switch` renders the first `<Route>` that matches, so a static path must sit above the pattern
 * that would swallow it: `/groups/create` before `/groups/:id`, and a child before its parent.
 * A route map already states that relationship through `children`, so the order is derived rather
 * than hand-written — the template's hardcoded `<Route>` list is exactly what this replaces.
 *
 * Framework-agnostic on purpose: `RouteNode` is the shape a route map has, not a wouter type, so
 * the same ordering serves server-rendered manifests, sitemaps and nav trees.
 */

/** Minimal shape a route map entry must have for these helpers. */
export interface RouteNode {
  href: string
  children?: Record<string, RouteNode>
}

/** Segment list of an href, query and hash stripped. `"/"` yields `[]`. */
export function hrefSegments(href: string): string[] {
  const path = href.split(/[?#]/)[0] ?? ""
  return path.split("/").filter(Boolean)
}

/**
 * How specific a href is: more segments first, then fewer dynamic (`:param`, `*`) segments.
 *
 * Only the count of dynamic segments is compared, so `/groups/:id` and `/groups/:name` rank
 * equally and keep their declaration order.
 */
export function routeSpecificity(href: string): { segments: number; dynamic: number } {
  const segments = hrefSegments(href)
  return {
    segments: segments.length,
    dynamic: segments.filter((segment) => segment.startsWith(":") || segment === "*").length,
  }
}

/**
 * Flatten a route map depth-first, children before their parent.
 *
 * Sibling order is the declaration order of the map, which is what keeps the result stable for
 * two routes of equal specificity.
 */
export function flattenRoutes<T extends RouteNode>(routes: Record<string, T>): T[] {
  const flat: T[] = []

  const walk = (route: T): void => {
    for (const child of Object.values(route.children ?? {}) as T[]) walk(child)
    flat.push(route)
  }

  for (const route of Object.values(routes)) walk(route)
  return flat
}

/**
 * Sort routes most specific first, without mutating the input.
 *
 * Ties keep the original order, so specificity never has to be exact for the result to be
 * deterministic. Sort before handing the list to `<Switch>`.
 */
export function sortRoutes<T extends RouteNode>(routes: readonly T[]): T[] {
  return routes
    .map((route, index) => ({ route, index }))
    .sort((left, right) => {
      const a = routeSpecificity(left.route.href)
      const b = routeSpecificity(right.route.href)
      return (
        b.segments - a.segments ||
        a.dynamic - b.dynamic ||
        right.route.href.length - left.route.href.length ||
        left.index - right.index
      )
    })
    .map(({ route }) => route)
}

/**
 * The full ordering: flatten the map, then sort by specificity.
 *
 * ```tsx
 * <Switch>
 *   {orderedRoutes(routes).map((route) => (
 *     <Route key={route.href} path={route.href} component={route.component} />
 *   ))}
 * </Switch>
 * ```
 */
export function orderedRoutes<T extends RouteNode>(routes: Record<string, T>): T[] {
  return sortRoutes(flattenRoutes(routes))
}
