import type { JSX } from "preact"
import { useId } from "preact/hooks"
import { join } from "@spy4x/preact-cn/join"
import { useLabels, useT } from "@spy4x/preact-ui/i18n"
import { DEFAULT_SURFACE_COLOR, DEFAULT_TEXT_COLOR } from "./colors.ts"
import type { KpiTone } from "./kpi.tsx"

/** One box of a {@link DependencyGraph}. */
export interface GraphNode {
  /** Unique key; edges name nodes by it. A second node with the same `id` is left out. */
  id: string
  /** The text in the box, cut to about twenty characters there and given in full on hover. */
  label: string
  /** Makes the box a link, and a Tab stop. */
  href?: string
  /** The outline's and the dot's colour, the same tones as `Kpi`. Defaults to `"neutral"`. */
  tone?: KpiTone
  /** Draws a thicker outline, for the box to look at first. */
  emphasis?: boolean
  /** A short second line in the box, such as `"3 steps"` or `"#2"`. */
  badge?: string
  /** Read by screen readers and shown on hover, never drawn in the box. */
  description?: string
}

/** One arrow of a {@link DependencyGraph}: `from` comes first and is drawn to the left of `to`. */
export interface GraphEdge {
  /** The `id` of the node that comes first. */
  from: string
  /** The `id` of the node that waits on it. */
  to: string
  /** Defaults to `"solid"`. */
  style?: "solid" | "dashed"
  /** The line's and the arrowhead's colour. Defaults to `"neutral"`. */
  tone?: KpiTone
}

/** Where {@link layoutGraph} put one node. */
export interface PlacedNode {
  /** The node's `id`. */
  id: string
  /** Its position in the `nodes` array given to {@link layoutGraph}. */
  index: number
  /** `0` for a node nothing comes before; else one more than the column of the latest node before it. */
  column: number
  /** Its place in its column, from `0` at the top. */
  row: number
}

/** An edge {@link layoutGraph} keeps, between two known, different nodes. */
export interface PlacedEdge {
  from: string
  to: string
  /** Its position in the `edges` array given to {@link layoutGraph}. */
  index: number
  /** It closes a cycle, so it points left or within its column. */
  back: boolean
}

/** The result of {@link layoutGraph}. */
export interface GraphLayout {
  /** Every node, column by column and top to bottom: the order to draw and to Tab through. */
  nodes: PlacedNode[]
  /** The edges to draw, each pair once, in input order. */
  edges: PlacedEdge[]
  /** How many columns there are. `0` for no nodes. */
  columns: number
  /** How many rows the tallest column has. */
  rows: number
  /** The edges that close a cycle, self-loops included, so an app can warn about them. */
  cycles: { from: string; to: string }[]
  /** The edges left out because `from` or `to` names no node. */
  unknown: { from: string; to: string }[]
}

/** How many times {@link layoutGraph} reorders the columns: each time sweeps right, then left. */
const ORDER_PASSES = 4

/**
 * Lays a directed graph out in columns, left to right, without a layout library.
 *
 * A node's column is the length of the longest chain of edges that ends at it. Within each column,
 * a few barycentre passes sort the nodes by the average row of their neighbours, first those to the
 * left, then those to the right, so fewer lines cross; ties keep the order before the pass, which
 * starts as the input order, so the same input always gives the same layout.
 *
 * Nothing here throws or hangs. A depth-first search finds the edges that close a cycle; they are
 * left out of the column count, still returned to draw, and listed in `cycles` (a self-loop is
 * listed there and not drawn). An edge naming an unknown node is dropped and listed in `unknown`.
 * A repeated edge is kept once, the first time it appears. Every step is linear in nodes and edges,
 * apart from a sort per column per pass.
 *
 * @param nodes The nodes, each with a unique `id`; a repeated `id` keeps its first node.
 * @param edges The edges, `from` the node that comes first.
 * @returns Where each node goes and which edges to draw.
 */
export function layoutGraph(
  nodes: readonly { id: string }[],
  edges: readonly { from: string; to: string }[],
): GraphLayout {
  const slot = new Map<string, number>()
  const ids: string[] = []
  const inputIndex: number[] = []
  nodes.forEach((node, index) => {
    if (slot.has(node.id)) return
    slot.set(node.id, ids.length)
    ids.push(node.id)
    inputIndex.push(index)
  })
  const count = ids.length

  const unknown: { from: string; to: string }[] = []
  const cycles: { from: string; to: string }[] = []
  const kept: { from: number; to: number; index: number }[] = []
  const seen = new Set<string>()
  edges.forEach((edge, index) => {
    const from = slot.get(edge.from)
    const to = slot.get(edge.to)
    if (from === undefined || to === undefined) {
      unknown.push({ from: edge.from, to: edge.to })
      return
    }
    const key = `${from} ${to}`
    if (seen.has(key)) return
    seen.add(key)
    if (from === to) cycles.push({ from: edge.from, to: edge.to })
    else kept.push({ from, to, index })
  })

  const out: number[][] = Array.from({ length: count }, () => [])
  kept.forEach((edge, position) => out[edge.from].push(position))

  // Iterative depth-first search: an edge to a node still on the stack closes a cycle.
  const back = new Array<boolean>(kept.length).fill(false)
  const state = new Uint8Array(count) // 0 unvisited, 1 on the stack, 2 done
  const cursor = new Uint32Array(count)
  for (let root = 0; root < count; root++) {
    if (state[root] !== 0) continue
    const stack = [root]
    state[root] = 1
    while (stack.length > 0) {
      const node = stack[stack.length - 1]
      if (cursor[node] === out[node].length) {
        state[node] = 2
        stack.pop()
        continue
      }
      const position = out[node][cursor[node]++]
      const next = kept[position].to
      if (state[next] === 1) back[position] = true
      else if (state[next] === 0) {
        state[next] = 1
        stack.push(next)
      }
    }
  }
  kept.forEach((edge, position) => {
    if (back[position]) cycles.push({ from: ids[edge.from], to: ids[edge.to] })
  })

  // Longest chain before each node, over the edges that are left: a topological sweep.
  const column = new Array<number>(count).fill(0)
  const waiting = new Array<number>(count).fill(0)
  const before: number[][] = Array.from({ length: count }, () => [])
  const after: number[][] = Array.from({ length: count }, () => [])
  kept.forEach((edge, position) => {
    if (back[position]) return
    waiting[edge.to]++
    after[edge.from].push(edge.to)
    before[edge.to].push(edge.from)
  })
  const ready: number[] = []
  for (let node = 0; node < count; node++) if (waiting[node] === 0) ready.push(node)
  for (let head = 0; head < ready.length; head++) {
    const node = ready[head]
    for (const next of after[node]) {
      column[next] = Math.max(column[next], column[node] + 1)
      if (--waiting[next] === 0) ready.push(next)
    }
  }

  const columns = count === 0 ? 0 : Math.max(...column) + 1
  const byColumn: number[][] = Array.from({ length: columns }, () => [])
  for (let node = 0; node < count; node++) byColumn[column[node]].push(node)
  const row = new Array<number>(count).fill(0)
  const number = (list: number[]) => list.forEach((node, place) => row[node] = place)
  byColumn.forEach(number)

  /** Sorts one column by the average row of each node's neighbours on one side. */
  const reorder = (list: number[], neighbours: number[][]) => {
    const key = new Map<number, number>()
    for (const node of list) {
      const around = neighbours[node]
      key.set(
        node,
        around.length === 0
          ? row[node]
          : around.reduce((sum, other) => sum + row[other], 0) / around.length,
      )
    }
    list.sort((a, b) => key.get(a)! - key.get(b)! || row[a] - row[b])
    number(list)
  }
  for (let pass = 0; pass < ORDER_PASSES; pass++) {
    for (let at = 1; at < columns; at++) reorder(byColumn[at], before)
    for (let at = columns - 2; at >= 0; at--) reorder(byColumn[at], after)
  }

  return {
    nodes: byColumn.flatMap((list, at) =>
      list.map((node) => ({ id: ids[node], index: inputIndex[node], column: at, row: row[node] }))
    ),
    edges: kept.map((edge, position) => ({
      from: ids[edge.from],
      to: ids[edge.to],
      index: edge.index,
      back: back[position],
    })),
    columns,
    rows: byColumn.reduce((most, list) => Math.max(most, list.length), 0),
    cycles,
    unknown,
  }
}

/** Props of {@link DependencyGraph}. */
export interface DependencyGraphProps {
  /** The boxes. Their order is kept within a column wherever it crosses no more lines. */
  nodes: readonly GraphNode[]
  /** The arrows, from the node that comes first to the one that waits on it. */
  edges: readonly GraphEdge[]
  /** The graph's accessible name, such as `"Release plan"`: only the caller knows it. */
  label: string
  /** What an empty graph says. Defaults to `"No data"`. */
  emptyLabel?: string
  /** The screen-reader line for what a node waits on, from the names joined into a list. */
  dependsOnLabel?: (names: string) => string
  /** The screen-reader line for what waits on a node. */
  neededByLabel?: (names: string) => string
  /**
   * Added after the frame's own classes, not merged over them (`join`, so an island that renders
   * it carries no tailwind-merge).
   */
  class?: string
}

const NODE_WIDTH = 184
const NODE_HEIGHT = 56
const COLUMN_GAP = 64
const ROW_GAP = 16
/** Room around the boxes for the focus ring and the arrowheads. */
const MARGIN = 8
/** Room under the boxes for the loops of edges that close a cycle. */
const LOOP_ROOM = 48
const LABEL_CHARACTERS = 20
const BADGE_CHARACTERS = 24
/**
 * The most chain memberships the hover and focus highlight writes into the markup. Each node's
 * chain is written on every node and edge in it, so a long chain costs its length squared; past
 * this the graph is drawn without the highlight rather than as megabytes of attributes.
 */
const HIGHLIGHT_BUDGET = 50_000

/** Colour classes per tone, drawn through `currentColor`, both palettes reading 3:1 or more. */
const TONE_CLASSES: Record<KpiTone, string> = {
  accent: "text-accent-900 dark:text-accent-300",
  positive: "text-success",
  warning: "text-warning",
  negative: "text-danger",
  neutral: "text-muted",
}
const TONES = Object.keys(TONE_CLASSES) as KpiTone[]
/** A tone the type does not know, from a caller without TypeScript, draws as neutral. */
const toneOf = (tone: string | undefined): KpiTone =>
  tone !== undefined && tone in TONE_CLASSES ? tone as KpiTone : "neutral"

const FOREGROUND = "var(--color-foreground, oklch(0.13 0.028 261.692))"
const RING = "var(--color-ring, oklch(0.496 0.265 301.924))"

/**
 * Cuts `text` to `max` characters, the last one an ellipsis, without splitting a character.
 *
 * @param text The text.
 * @param max The most characters to keep.
 * @returns The text, or its start and `…`.
 */
function truncate(text: string, max: number): string {
  const characters = [...text]
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join("").trimEnd()}…`
}

/**
 * For each node, in draw order, the nodes and edges before and after it in its chains.
 *
 * @returns Per drawn node and per drawn edge, the draw indexes of the nodes whose chain it is in;
 * or `undefined` once the memberships pass {@link HIGHLIGHT_BUDGET}.
 */
function chains(
  layout: GraphLayout,
): { nodes: number[][]; edges: number[][] } | undefined {
  const at = new Map(layout.nodes.map((node, index) => [node.id, index]))
  const count = layout.nodes.length
  const forward: [number, number][][] = Array.from({ length: count }, () => [])
  const backward: [number, number][][] = Array.from({ length: count }, () => [])
  layout.edges.forEach((edge, index) => {
    forward[at.get(edge.from)!].push([at.get(edge.to)!, index])
    backward[at.get(edge.to)!].push([at.get(edge.from)!, index])
  })
  const nodes: number[][] = Array.from({ length: count }, () => [])
  const edges: number[][] = layout.edges.map(() => [])
  const mark = new Int32Array(count).fill(-1)
  const edgeMark = new Int32Array(layout.edges.length).fill(-1)
  let spent = 0
  for (let start = 0; start < count; start++) {
    mark[start] = start
    nodes[start].push(start)
    spent++
    // Walking the edges backwards finds the nodes before it, forwards those after it. Every edge
    // walked lies on such a chain, so it is highlighted too.
    for (const direction of [backward, forward]) {
      const queue = [start]
      for (let head = 0; head < queue.length; head++) {
        for (const [next, edge] of direction[queue[head]]) {
          if (edgeMark[edge] !== start) {
            edgeMark[edge] = start
            edges[edge].push(start)
            spent++
          }
          if (mark[next] === start) continue
          mark[next] = start
          nodes[next].push(start)
          queue.push(next)
          spent++
        }
        if (spent > HIGHLIGHT_BUDGET) return undefined
      }
    }
  }
  return { nodes, edges }
}

/**
 * The highlight as a stylesheet scoped to one graph: while a node is hovered or has keyboard focus,
 * everything else dims and the nodes and edges in its chains stay. Plain CSS (`:has()`), so it works
 * in markup a server rendered with no script at all.
 */
function highlightCss(scope: string, count: number): string {
  const graph = `[data-graph="${scope}"]`
  const active = ":is(:hover,:focus-visible)"
  const rules = [
    `@media (prefers-reduced-motion: no-preference){${graph} [data-chain]{transition:opacity 150ms ease-out}}`,
    `${graph}:has([data-node]${active}) [data-chain]{opacity:.2}`,
  ]
  for (let node = 0; node < count; node++) {
    rules.push(`${graph}:has([data-node="${node}"]${active}) [data-chain~="${node}"]{opacity:1}`)
  }
  return rules.join("\n")
}

/**
 * A server-rendered SVG graph of boxes joined by arrows, laid out left to right by
 * {@link layoutGraph}: what comes first on the left, what waits on it to the right.
 *
 * Edges are curves with arrowheads, dashed for `style: "dashed"`, coloured by tone; an edge that
 * closes a cycle loops under the boxes. Hovering a node, or focusing one that is a link, keeps the
 * nodes and edges before and after it and dims the rest, with CSS alone, so it works without any
 * script. A node with `href` is a link named by its label, badge and description, and Tab moves
 * through the links column by column. A list only screen readers read follows the graph and says
 * what each node depends on and what needs it. The frame scrolls sideways inside its parent and
 * never widens the page; it is a Tab stop, so a keyboard can scroll it too.
 *
 * @param props The nodes, edges and words, see {@link DependencyGraphProps}.
 * @returns The scrolling frame with the graph and the list, or the empty state.
 */
export function DependencyGraph({
  nodes,
  edges,
  label,
  emptyLabel: emptyLabelProp,
  dependsOnLabel: dependsOnProp,
  neededByLabel: neededByProp,
  class: className,
}: DependencyGraphProps): JSX.Element {
  const { emptyLabel, dependsOn, neededBy } = useLabels("DependencyGraph", {
    emptyLabel: "No data",
    dependsOn: (names: string) => `depends on ${names}`,
    neededBy: (names: string) => `needed by ${names}`,
  }, {
    emptyLabel: emptyLabelProp,
    dependsOn: dependsOnProp,
    neededBy: neededByProp,
  }, { dependsOn: ["names"], neededBy: ["names"] })
  const language = useT().language
  const scope = useId().replace(/[^\w-]/g, "")

  if (nodes.length === 0) {
    return (
      <p class={join("text-sm", className)} style={{ color: DEFAULT_TEXT_COLOR }}>{emptyLabel}</p>
    )
  }

  const layout = layoutGraph(nodes, edges)
  const chain = chains(layout)
  const place = new Map(layout.nodes.map((node) => [node.id, node]))
  const hasLoops = layout.edges.some((edge) => edge.back)
  const width = MARGIN * 2 + layout.columns * NODE_WIDTH + (layout.columns - 1) * COLUMN_GAP
  const height = MARGIN * 2 + layout.rows * NODE_HEIGHT + (layout.rows - 1) * ROW_GAP +
    (hasLoops ? LOOP_ROOM : 0)
  const left = (node: PlacedNode) => MARGIN + node.column * (NODE_WIDTH + COLUMN_GAP)
  const top = (node: PlacedNode) => MARGIN + node.row * (NODE_HEIGHT + ROW_GAP)
  const arrow = (tone: KpiTone) => `${scope}-arrow-${tone}`

  const path = (from: PlacedNode, to: PlacedNode, back: boolean) => {
    if (back) {
      const x1 = left(from) + NODE_WIDTH / 2
      const x2 = left(to) + NODE_WIDTH / 2
      const y1 = top(from) + NODE_HEIGHT
      const y2 = top(to) + NODE_HEIGHT
      const low = Math.max(y1, y2) + LOOP_ROOM
      return `M${x1} ${y1}C${x1} ${low} ${x2} ${low} ${x2} ${y2 + 2}`
    }
    const x1 = left(from) + NODE_WIDTH
    const y1 = top(from) + NODE_HEIGHT / 2
    const x2 = left(to) - 2
    const y2 = top(to) + NODE_HEIGHT / 2
    const bend = Math.max(COLUMN_GAP / 2, (x2 - x1) / 2)
    return `M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`
  }

  const list = new Intl.ListFormat(language, { type: "conjunction" })
  const before = new Map<string, string[]>()
  const after = new Map<string, string[]>()
  for (const edge of layout.edges) {
    if (!before.has(edge.to)) before.set(edge.to, [])
    if (!after.has(edge.from)) after.set(edge.from, [])
    before.get(edge.to)!.push(edge.from)
    after.get(edge.from)!.push(edge.to)
  }
  const named = (ids: string[]) => list.format(ids.map((id) => nodes[place.get(id)!.index].label))

  return (
    <div class={join("flex min-w-0 flex-col", className)}>
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        data-graph={scope}
        class="max-w-full overflow-x-auto rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
      >
        {chain && (
          <style dangerouslySetInnerHTML={{ __html: highlightCss(scope, layout.nodes.length) }} />
        )}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} class="max-w-none">
          <defs aria-hidden="true">
            {TONES.map((tone) => (
              <marker
                key={tone}
                id={arrow(tone)}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                class={TONE_CLASSES[tone]}
              >
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
            ))}
          </defs>
          <g aria-hidden="true" fill="none" stroke-width="1.5">
            {layout.edges.map((edge, index) => {
              const given = edges[edge.index]
              const tone = toneOf(given.tone)
              return (
                <path
                  key={`${edge.from} ${edge.to}`}
                  d={path(place.get(edge.from)!, place.get(edge.to)!, edge.back)}
                  class={TONE_CLASSES[tone]}
                  stroke="currentColor"
                  stroke-dasharray={given.style === "dashed" ? "6 4" : undefined}
                  marker-end={`url(#${arrow(tone)})`}
                  data-edge={index}
                  data-chain={chain?.edges[index].join(" ")}
                />
              )
            })}
          </g>
          {layout.nodes.map((placed, index) => {
            const node = nodes[placed.index]
            const tone = toneOf(node.tone)
            const full = [node.label, node.badge, node.description].filter(Boolean).join(", ")
            const x = left(placed)
            const y = top(placed)
            const body = (
              <>
                <title>{full}</title>
                {node.href && (
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width={NODE_WIDTH + 8}
                    height={NODE_HEIGHT + 8}
                    rx="11"
                    fill="none"
                    stroke={RING}
                    stroke-width="2"
                    class="opacity-0 group-focus-visible:opacity-100"
                  />
                )}
                <rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="8"
                  stroke="currentColor"
                  stroke-width={node.emphasis ? 3 : 1.5}
                  style={{ fill: DEFAULT_SURFACE_COLOR }}
                />
                <circle cx={x + 16} cy={y + 20} r="4" fill="currentColor" />
                <text
                  x={x + 28}
                  y={y + 25}
                  class={join("text-sm", node.emphasis ? "font-semibold" : "font-medium")}
                  style={{ fill: FOREGROUND }}
                >
                  {truncate(node.label, LABEL_CHARACTERS)}
                </text>
                {node.badge && (
                  <text x={x + 28} y={y + 44} class="text-xs" style={{ fill: DEFAULT_TEXT_COLOR }}>
                    {truncate(node.badge, BADGE_CHARACTERS)}
                  </text>
                )}
              </>
            )
            const common = {
              key: placed.id,
              "data-node": index,
              "data-chain": chain?.nodes[index].join(" "),
            }
            return node.href
              ? (
                <a
                  {...common}
                  href={node.href}
                  aria-label={full}
                  class={join("group outline-hidden", TONE_CLASSES[tone])}
                >
                  {body}
                </a>
              )
              : (
                <g {...common} aria-hidden="true" class={TONE_CLASSES[tone]}>
                  {body}
                </g>
              )
          })}
        </svg>
      </div>
      <ul class="sr-only">
        {layout.nodes.map((placed) => {
          const into = before.get(placed.id) ?? []
          const outOf = after.get(placed.id) ?? []
          const node = nodes[placed.index]
          const parts = [
            into.length > 0 && dependsOn(named(into)),
            outOf.length > 0 && neededBy(named(outOf)),
          ].filter(Boolean)
          return (
            <li key={placed.id}>
              {[node.label, node.badge, node.description].filter(Boolean).join(", ")}
              {parts.length > 0 && `: ${parts.join("; ")}`}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
