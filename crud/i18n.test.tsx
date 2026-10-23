import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import type { ComponentChildren } from "preact"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { I18nContext } from "@spy4x/preact-ui/i18n"
import uiDe from "@spy4x/preact-ui/i18n/de"
import uiEn from "@spy4x/preact-ui/i18n/en"
import { agoIn } from "./ago.ts"
import { AssociationEditor, type CrudAssociationStore } from "./association-editor.tsx"
import { CrudList } from "./crud-list.tsx"
import { DeletionValidation } from "./deletion-validation.tsx"
import { TextField } from "./field.tsx"
import crudDe from "./i18n/de.ts"
import crudEn from "./i18n/en.ts"
import type { CrudRow, OperationState } from "./types.ts"

const GERMAN = createTranslator({
  language: "de",
  catalogs: [{ source: uiEn, translation: uiDe }, { source: crudEn, translation: crudDe }],
})

function inGerman(children: ComponentChildren): string {
  return render(<I18nContext.Provider value={GERMAN}>{children}</I18nContext.Provider>)
}

interface Link extends CrudRow {
  zoneId: number
}

const idle: OperationState = { inProgress: false, result: null, error: null }

/** A junction store that holds `rows` and never writes. */
function linkStore(rows: Link[]): CrudAssociationStore<Link> {
  const done = (id: number) =>
    Promise.resolve({ error: null, result: { id, zoneId: 0, deletedAt: null } as Link } as const)
  return {
    list: { all: signal(rows) },
    one: { byId: (id) => computed(() => rows.find((row) => row.id === id)) },
    op: {
      create: signal(idle),
      update: () => signal(undefined),
      delete: () => signal(undefined),
      undelete: () => signal(undefined),
    },
    create: (data) => Promise.resolve({ error: null, result: { ...data, id: 9 } } as const),
    update: (_id, data) => Promise.resolve({ error: null, result: data } as const),
    delete: done,
    undelete: done,
  }
}

const emptyList = () => (
  <CrudList
    title="Gebiete"
    match={() => true}
    header={<th>Name</th>}
    row={() => <td />}
    rows={signal([])}
    addHref="/new"
  />
)

/** Five days ago, fixed once so that two renders of the same fixture match. */
const FIVE_DAYS_AGO = new Date(Date.now() - 5 * 86_400_000)

const removedLink = () => (
  <AssociationEditor
    mode="edit"
    editId={1}
    store={linkStore([])}
    blank={{ id: 1, zoneId: 0, deletedAt: FIVE_DAYS_AGO } as Link}
    entity="Zuordnung"
    cancelHref="/back"
    conflictField="zoneId"
    conflict={() => undefined}
  >
    {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
  </AssociationEditor>
)

const blocked = () => (
  <DeletionValidation model="Gebiet" dependencies={[{ kind: "Orte", values: [] }]} />
)

describe("the crud components under a translator", () => {
  it("render the same English with the English catalog as without a provider", () => {
    const english = createTranslator({
      language: "en",
      catalogs: [{ source: uiEn }, { source: crudEn }],
    })
    for (const fixture of [emptyList, removedLink, blocked]) {
      expect(render(<I18nContext.Provider value={english}>{fixture()}</I18nContext.Provider>))
        .toBe(render(fixture()))
    }
  })

  it("word an empty list and its search in the translator's language", () => {
    const html = inGerman(emptyList())
    expect(html).toContain(crudDe["CrudList.emptyTitle"])
    expect(html).toContain(`placeholder="${crudDe["CrudList.searchPlaceholder"]}"`)
    expect(html).toContain(crudDe["CrudList.addLabel"])
  })

  it("put the entity into the translated title, removed line and archive heading", () => {
    const html = inGerman(removedLink())
    expect(html).toContain("Zuordnung bearbeiten")
    expect(html).toContain(">Wiederherstellen</button>")
    expect(html).toContain("Entfernt vor 5 Tagen")
    expect(inGerman(blocked())).toContain("Um „Gebiet“ zu archivieren, archiviere zuerst:")
  })

  it("say how long ago in Intl's words only under a language other than English", () => {
    const at = FIVE_DAYS_AGO
    const english = createTranslator({ language: "en-GB", catalogs: [{ source: crudEn }] })
    expect(agoIn(GERMAN, at)).toBe("vor 5 Tagen")
    expect(agoIn(english, at)).toBe("5 days ago")
    expect(agoIn(GERMAN, null)).toBe(agoIn(english, null))
  })
})
