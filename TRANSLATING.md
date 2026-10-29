# Translating

The words the components show live in one catalog per language: `ui/i18n/<language>.ts`, with
`ui/i18n/en.ts` as the source. Each file exports its catalog as `export default { … }`. Each key
is `<Component>.<field>`, such as `Pagination.nextLabel`. A `{name}` in a message is a value the
component fills in. Keep every one, spelled the same. A message that is an object (`{ "one": …, "other": … }`) is a plural, with one
form per plural category of the language.

## The loop

1. Change the English in `en.ts`, and the same English in the component's code: a component
   without a provider shows the English written in its own code, and the guide's test holds the
   two equal.
2. Run `deno task test`. The catalog test (`ui/i18n/catalogs.test.ts`) lists every message that
   is missing, extra, empty, or out of date because its English changed, and every one whose
   placeholders, tags or plural forms differ from the English.
3. Translate what it lists, in every language.
4. Run `deno task i18n:stamp`. It records, in `ui/i18n/<language>.lock`, which English each
   translation was made from.
5. Run `deno task test` again. It passes once every language matches the English.

Stamp only after the translation is done: a stamp tells the test that the translation is up to
date.

## Voice

Short, plain and friendly, as a person would say it. The same voice in every language:

| Language             | File       | Voice                                                         |
| -------------------- | ---------- | ------------------------------------------------------------- |
| German               | `de.ts`    | `du`, lower-case. "Versuche es noch einmal."                  |
| Spanish              | `es.ts`    | `tú`, neutral Spanish, gender-neutral where it costs nothing. |
| Brazilian Portuguese | `pt-BR.ts` | `você`. "Tente de novo."                                      |
| Russian              | `ru.ts`    | `вы`, lower-case. "Попробуйте ещё раз."                       |
| Arabic               | `ar.ts`    | Modern Standard Arabic, addressing the reader directly.       |

A button says what it does, as a verb: "Speichern", not "Speicherung". An error says what happened
and what to do next. Use the typographic quotes of the language: „…“ in German, «…» in Spanish,
Russian and Arabic, “…” in Brazilian Portuguese.

## Terms kept in English

- Key names on the keyboard: Enter, Tab, Esc, Shift, Ctrl, Control, Alt, Option, Command, Meta,
  Backspace, Delete. Translate Space and the arrows (`Kbd.space`, `Kbd.up`): those are words a
  person reads, not the label printed on the key.
- `HEX` in `ColorField.hexCode`, and colour codes such as `#59168b`.
- Product, brand and file-format names.

## Length

The English length is the budget. A longer translation must still fit:

| Keys                                                                      | Limit                           |
| ------------------------------------------------------------------------- | ------------------------------- |
| Chips and marks: `StatusMark.*`, `OnOffButtons.*`, `PlanCard.status.*`    | one or two words, 16 characters |
| Buttons and links: `*.closeLabel`, `*.nextLabel`, `*.doneLabel`, `Tour.*` | about 1.5 times the English     |
| Keys: `Kbd.*`                                                             | one or two words                |
| Placeholders and hints: `*.placeholder`, `FileInput.dropHint`             | one short line                  |
| Hidden labels, announcements and errors                                   | no limit; say it fully          |

## Messages that need care

- `ResendButton.readyText` ends where the button starts: "Not there? Check your spam folder, or
  [Send it again]". Write it so that it runs into `ResendButton.label`, and start that label in lower case where the language does so mid-sentence ("oder erneut senden").
- `PageHero.by` comes before the author's name, and `PageHero.updated` before a date.
- `KanbanBoard.*` and `SortableList.*` are read aloud to a person moving a card with the keyboard:
  keep each one a full sentence.
- An Arabic plural has six forms (`zero`, `one`, `two`, `few`, `many`, `other`); `one` and `two`
  usually need no number.
