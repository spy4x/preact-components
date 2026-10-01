/**
 * The look of a small hint bubble: `Tooltip`'s bubble and `ThemeToggle`'s "Auto mode" hint.
 *
 * One string in a module of its own, not exported from the package: two components draw the same
 * bubble, and a module with no imports lets `ThemeToggle` share it without loading `Tooltip`, whose
 * `cn` brings `tailwind-merge` into a bundle.
 */
export const hintBubbleClasses =
  "block rounded-md bg-foreground px-2 py-1 text-xs text-canvas shadow-raised dark:bg-hover dark:text-foreground"
