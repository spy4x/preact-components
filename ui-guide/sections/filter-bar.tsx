/**
 * The `FilterBar` card: a list of notes searched, filtered and sorted live by one bar. Spread into
 * the page-header demos, right after `PageHeader`, because the bar sits under a list page's header.
 *
 * What only a browser shows — the menus' keys and focus, the sheet on a phone, the row that scrolls
 * sideways at 390 px — is driven by `pages/e2e/ui.spec.ts`.
 */

import { DropdownItem, FilterBar } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** One row of the demo's list. */
interface DemoNoteRow {
  title: string
  author: string
  tags: string[]
  updated: number
  created: number
}

const NOTES: DemoNoteRow[] = [
  {
    title: "Q4 planning: hiring and budget",
    author: "maya",
    tags: ["design", "plans"],
    updated: 9,
    created: 2,
  },
  { title: "Welcome", author: "you", tags: [], updated: 1, created: 1 },
  { title: "Design review notes", author: "you", tags: ["design"], updated: 8, created: 6 },
  { title: "Launch checklist", author: "leo", tags: ["plans", "launch"], updated: 7, created: 5 },
  { title: "Interview questions", author: "maya", tags: ["hiring"], updated: 4, created: 3 },
]

const TAGS = [
  { value: "design", label: "Design" },
  { value: "plans", label: "Plans" },
  { value: "launch", label: "Launch" },
  { value: "hiring", label: "Hiring" },
]

const AUTHORS = [
  { value: "you", label: "You" },
  { value: "leo", label: "Leo Park" },
  { value: "maya", label: "Maya Chen" },
]

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
]

/** The notes the bar's values let through, in the chosen order. */
function visibleNotes(
  query: string,
  tags: string[],
  match: string,
  author: string | null,
  mine: boolean,
  sort: string,
): DemoNoteRow[] {
  const needle = query.trim().toLowerCase()
  const shown = NOTES.filter((note) =>
    note.title.toLowerCase().includes(needle) &&
    (tags.length === 0 ||
      (match === "all"
        ? tags.every((tag) => note.tags.includes(tag))
        : tags.some((tag) => note.tags.includes(tag)))) &&
    (author === null || note.author === author) &&
    (!mine || note.author === "you")
  )
  return shown.sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title)
      : sort === "created"
      ? b.created - a.created
      : b.updated - a.updated
  )
}

/** A notes list under a bar with every part: search, two menus, a toggle, a sort and a count. */
function FilterBarDemo() {
  const query = useSignal("")
  const tags = useSignal<string[]>(["design"])
  const match = useSignal("any")
  const author = useSignal<string | null>(null)
  const mine = useSignal(false)
  const sort = useSignal("updated")
  const notes = visibleNotes(
    query.value,
    tags.value,
    match.value,
    author.value,
    mine.value,
    sort.value,
  )
  // Counts within the other filters, so a number says what choosing the tag would show.
  const tagCount = (tag: string) =>
    visibleNotes(query.value, [tag], "any", author.value, mine.value, sort.value).length

  return (
    <div class="flex flex-col gap-4">
      <FilterBar
        search={{
          value: query.value,
          onChange: (next) => query.value = next,
          label: "Search notes",
          hotkeyHint: "/",
        }}
        filters={[
          {
            id: "tags",
            label: "Tags",
            chipLabel: "Tag",
            multiple: true,
            options: TAGS.map((tag) => ({ ...tag, count: tagCount(tag.value) })),
            value: tags.value,
            onChange: (next) => tags.value = next,
            headerLabel: "Show notes with",
            header: (
              <>
                <DropdownItem
                  checked={match.value === "any"}
                  keepOpen
                  onClick={() => match.value = "any"}
                >
                  Any of these tags
                </DropdownItem>
                <DropdownItem
                  checked={match.value === "all"}
                  keepOpen
                  onClick={() => match.value = "all"}
                >
                  All of these tags
                </DropdownItem>
              </>
            ),
          },
          {
            id: "author",
            label: "Author",
            anyLabel: "Anyone",
            options: AUTHORS,
            value: author.value,
            onChange: (next) => author.value = next,
          },
        ]}
        toggles={[
          {
            id: "mine",
            label: "Created by me",
            pressed: mine.value,
            onChange: (next) => mine.value = next,
          },
        ]}
        sort={{ options: SORTS, value: sort.value, onChange: (next) => sort.value = next }}
        count={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
      />
      {notes.length > 0
        ? (
          <ul class="divide-y divide-subtle rounded-md border border-subtle bg-surface">
            {notes.map((note) => (
              <li key={note.title} class="px-4 py-3 text-sm">
                <span class="font-medium text-foreground">{note.title}</span>
                <span class="block text-xs text-muted">
                  {AUTHORS.find((a) => a.value === note.author)?.label}
                  {note.tags.length > 0
                    ? ` · ${
                      note.tags.map((tag) => TAGS.find((t) => t.value === tag)?.label).join(", ")
                    }`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )
        : <p class="text-sm text-muted">No notes match these filters.</p>}
      <DemoNote e2e="filter-bar-state">
        q: {query.value || "(empty)"} · tags: {tags.value.join(", ") || "(none)"}{" "}
        ({match.value}) · author: {author.value ?? "(anyone)"} · mine: {mine.value ? "on" : "off"}
        {" "}
        · sort: {sort.value}
      </DemoNote>
    </div>
  )
}

export const filterBarDemos = {
  FilterBar: {
    summary:
      "Search, filter menus, one-tap toggles and a sort over a list, with the active filters as removable chips and a result count.",
    wide: true,
    props: [
      {
        name: "search",
        type: "{ value, onChange, label?, placeholder?, hotkeyHint?, clearLabel? }",
        description:
          "A search field with a clear button; `hotkeyHint` shows a key the app already binds, such as `/`.",
      },
      {
        name: "filters",
        type: "FilterBarMenu[]",
        description:
          "One menu each: `{ id, label, options, value, onChange }`, with `multiple: true` for boxes that keep the menu open (with a Done item on a phone), `chipLabel`, `anyLabel`, `activeLabel`, and a `header` slot with an optional `headerLabel`.",
      },
      {
        name: "toggles",
        type: "{ id, label, pressed, onChange }[]",
        description: "One-tap filters, drawn as `ToggleChips`.",
      },
      {
        name: "sort",
        type: "{ options, value, onChange, label? }",
        description: "A menu at the end of the row; its label shows from `sm` up.",
      },
      {
        name: "count",
        type: "ComponentChildren",
        description: "The muted result count, announced politely when it changes.",
      },
      {
        name: "onClear",
        type: "() => void",
        description:
          "Clears every filter in one go, such as `clearFilters` of a `useUrlFilters` that holds only the filters; left out, each filter gets its own `onChange`.",
      },
    ],
    snippet: `// Every value lives in the URL; \`useUrlFilters\` is in @spy4x/preact-signals.
const { filters: f } = useUrlFilters({
  q: { signal: useSignal(""), urlParam: "q", initialValue: "" },
  tags: { signal: useSignal(""), urlParam: "tags", initialValue: "" },
  mine: { signal: useSignal(""), urlParam: "mine", initialValue: "" },
  sort: { signal: useSignal("updated"), urlParam: "sort", initialValue: "updated" },
})

<FilterBar
  search={{ value: f.q.value, onChange: (q) => f.q.value = q, label: "Search notes", hotkeyHint: "/" }}
  filters={[{
    id: "tags",
    label: "Tags",
    chipLabel: "Tag",
    multiple: true,
    options: [{ value: "design", label: "Design", count: 12 }, { value: "plans", label: "Plans", count: 5 }],
    value: f.tags.value === "" ? [] : f.tags.value.split(","),
    onChange: (next) => f.tags.value = next.join(","),
  }]}
  toggles={[{
    id: "mine",
    label: "Created by me",
    pressed: f.mine.value === "1",
    onChange: (on) => f.mine.value = on ? "1" : "",
  }]}
  sort={{
    options: [{ value: "updated", label: "Last updated" }, { value: "title", label: "Title (A–Z)" }],
    value: f.sort.value,
    onChange: (sort) => f.sort.value = sort,
  }}
  count={\`\${shown.length} notes\`}
/>`,
    render: () => <FilterBarDemo />,
  },
} satisfies DemoFragment
