import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options, type VNode } from "preact"
import { render } from "preact-render-to-string"
import { Link } from "@spy4x/preact-ui/link"
import { type RankedBarColumns, type RankedBarRow, RankedBars } from "./ranked-bars.tsx"

describe("RankedBars", () => {
  const columns: RankedBarColumns = {
    label: "Source",
    value: "Visits",
    extra: [{ label: "Order clicks" }, {
      label: "Order rate",
      format: (value) => `${value.toFixed(1)}%`,
    }],
  }
  const sources: RankedBarRow[] = [
    { label: "Zalo group", value: 480, values: [24, 5], href: "?source=zalo" },
    { label: "Friends", value: 8, values: [0, null], lowSample: true },
  ]

  /** Every `<tr …>…</tr>` of the body, in order. */
  function bodyRows(html: string): string[] {
    const body = html.match(/<tbody>(.*)<\/tbody>/)?.[1] ?? ""
    return [...body.matchAll(/<tr[^>]*>.*?<\/tr>/g)].map((match) => match[0])
  }

  /** The text of every `<td>` in `row`. */
  function numbers(row: string): string[] {
    return [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((match) => match[1])
  }

  it("scales each bar against the largest value", () => {
    const rows: RankedBarRow[] = [{ label: "a", value: 40 }, { label: "b", value: 10 }]
    const widths = (html: string) => [...html.matchAll(/width:([\d.]+)%/g)].map((m) => m[1])

    expect(widths(render(<RankedBars data={rows} columns={columns} />))).toEqual(["100", "25"])
  })

  it("heads the label, the bar's number and every extra column", () => {
    const html = render(<RankedBars data={sources} columns={columns} />)
    const headers = [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((match) => match[1])

    expect(headers).toEqual(["Source", "Visits", "Order clicks", "Order rate"])
  })

  it("prints each row's numbers right-aligned in tabular figures, and a dash for a missing one", () => {
    const html = render(<RankedBars data={sources} columns={columns} />)
    const [zalo, friends] = bodyRows(html)

    expect(numbers(zalo)).toEqual(["480", "24", "5.0%"])
    expect(numbers(friends)).toEqual(["8", "0", "–"])
    const [broken] = bodyRows(
      render(<RankedBars data={[{ label: "x", value: NaN, values: [1, 2] }]} columns={columns} />),
    )
    expect(numbers(broken)[0]).toBe("–")
    for (const cell of zalo.match(/<td [^>]*>/g) ?? []) {
      expect(cell).toMatch(/\btext-end\b/)
      expect(cell).toMatch(/\btabular-nums\b/)
    }
  })

  it("moves the extra numbers to a muted second line on a phone, each after its header", () => {
    const html = render(<RankedBars data={sources} columns={columns} />)
    const [zalo] = bodyRows(html)

    expect(zalo).toMatch(
      /<span class="text-xs sm:hidden" style="color:var\(--color-muted-foreground[^"]*"><span class="sm:hidden">Order clicks 24 · Order rate 5\.0%<\/span><\/span>/,
    )
    const extraCells = (zalo.match(/<td [^>]*>/g) ?? []).slice(1)
    expect(extraCells.length).toBe(2)
    for (const cell of extraCells) expect(cell).toMatch(/\bmax-sm:hidden\b/)
  })

  it("makes a row with href a link and a row with onSelect a button, each covering the row", () => {
    const html = render(
      <RankedBars
        data={[sources[0], { label: "Instagram", value: 90, values: [2, 2.2], onSelect: () => {} }]}
        columns={columns}
      />,
    )
    const [link, button] = bodyRows(html)

    expect(link).toMatch(/<a href="\?source=zalo" class="[^"]*after:inset-0[^"]*">Zalo group<\/a>/)
    expect(button).toMatch(
      /<button type="button" class="[^"]*after:inset-0[^"]*">Instagram<\/button>/,
    )
    for (const row of [link, button]) {
      expect(row).toMatch(/^<tr [^>]*class="[^"]*\brelative\b/)
      expect(row).toMatch(/focus-visible:after:ring-2/)
    }
  })

  it("routes a plain click on a row link through navigate, as Link does", () => {
    const calls: string[] = []
    const links: VNode<{ href: string; navigate?: (href: string) => void }>[] = []
    const previousHook = options.vnode
    options.vnode = (vnode) => {
      if (vnode.type === Link) links.push(vnode as (typeof links)[number])
      previousHook?.(vnode)
    }
    try {
      render(
        <RankedBars data={[sources[0]]} columns={columns} navigate={(href) => calls.push(href)} />,
      )
    } finally {
      options.vnode = previousHook
    }

    expect(links.map((link) => link.props.href)).toEqual(["?source=zalo"])
    links[0].props.navigate?.("?source=zalo")
    expect(calls).toEqual(["?source=zalo"])
  })

  it("mutes a low-sample row and fades its bar", () => {
    const html = render(<RankedBars data={sources} columns={columns} />)
    const [zalo, friends] = bodyRows(html)

    expect(friends).toMatch(
      /^<tr data-low-sample="true" class="(?![^"]*text-foreground)[^"]*" style="color:/,
    )
    expect(friends).toContain('<span class="flex opacity-50">')
    expect(zalo).toMatch(/^<tr class="[^"]*\btext-foreground\b/)
    expect(zalo).not.toContain("opacity-50")
  })

  it("draws a row's image before its label at 40 px, lazy-loaded", () => {
    const html = render(
      <RankedBars
        data={[{
          label: "Linen shirt",
          value: 9,
          values: [210, 4],
          image: { src: "/s.jpg", alt: "Sand linen" },
        }]}
        columns={columns}
      />,
    )
    const [row] = bodyRows(html)

    expect(row).toMatch(
      /<img src="\/s\.jpg" alt="Sand linen" width="40" height="40" loading="lazy"[^>]*class="[^"]*\bsize-10\b[^"]*\brounded-md\b[^"]*"\/>.*Linen shirt/,
    )
    expect(bodyRows(render(<RankedBars data={sources} columns={columns} />)).join("")).not
      .toContain("<img")
  })

  it("shows a row's note under its label at every width, after the extra numbers on a phone", () => {
    const html = render(
      <RankedBars
        data={[{ label: "Linen shirt", value: 9, values: [210, 4], note: "mostly Zalo A" }]}
        columns={columns}
      />,
    )
    const [row] = bodyRows(html)

    expect(row).toMatch(
      /Linen shirt<\/span><span class="text-xs" style="color:var\(--color-muted-foreground[^"]*"><span class="sm:hidden">Order clicks 210 · Order rate 4\.0% · <\/span>mostly Zalo A<\/span>/,
    )
  })
})

describe("RankedBars, empty", () => {
  it("keeps its title and says there is no data instead of drawing a table", () => {
    const html = render(
      <RankedBars
        title="Sources"
        data={[]}
        columns={{ label: "a", value: "b", extra: [{ label: "c" }] }}
      />,
    )

    expect(html).toContain(">Sources</h3>")
    expect(html).toContain("No data")
    expect(html).not.toContain("<table")
  })
})
