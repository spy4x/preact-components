import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  DependencyGraph,
  type GraphEdge,
  type GraphNode,
  layoutGraph,
} from "./dependency-graph.tsx"

const ids = (...names: string[]) => names.map((id) => ({ id }))
const edge = (from: string, to: string) => ({ from, to })
/** Each node's column and row, by id. */
const places = (layout: ReturnType<typeof layoutGraph>) =>
  Object.fromEntries(layout.nodes.map((node) => [node.id, [node.column, node.row]]))

describe("layoutGraph", () => {
  it("puts each node one column after the longest chain before it", () => {
    // a → b → c, and a → c directly: c follows the longer chain, so it is in column 2, not 1.
    const layout = layoutGraph(ids("c", "b", "a"), [edge("a", "b"), edge("b", "c"), edge("a", "c")])
    expect(layout.nodes.map((node) => [node.id, node.column])).toEqual([["a", 0], ["b", 1], [
      "c",
      2,
    ]])
    expect(layout.columns).toBe(3)
    expect(layout.rows).toBe(1)
  })

  it("orders a column by its neighbours' rows, so the lines do not cross", () => {
    // Input order alone would draw x beside b and y beside a, crossing both lines.
    const layout = layoutGraph(ids("a", "b", "y", "x"), [edge("a", "x"), edge("b", "y")])
    expect(places(layout)).toEqual({ a: [0, 0], b: [0, 1], x: [1, 0], y: [1, 1] })
  })

  it("keeps the input order when the neighbours tie, and gives the same layout every time", () => {
    const nodes = ids("root", "p", "q", "r")
    const edges = [edge("root", "p"), edge("root", "q"), edge("root", "r")]
    const layout = layoutGraph(nodes, edges)
    expect(layout.nodes.map((node) => node.id)).toEqual(["root", "p", "q", "r"])
    expect(layoutGraph(nodes, edges)).toEqual(layout)
  })

  it("finds the edge that closes a cycle, lays out the rest, and still returns it to draw", () => {
    const layout = layoutGraph(ids("a", "b", "c"), [edge("a", "b"), edge("b", "c"), edge("c", "a")])
    expect(layout.cycles).toEqual([edge("c", "a")])
    expect(places(layout)).toEqual({ a: [0, 0], b: [1, 0], c: [2, 0] })
    expect(layout.edges.map((kept) => [kept.from, kept.to, kept.back])).toEqual([
      ["a", "b", false],
      ["b", "c", false],
      ["c", "a", true],
    ])
  })

  it("reports a self-loop as a cycle and does not draw it", () => {
    const layout = layoutGraph(ids("a"), [edge("a", "a")])
    expect(layout.cycles).toEqual([edge("a", "a")])
    expect(layout.edges).toEqual([])
  })

  it("drops an edge to an unknown node and reports it, without throwing", () => {
    const layout = layoutGraph(ids("a", "b"), [
      edge("a", "ghost"),
      edge("nobody", "b"),
      edge("a", "b"),
    ])
    expect(layout.unknown).toEqual([edge("a", "ghost"), edge("nobody", "b")])
    expect(layout.edges.map((kept) => [kept.from, kept.to])).toEqual([["a", "b"]])
  })

  it("keeps a repeated edge once, at its first place, and a repeated node id once", () => {
    const layout = layoutGraph(ids("a", "b", "a"), [edge("a", "b"), edge("a", "b")])
    expect(layout.edges).toEqual([{ from: "a", to: "b", index: 0, back: false }])
    expect(layout.nodes.map((node) => [node.id, node.index])).toEqual([["a", 0], ["b", 1]])
  })

  it("lays out nothing for no nodes", () => {
    expect(layoutGraph([], [])).toEqual({
      nodes: [],
      edges: [],
      columns: 0,
      rows: 0,
      cycles: [],
      unknown: [],
    })
  })

  it("lays out 2,000 nodes and 10,000 edges with exponentially many paths in under 2 seconds", () => {
    // A ladder of diamonds has 2^500 paths from end to end: enumerating paths would never finish.
    const nodes = Array.from({ length: 2000 }, (_, index) => ({ id: `n${index}` }))
    const edges: { from: string; to: string }[] = []
    for (let index = 0; index + 2 < 2000; index += 4) {
      edges.push(edge(`n${index}`, `n${index + 1}`), edge(`n${index}`, `n${index + 2}`))
      edges.push(edge(`n${index + 1}`, `n${index + 3}`), edge(`n${index + 2}`, `n${index + 3}`))
      if (index + 4 < 2000) edges.push(edge(`n${index + 3}`, `n${index + 4}`))
    }
    // Fill to 10,000 with deterministic forward edges and a few backward ones that close cycles.
    for (let index = 0; edges.length < 10_000; index++) {
      const from = (index * 7919) % 2000
      const to = (index * 104_729 + 13) % 2000
      if (from !== to) edges.push(edge(`n${from}`, `n${to}`))
    }
    const started = performance.now()
    const layout = layoutGraph(nodes, edges)
    const took = performance.now() - started
    expect(layout.nodes.length).toBe(2000)
    expect(layout.cycles.length).toBeGreaterThan(0)
    expect(took).toBeLessThan(2000)
  })
})

const plan: GraphNode[] = [
  { id: "design", label: "Design the schema", href: "/steps/design", tone: "positive" },
  { id: "api", label: "Build the API", badge: "3 steps", emphasis: true, tone: "warning" },
  {
    id: "docs",
    label: "Write the documentation for every endpoint",
    description: "Owned by the docs team",
  },
  { id: "launch", label: "Launch", href: "/steps/launch", tone: "accent" },
  { id: "aside", label: "Order stickers" },
]
const links: GraphEdge[] = [
  { from: "design", to: "api" },
  { from: "api", to: "launch", tone: "negative" },
  { from: "api", to: "docs", style: "dashed" },
  { from: "docs", to: "launch" },
]
const graph = (nodes = plan, edges = links) => (
  render(<DependencyGraph nodes={nodes} edges={edges} label="Release plan" />)
)

describe("DependencyGraph", () => {
  it("renders the whole graph on the server: a box per node and a curved arrow per edge", () => {
    const html = graph()
    expect(html.match(/<[ag] data-node="/g)?.length).toBe(5)
    expect(html.match(/<path[^>]*data-edge="/g)?.length).toBe(4)
    expect(html).toMatch(/<path d="M\d+ \d+C[\d ]+"/)
    expect(html).toContain('marker-end="url(#')
    expect(html).toContain('role="group" aria-label="Release plan" tabindex="0"')
  })

  it("makes a node with href a named link and leaves the others out of the Tab order", () => {
    const html = graph()
    expect(html).toMatch(/<a [^>]*href="\/steps\/design" aria-label="Design the schema"/)
    expect(html).toContain('aria-label="Launch"')
    expect(html.match(/<a /g)?.length).toBe(2)
    expect(html).toMatch(/<g data-node="\d" [^>]*aria-hidden="true"/)
  })

  it("draws the nodes column by column, so Tab follows the columns", () => {
    const order = [...graph().matchAll(/data-node="\d"[^>]*>\s*<title>([^<]+)</g)].map((match) =>
      match[1].split(",")[0]
    )
    expect(order).toEqual([
      "Design the schema",
      "Order stickers",
      "Build the API",
      "Write the documentation for every endpoint",
      "Launch",
    ])
  })

  it("names a link by its label, badge and description", () => {
    const html = graph([
      { id: "a", label: "Ship", badge: "#2", description: "Waiting on review", href: "/a" },
    ], [])
    expect(html).toContain('aria-label="Ship, #2, Waiting on review"')
  })

  it("cuts a long label in the box and keeps it whole in the title and the list", () => {
    const html = graph()
    expect(html).toContain(">Write the documenta…</text>")
    expect(html).toContain(
      "<title>Write the documentation for every endpoint, Owned by the docs team",
    )
    expect(html).toContain("<li>Write the documentation for every endpoint, Owned by the docs team")
  })

  it("dashes a dashed edge and leaves a solid one solid", () => {
    const html = graph()
    expect(html.match(/stroke-dasharray="6 4"/g)?.length).toBe(1)
  })

  it("draws an emphasised node with a thicker outline", () => {
    const html = graph()
    expect(html.match(/stroke-width="3"/g)?.length).toBe(1)
  })

  it("colours a node and an edge by tone, and an unknown tone as neutral", () => {
    const html = graph([
      { id: "a", label: "A", tone: "positive" },
      { id: "b", label: "B", tone: "purple" as never },
    ], [{ from: "a", to: "b", tone: "negative" }])
    expect(html).toMatch(/data-node="0"[^>]*class="text-success"/)
    expect(html).toMatch(/data-node="1"[^>]*class="text-muted"/)
    expect(html).toMatch(/class="text-danger"[^>]*marker-end="url\(#[\w-]+-arrow-negative\)"/)
  })

  it("lists every node's relations for screen readers", () => {
    const html = graph()
    expect(html).toContain(
      "<li>Build the API, 3 steps: depends on Design the schema; needed by Launch and Write the " +
        "documentation for every endpoint</li>",
    )
    expect(html).toContain("<li>Order stickers</li>")
  })

  it("highlights a node's whole chain on hover and focus, with CSS alone", () => {
    const html = graph()
    // Nodes in draw order: design 0, aside 1, api 2, docs 3, launch 4. Docs' chain is design,
    // api, docs and launch, never the unrelated stickers.
    expect(html).toContain(':has([data-node="3"]:is(:hover,:focus-visible)) [data-chain~="3"]')
    expect(html).toMatch(/data-node="0" data-chain="0 2 3 4"/)
    expect(html).toMatch(/data-node="1" data-chain="1"/)
    // design → api lies before docs; api → launch lies on api's chain but not on docs'.
    expect(html).toMatch(/data-edge="0" data-chain="0 2 3 4"/)
    expect(html).toMatch(/data-edge="1" data-chain="0 2 4"/)
    expect(html).not.toContain("<script")
  })

  it("leaves the highlight out of a graph whose chains would bloat the markup", () => {
    const nodes = Array.from(
      { length: 400 },
      (_, index) => ({ id: `n${index}`, label: `N${index}` }),
    )
    const edges = nodes.slice(1).map((node, index) => ({ from: `n${index}`, to: node.id }))
    const html = graph(nodes, edges)
    expect(html).not.toContain("data-chain")
    expect(html).not.toContain("<style")
    expect(html.match(/data-node="/g)?.length).toBe(400)
  })

  it("loops an edge that closes a cycle under the boxes and draws the graph", () => {
    const html = graph([{ id: "a", label: "A" }, { id: "b", label: "B" }], [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ])
    expect(html.match(/data-edge="/g)?.length).toBe(2)
    // Two boxes in two columns: 2 × 184 + 64 + 16 wide; one row plus the loop room: 56 + 16 + 48.
    expect(html).toContain('width="448" height="120"')
  })

  it("shows a short empty state for no nodes, not an empty picture", () => {
    const html = render(<DependencyGraph nodes={[]} edges={[]} label="Plan" />)
    expect(html).toContain(">No data</p>")
    expect(html).not.toContain("<svg")
  })

  it("takes its words from props", () => {
    const html = render(
      <DependencyGraph
        nodes={[{ id: "a", label: "A" }, { id: "b", label: "B" }]}
        edges={[{ from: "a", to: "b" }]}
        label="Plan"
        dependsOnLabel={(names) => `after ${names}`}
        neededByLabel={(names) => `before ${names}`}
      />,
    )
    expect(html).toContain("<li>A: before B</li>")
    expect(html).toContain("<li>B: after A</li>")
    expect(render(<DependencyGraph nodes={[]} edges={[]} label="Plan" emptyLabel="No steps yet" />))
      .toContain(">No steps yet</p>")
  })
})
