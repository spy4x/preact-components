/**
 * The page-level frame of `ui/`: the header a page starts with and the rows a settings page is made
 * of. Spread into the Display section, right after `PageTitle`.
 *
 * What only a browser shows — the title truncating on one line with the actions beside it at
 * 375 px, the 44 px touch targets, the accessible name of every icon button — is driven by
 * `pages/checks/ui.ts`.
 */

import {
  Button,
  DropdownItem,
  InlineEdit,
  MoreMenu,
  PageAction,
  PageHeader,
  SettingGroup,
  SettingList,
  SettingRow,
  Stack,
  TOUCH_TARGET,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { IconDownload, IconPlus } from "@spy4x/preact-icons"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** The long title the 375 px check truncates: longer than any phone is wide. */
export const LONG_PAGE_TITLE = "Groceries for the long weekend at the lake house with everyone"

function PageHeaderDemo() {
  const last = useSignal("nothing yet")
  const name = useSignal("Packing list")
  return (
    <Stack>
      <PageHeader
        title={LONG_PAGE_TITLE}
        subtitle="Personal"
        back={{ href: "#lists", label: "Back to lists" }}
        navigate={() => last.value = "Back to lists"}
        action={
          <PageAction
            label="New task"
            Icon={IconPlus}
            onClick={() => last.value = "New task"}
          />
        }
        menu={
          <>
            <DropdownItem onClick={() => last.value = "Share"}>Share</DropdownItem>
            <DropdownItem onClick={() => last.value = "Delete list"} danger>
              Delete list
            </DropdownItem>
          </>
        }
        titleDataE2E="page-header-long-title"
      />
      <PageHeader
        title={name.value}
        heading={
          <InlineEdit
            class="[&>button]:text-xl [&>button]:font-semibold sm:[&>button]:text-2xl"
            value={name.value}
            onSave={(next) => {
              name.value = next
            }}
            inputLabel="List name"
          />
        }
        menuLabel="List actions"
        menu={<DropdownItem onClick={() => last.value = "Archive"}>Archive</DropdownItem>}
      />
      <DemoNote e2e="page-header-last">Last pressed: {last.value}.</DemoNote>
    </Stack>
  )
}

function PageActionDemo() {
  const presses = useSignal(0)
  return (
    <Stack>
      <div class="flex items-center gap-2">
        <PageAction
          label="New task"
          Icon={IconPlus}
          onClick={() => presses.value++}
          hotkey="p"
          dataE2E="page-action-hotkey"
        />
        <PageAction
          label="Export"
          Icon={IconDownload}
          href="#export"
          navigate={() => presses.value++}
          variant="secondary"
        />
      </div>
      <DemoNote e2e="page-action-presses">
        Pressed {presses.value} times; P presses New task. On a phone each shows its icon alone.
      </DemoNote>
    </Stack>
  )
}

function MoreMenuDemo() {
  const last = useSignal("nothing yet")
  return (
    <Stack>
      <div class="flex items-center justify-between gap-3">
        <span class="truncate text-sm">Ada Lovelace</span>
        <MoreMenu label="Actions for Ada Lovelace">
          <DropdownItem onClick={() => last.value = "Make owner"}>Make owner</DropdownItem>
          <DropdownItem onClick={() => last.value = "Remove"} danger>Remove</DropdownItem>
        </MoreMenu>
      </div>
      <DemoNote>Last chosen: {last.value}.</DemoNote>
    </Stack>
  )
}

/** A row's Edit button: visible "Edit", named after its setting for a screen reader. */
function EditButton({ setting }: { setting: string }) {
  return (
    <Button variant="ghost" size="sm" class={TOUCH_TARGET}>
      Edit<span class="sr-only">{` ${setting}`}</span>
    </Button>
  )
}

export const pageHeaderDemos = {
  PageHeader: {
    summary:
      "The header a page starts with: a back arrow, a one-line title, one primary action and a More actions menu.",
    wide: true,
    props: [
      {
        name: "title",
        type: "string",
        description: "The `h1`; it stays on one line and truncates, with its full text as tooltip.",
      },
      {
        name: "heading",
        type: "ComponentChildren",
        description: "Drawn inside the `h1` in place of `title`, such as a field that renames.",
      },
      { name: "subtitle", type: "ComponentChildren", description: "One quiet line under it." },
      {
        name: "back",
        type: "{ href: string; label: string }",
        description: "An arrow link to the parent page, named by `label`.",
      },
      {
        name: "navigate",
        type: "(href: string) => void",
        description: "Follows `back` without a page load.",
      },
      {
        name: "action",
        type: "ComponentChildren",
        description: "The one primary action, usually a `PageAction`.",
      },
      {
        name: "menu",
        type: "ComponentChildren",
        description: "`DropdownItem`s behind one three-dots button.",
      },
      {
        name: "menuLabel",
        type: "string",
        default: `"More actions"`,
        description: "The three-dots button's accessible name.",
      },
    ],
    snippet: `<PageHeader
  title="Groceries for the long weekend"
  subtitle="Personal"
  back={{ href: "/lists", label: "Back to lists" }}
  navigate={navigate}
  action={<PageAction label="New task" Icon={IconPlus} onClick={addTask} />}
  menu={<DropdownItem onClick={share}>Share</DropdownItem>}
/>
<PageHeader
  title={name}
  heading={
    <InlineEdit
      class="[&>button]:text-xl [&>button]:font-semibold sm:[&>button]:text-2xl"
      value={name}
      onSave={rename}
      inputLabel="List name"
    />
  }
/>`,
    render: () => <PageHeaderDemo />,
  },
  PageAction: {
    summary:
      "A page header's primary action: icon and label from `sm` up, the icon alone on a phone, named at every width.",
    wide: false,
    props: [
      { name: "label", type: "string", description: "Visible from `sm` up; always its name." },
      { name: "Icon", type: "ComponentType<IconProps>", description: "Shown at every width." },
      { name: "href", type: "string", description: "Makes it a link; otherwise a button." },
      { name: "onClick", type: "() => void", description: "Runs on a press of the button form." },
      {
        name: "variant",
        type: "ButtonVariant",
        default: `"primary"`,
        description: "The button's look.",
      },
      {
        name: "hotkey",
        type: "string",
        description: "A key that presses the action, shown in a hint, as `Button`'s does.",
      },
    ],
    snippet: `<PageAction label="New task" Icon={IconPlus} onClick={addTask} hotkey="p" />
<PageAction label="Export" Icon={IconDownload} href="/export" variant="secondary" />`,
    render: () => <PageActionDemo />,
  },
  MoreMenu: {
    summary:
      "A three-dots button that opens a menu of `DropdownItem`s, for a page or for one row of a list.",
    wide: false,
    props: [
      {
        name: "label",
        type: "string",
        description: "The button's and the menu's accessible name; required.",
      },
      { name: "children", type: "ComponentChildren", description: "The `DropdownItem`s." },
    ],
    snippet: `<MoreMenu label="Actions for Ada Lovelace">
  <DropdownItem onClick={promote}>Make owner</DropdownItem>
  <DropdownItem onClick={remove} danger>Remove</DropdownItem>
</MoreMenu>`,
    render: () => <MoreMenuDemo />,
  },
  SettingList: {
    summary: "A card of setting rows, one per line and divided by a rule.",
    wide: false,
    snippet: `<SettingList>
  <SettingRow
    label="Name"
    value="Ada Lovelace"
    action={
      <Button variant="ghost" size="sm" class={TOUCH_TARGET} onClick={editName}>
        Edit<span class="sr-only"> name</span>
      </Button>
    }
  />
  <SettingRow label="E-mail" value="ada@example.com" />
</SettingList>`,
    render: () => (
      <SettingList>
        <SettingRow label="Name" value="Ada Lovelace" action={<EditButton setting="name" />} />
        <SettingRow label="E-mail" value="ada@example.com" />
      </SettingList>
    ),
  },
  SettingRow: {
    summary:
      "One setting: its name, its value under it, and one action that stays beside them on a phone.",
    wide: false,
    props: [
      { name: "label", type: "string", description: "The setting's name." },
      { name: "value", type: "ComponentChildren", description: "Its current value." },
      {
        name: "action",
        type: "ComponentChildren",
        description: "One control on the right; name it after the setting.",
      },
    ],
    snippet: `<SettingRow
  label="Time zone"
  value="Europe/Lisbon, which is where the calendar shows every event"
  action={
    <Button variant="ghost" size="sm" class={TOUCH_TARGET} onClick={editTimeZone}>
      Edit<span class="sr-only"> time zone</span>
    </Button>
  }
/>`,
    render: () => (
      <SettingList>
        <SettingRow
          label="Time zone"
          value="Europe/Lisbon, which is where the calendar shows every event"
          action={<EditButton setting="time zone" />}
        />
      </SettingList>
    ),
  },
  SettingGroup: {
    summary:
      "A named group of settings: a small `h2` over its rows, so the page title stays the one large heading.",
    wide: false,
    props: [
      { name: "title", type: "string", description: "The group's `h2`, which names it." },
      { name: "description", type: "ComponentChildren", description: "One line under it." },
    ],
    snippet: `<SettingGroup title="Security" description="How you sign in.">
  <SettingList>
    <SettingRow
      label="Password"
      value="Changed 3 months ago"
      action={
        <Button variant="ghost" size="sm" class={TOUCH_TARGET} onClick={changePassword}>
          Edit<span class="sr-only"> password</span>
        </Button>
      }
    />
  </SettingList>
</SettingGroup>`,
    render: () => (
      <SettingGroup title="Security" description="How you sign in.">
        <SettingList>
          <SettingRow
            label="Password"
            value="Changed 3 months ago"
            action={<EditButton setting="password" />}
          />
          <SettingRow label="Two-factor" value="On" />
        </SettingList>
      </SettingGroup>
    ),
  },
} satisfies DemoFragment
