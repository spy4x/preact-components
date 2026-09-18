import { Dropdown, OnOffButtons, ToggleSwitch } from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import {
  IconChevronDown,
  IconCog6Tooth,
  IconEllipsisVertical,
  IconTrashBin,
  IconUser,
} from "@preact-components/icons"
import type { DemoFragment } from "../registry.ts"

const menuItem =
  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"

/** Controlled: the switch renders `value` and reports the intended value through `onToggle`. */
function ToggleSwitchDemo() {
  const archived = useSignal(false)
  const notifications = useSignal(true)
  return (
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <ToggleSwitch
          value={archived.value}
          onToggle={(next) => archived.value = next}
          label="Show archived"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          archived: {archived.value ? "on" : "off"}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch
          value={notifications.value}
          onToggle={(next) => notifications.value = next}
          label="Notifications"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          notifications: {notifications.value ? "on" : "off"}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch value={false} onToggle={() => {}} disabled label="Disabled" />
        <span class="text-sm text-gray-500 dark:text-gray-400">disabled</span>
      </div>
    </div>
  )
}

/** `value === undefined` leaves both halves unselected, which is how an unfiltered list starts. */
function OnOffButtonsDemo() {
  const value = useSignal<boolean | undefined>(undefined)
  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <OnOffButtons value={value.value} onSwitch={(on) => value.value = on} />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          value: {value.value === undefined ? "undefined" : String(value.value)}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <OnOffButtons
          value={value.value}
          onSwitch={(on) => value.value = on}
          amount={{ on: 128, off: 14 }}
          onLabel="Active"
          offLabel="Archived"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">with counts and custom labels</span>
      </div>
    </div>
  )
}

function DropdownDemo() {
  const selected = useSignal("Select action…")
  return (
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Default icon trigger</h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown trigger={<IconEllipsisVertical class="size-5" />} menuLabel="Row actions">
            <div class="py-1">
              <a href="javascript:;" class={menuItem}>
                <IconUser class="size-4" />
                View profile
              </a>
              <a href="javascript:;" class={menuItem}>
                <IconCog6Tooth class="size-4" />
                Settings
              </a>
              <button type="button" class={`${menuItem} text-red-600 dark:text-red-400`}>
                <IconTrashBin class="size-4" />
                Delete
              </button>
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Custom trigger</h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown
            trigger={
              <span class="flex items-center gap-2 px-3 py-2 text-sm">
                {selected.value}
                <IconChevronDown class="size-4" />
              </span>
            }
            triggerClasses="w-56 justify-between border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            panelClasses="min-w-[200px]"
            menuLabel="Bulk actions"
          >
            <div class="py-1">
              {["Create new item", "Import data", "Export data", "Archive items"].map((action) => (
                <button
                  key={action}
                  type="button"
                  class={menuItem}
                  onClick={() => selected.value = action}
                >
                  {action}
                </button>
              ))}
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
          `vertical="up"` — last table rows
        </h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown trigger={<IconEllipsisVertical class="size-5" />} vertical="up">
            <div class="py-1">
              <a href="javascript:;" class={menuItem}>Edit item</a>
              <a href="javascript:;" class={menuItem}>Duplicate</a>
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
          `horizontal="left"`
        </h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown trigger={<IconEllipsisVertical class="size-5" />} horizontal="left">
            <div class="py-1">
              <a href="javascript:;" class={menuItem}>Left action</a>
            </div>
          </Dropdown>
        </div>
      </div>
    </div>
  )
}

export const inputDemos = {
  ToggleSwitch: {
    summary:
      "Two-state switch, controlled. Renders `value`, reports the intended value through `onToggle`; persistence belongs to the caller.",
    snippet: `<ToggleSwitch
  value={archived.value}
  onToggle={(next) => archived.value = next}
  label="Show archived"
/>`,
    render: () => <ToggleSwitchDemo />,
  },
  OnOffButtons: {
    summary:
      "Segmented ON/OFF pair. `value` of `undefined` leaves both halves unselected; `amount` annotates them with counts.",
    snippet: `<OnOffButtons
  value={showActive.value}
  amount={{ on: 128, off: 14 }}
  onSwitch={(on) => showActive.value = on}
/>`,
    render: () => <OnOffButtonsDemo />,
  },
  Dropdown: {
    summary:
      "Trigger plus panel that closes on outside click. Open/closed is local state, so the panel is `hidden` in the server render.",
    snippet: `<Dropdown trigger={<IconEllipsisVertical />} vertical="up" menuLabel="Row actions">
  <a href={editHref} class="…">Edit</a>
</Dropdown>`,
    render: () => <DropdownDemo />,
  },
} satisfies DemoFragment<"Dropdown" | "OnOffButtons" | "ToggleSwitch">
