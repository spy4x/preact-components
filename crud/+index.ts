/**
 * `@spy4x/preact-crud` — the list and editor scaffolding every resource page was rebuilt from.
 *
 * A package receives the store it reads through props and supplies the table cells and the form
 * fields as slots; nothing here imports an application's state singleton, and nothing here assumes
 * an entity. Import a single module from its own subpath
 * (`@spy4x/preact-crud/crud-list`) when the barrel would pull in more than you need.
 */

export {
  CrudList,
  type CrudListBaseProps,
  type CrudListProps,
  type CrudListSource,
  listRows,
  RowAction,
  type RowActionProps,
  RowActions,
  rowsForStatus,
  type StatusFilterLabels,
} from "./crud-list.tsx"
export {
  type ArchiveConfig,
  type ArchiveToggleState,
  CrudEditor,
  type CrudEditorBaseProps,
  type CrudEditorMode,
  type CrudEditorProps,
  type CrudEditorSlot,
  type CrudSubmitInput,
  type CrudSubmitOutcome,
  type CrudSubmitStore,
  type EditorState,
  editorState,
  type EditorStateInput,
  submitEditor,
  toggleArchiveState,
} from "./crud-editor.tsx"
export { DeletionValidation, type DeletionValidationProps } from "./deletion-validation.tsx"
export {
  CheckboxField,
  commitNumber,
  FieldIssues,
  type FieldProps,
  fieldText,
  NumberField,
  SelectField,
  type SelectFieldProps,
  type SelectOption,
  setField,
  TextareaField,
  TextField,
} from "./field.tsx"
export {
  type AssociationActions,
  associationActions,
  AssociationEditor,
  type AssociationEditorBaseProps,
  type AssociationEditorProps,
  CONFLICT,
  type ConflictInput,
  conflictIssue,
  type CrudAssociationStore,
  isRestorable,
} from "./association-editor.tsx"
export type { CrudEditorStore, CrudListStore } from "./store.ts"
export { formatTimestamp, type FormatTimestampOptions, timeAgo, type TimeLike } from "./time-ago.ts"
export type {
  CrudModel,
  CrudRow,
  CrudStatus,
  DeletionDependency,
  DeletionDependencyItem,
  OperationResult,
  OperationState,
  SoftDeletable,
  StoreErrorLike,
} from "./types.ts"
