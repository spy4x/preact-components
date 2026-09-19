/**
 * The CRUD section.
 *
 * A placeholder: the section is being written, and this is the one card that exists so far.
 * `CrudList` is the package's centrepiece — a title, a search box and a table whose cells the caller
 * supplies as slots — so it is the card worth having first. This demo passes the `rows` source (a
 * signal the page owns); the store-backed source, the editor, the association editor and the field
 * set are listed in `PENDING_DEMOS` in `../registry.ts`.
 */

import { CrudList } from "@preact-components/crud/crud-list"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

/** The rows the demo lists: no store, no fetch, nothing that would need a server at build time. */
interface Region {
  id: number
  name: string
  zones: number
}

const rows: Region[] = [
  { id: 1, name: "North", zones: 4 },
  { id: 2, name: "South", zones: 0 },
  { id: 3, name: "Midlands", zones: 7 },
]

/** Stateful, so each render of the catalogue owns its own rows rather than sharing one signal. */
function CrudListDemo() {
  const source = useSignal(rows)

  return (
    <CrudList
      title="Regions"
      rows={source}
      match={(row, word) => row.name.toLowerCase().includes(word.toLowerCase())}
      header={
        <>
          <th scope="col" class="px-3 py-2 text-left">Name</th>
          <th scope="col" class="px-3 py-2 text-left">Zones</th>
        </>
      }
      row={(item) => (
        <>
          <td class="px-3 py-2">{item.name}</td>
          <td class="px-3 py-2">{item.zones}</td>
        </>
      )}
    />
  )
}

export const crudDemos = {
  CrudList: {
    summary:
      "Placeholder — this section is being written. A resource list from a `rows` signal: title, search box and a table whose header and cells are slots. The store-backed source, the editor and the field set are still to come.",
    snippet: `<CrudList
  title="Regions"
  rows={rows}
  match={(row, word) => row.name.includes(word)}
  header={<th scope="col">Name</th>}
  row={(row) => <td>{row.name}</td>}
/>`,
    render: () => <CrudListDemo />,
  },
} satisfies DemoFragment<"CrudList">
