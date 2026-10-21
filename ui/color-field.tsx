import { join } from "@spy4x/preact-cn/join"
import { IconCheck } from "@spy4x/preact-icons"
import { isHexColor, readableTextColor } from "@spy4x/platform/universal/color"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import { Field } from "./field.tsx"
import { Input } from "./input.tsx"

/** One swatch of a {@link ColorField}: a `#rrggbb` colour and its name. */
export interface ColorPreset {
  /** The colour, `#rrggbb` in lower case. */
  value: string
  /** The swatch's accessible name and tooltip, such as "Red". */
  label: string
}

/**
 * The 16 swatches {@link ColorField} offers by default: a neutral gray and 15 hues, dark enough to
 * take white text except Yellow, which takes black. Text in `readableTextColor` reaches at least
 * 4.58:1 on any `#rrggbb` (the worst case, a background of relative luminance 0.18, gives √21), so
 * a name drawn on a preset or on a custom colour always passes WCAG AA.
 */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { value: "#4b5563", label: "Gray" },
  { value: "#b91c1c", label: "Red" },
  { value: "#c2410c", label: "Orange" },
  { value: "#b45309", label: "Amber" },
  { value: "#facc15", label: "Yellow" },
  { value: "#4d7c0f", label: "Lime" },
  { value: "#15803d", label: "Green" },
  { value: "#047857", label: "Emerald" },
  { value: "#0f766e", label: "Teal" },
  { value: "#0e7490", label: "Cyan" },
  { value: "#0369a1", label: "Sky" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#4338ca", label: "Indigo" },
  { value: "#6d28d9", label: "Violet" },
  { value: "#7e22ce", label: "Purple" },
  { value: "#be185d", label: "Pink" },
]

/** The words of a {@link ColorField}, each with an English default. */
export interface ColorFieldLabels {
  /** Accessible name of the last swatch, `"Pick a custom colour"`. */
  custom?: string
  /** Accessible name of the native colour input, `"Colour picker"`. */
  picker?: string
  /** Label of the hex text field, `"Hex code"`. */
  hexCode?: string
  /** Placeholder of the hex text field, `"#59168b"`. */
  hexPlaceholder?: string
  /** Shown under the hex text field when it holds no `#rrggbb` value. */
  hexError?: string
}

/** Props of {@link ColorField}. */
export interface ColorFieldProps {
  /** The chosen colour, `#rrggbb`, or `null` for none. Anything else counts as none. */
  value: string | null
  /** Called with a preset's value, a custom `#rrggbb` in lower case, or `null` for "None". */
  onChange: (value: string | null) => void
  /** The swatches before "Custom". Defaults to {@link COLOR_PRESETS}. */
  presets?: readonly ColorPreset[]
  /** Adds a first swatch that clears the colour. */
  allowNone?: boolean
  /** Accessible name of the "None" swatch, `"No colour"`. */
  noneLabel?: string
  /** The group's name, rendered as the `<legend>`, `"Colour"` by default. */
  legend?: ComponentChildren
  /** Helper text under the swatches, tied to the group with `aria-describedby`. */
  hint?: ComponentChildren
  /** A message from the caller (a server refusal, say), under the swatches and tied to the group. */
  error?: string | null
  /**
   * A live sample drawn under the swatches while a colour is chosen, given the colour and the text
   * colour that reads on it: a tag chip, a group mark.
   */
  preview?: (color: string, textColor: "#000000" | "#ffffff") => ComponentChildren
  /** Shared `name` of the swatch radios; generated when left out. */
  name?: string
  labels?: ColorFieldLabels
  /** Utilities on the `<fieldset>`. */
  class?: string
}

/** The radio value of the "None" swatch; never a hex, so it cannot meet a preset. */
const NONE = "none"
/** The radio value of the "Custom" swatch. */
const CUSTOM = "custom"

/** The "Custom" swatch before a custom colour is chosen: the colour wheel people know it by. */
const WHEEL = "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)"

/** The 44 px touch area around each swatch. */
const touch = "relative inline-flex size-11 items-center justify-center cursor-pointer"

/**
 * The 32 px swatch. Checked, it takes a ring in its text colour (the foreground on a filled swatch);
 * with the keyboard on it, the focus ring replaces that colour, so the two states never look alike.
 */
const swatch = join(
  "inline-flex size-8 items-center justify-center rounded-full border border-subtle transition-shadow",
  "peer-checked:ring-2 peer-checked:ring-current peer-checked:ring-offset-2 peer-checked:ring-offset-surface",
  "peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-focus",
)

/**
 * A colour picker: preset swatches, an optional "None", and a "Custom" swatch that opens a native
 * colour input and a hex text field.
 *
 * Built like `RadioChips`: a `<fieldset>` named by its `<legend>`, with a visually hidden native
 * radio per swatch, so the group is one tab stop, the arrow keys move the choice and Space checks
 * it, with no key handler of its own. A checked swatch shows a check in the text colour that reads
 * on it, so the choice does not rest on colour alone.
 *
 * Choosing "Custom" shows the colour input and the "Hex code" field, which Tab reaches after the
 * group. It does not open the system picker by itself, because the arrow keys pass through "Custom"
 * on their way round. A picked colour reaches `onChange` at once; a typed one when it is a full
 * `#rrggbb`. A typed value that is not shows `labels.hexError` once the field loses focus, and
 * `onChange` is not called. A value that is no preset opens on "Custom", with the swatch filled.
 */
export function ColorField(
  {
    value,
    onChange,
    presets = COLOR_PRESETS,
    allowNone = false,
    noneLabel = "No colour",
    legend = "Colour",
    hint,
    error,
    preview,
    name,
    labels = {},
    class: className,
  }: ColorFieldProps,
): JSX.Element {
  const id = useId()
  /** "Custom" was chosen, so it stays checked even on a colour a preset has. */
  const customChosen = useSignal(false)
  /** The hex field's text while it is not a valid colour; `null` shows `value`. */
  const draft = useSignal<string | null>(null)
  const showHexError = useSignal(false)

  const color = isHexColor(value) ? value.toLowerCase() : null
  const preset = color === null
    ? undefined
    : presets.find((option) => option.value.toLowerCase() === color)
  const selected = customChosen.value
    ? CUSTOM
    : color === null
    ? (allowNone ? NONE : null)
    : preset === undefined
    ? CUSTOM
    : preset.value
  const customColor = selected === CUSTOM ? color : null

  const groupName = name ?? `${id}-swatch`
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint !== undefined && hint !== null && hint !== false && hint !== ""
    ? `${id}-hint`
    : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined

  const choose = (next: string) => {
    if (next === CUSTOM) {
      customChosen.value = true
      return
    }
    customChosen.value = false
    draft.value = null
    showHexError.value = false
    onChange(next === NONE ? null : next)
  }

  const typeHex = (text: string) => {
    if (isHexColor(text)) {
      draft.value = null
      showHexError.value = false
      onChange(text.toLowerCase())
    } else {
      draft.value = text
    }
  }

  /**
   * One swatch: a hidden radio, the round fill (a CSS `background`, or the surface when left out)
   * and the name for a screen reader.
   */
  const option = (
    optionValue: string,
    label: string,
    fill: JSX.Element | null,
    background?: string,
  ) => (
    <label key={optionValue} class={touch} title={label}>
      <input
        type="radio"
        class="peer sr-only"
        name={groupName}
        value={optionValue}
        checked={selected === optionValue}
        onChange={() => choose(optionValue)}
      />
      <span
        class={join(swatch, background === undefined ? "bg-surface text-muted" : "text-foreground")}
        style={background === undefined ? undefined : { background }}
        aria-hidden="true"
      >
        {fill}
      </span>
      <span class="sr-only">{label}</span>
    </label>
  )

  /** The check on a checked swatch, in the text colour that reads on `background`. */
  const check = (background: string, checked: boolean) =>
    checked
      ? (
        <span class="inline-flex" style={{ color: readableTextColor(background) }}>
          <IconCheck class="size-4" />
        </span>
      )
      : null

  return (
    <fieldset class={className} aria-describedby={describedBy} data-e2e="color-field">
      <legend class="pc-label mb-2">{legend}</legend>
      <div class="flex flex-wrap gap-1">
        {allowNone && option(
          NONE,
          noneLabel,
          <span class="block h-0.5 w-6 -rotate-45 rounded-full bg-current" />,
        )}
        {presets.map((swatchOption) =>
          option(
            swatchOption.value,
            swatchOption.label,
            check(swatchOption.value, selected === swatchOption.value),
            swatchOption.value,
          )
        )}
        {option(
          CUSTOM,
          labels.custom ?? "Pick a custom colour",
          customColor === null ? null : check(customColor, true),
          customColor ?? WHEEL,
        )}
      </div>
      {selected === CUSTOM && (
        <Field
          id={`${id}-hex`}
          label={labels.hexCode ?? "Hex code"}
          class="mt-3"
          error={showHexError.value
            ? labels.hexError ?? "Enter # and 6 characters, such as #59168b."
            : null}
        >
          {(wiring) => (
            <div class="flex gap-3">
              <input
                type="color"
                class="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-subtle bg-surface p-1"
                aria-label={labels.picker ?? "Colour picker"}
                value={color ?? labels.hexPlaceholder ?? "#59168b"}
                onInput={(event) => typeHex(event.currentTarget.value)}
              />
              <Input
                id={wiring.id}
                aria-describedby={wiring["aria-describedby"]}
                aria-invalid={showHexError.value || undefined}
                value={draft.value ?? color ?? ""}
                placeholder={labels.hexPlaceholder ?? "#59168b"}
                maxLength={7}
                autocomplete="off"
                spellcheck={false}
                class="w-32 font-mono"
                onInput={(event) => typeHex(event.currentTarget.value)}
                onBlur={() => showHexError.value = draft.value !== null}
              />
            </div>
          )}
        </Field>
      )}
      {preview !== undefined && color !== null && (
        <div class="mt-3" data-e2e="color-field-preview">
          {preview(color, readableTextColor(color))}
        </div>
      )}
      {errorId !== undefined && (
        <p id={errorId} class="mt-2 text-sm text-danger" aria-live="polite">{error}</p>
      )}
      {hintId !== undefined && <p id={hintId} class="mt-2 text-sm text-muted">{hint}</p>}
    </fieldset>
  )
}
