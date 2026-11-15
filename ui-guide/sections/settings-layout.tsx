/**
 * The `SettingsLayout` card of the guide's System page: a profile split into sections, routed by the
 * demo's own `navigate`, so the nav, the phone's list-then-page and the focus moves can be tried
 * here and are what `pages/e2e/system-settings.spec.ts` drives.
 */

import { SettingsLayout, type SettingsSection } from "@spy4x/preact-system/settings-layout"
import { Avatar, Button, SettingList, SettingRow, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import type { DemoFragment } from "../registry.ts"
import { ArabicSwitch } from "./arabic-demo.tsx"

/** The demo's sub-pages. Their addresses are fragments, so a new tab opens this guide. */
const SECTIONS: readonly SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    href: "#settings-account",
    description: "Your name and e-mail.",
  },
  {
    id: "security",
    label: "Sign-in and security",
    href: "#settings-security",
    description: "How you sign in, and where you are signed in.",
    value: "Two-factor off",
  },
  { id: "region", label: "Language and region", href: "#settings-region", value: "English (UK)" },
  { id: "appearance", label: "Appearance", href: "#settings-appearance", value: "System" },
  { id: "danger", label: "Delete account", href: "#settings-danger", tone: "danger" },
]

/** Each section's content: a few settings rows, as an app would draw them. */
const CONTENT: Record<string, () => ComponentChildren> = {
  account: () => (
    <SettingList>
      <SettingRow label="Name" value="Ada Lovelace" action={<Edit name="name" />} />
      <SettingRow label="E-mail" value="ada@example.com" action={<Edit name="e-mail" />} />
    </SettingList>
  ),
  security: () => (
    <SettingList>
      <SettingRow label="Password" value="Changed 3 months ago" action={<Edit name="password" />} />
      <SettingRow
        label="Two-factor sign-in"
        value="Off"
        action={<Button variant="outline" size="sm">Turn on</Button>}
      />
    </SettingList>
  ),
  region: () => (
    <SettingList>
      <SettingRow label="Formats" value="English (UK)" action={<Edit name="formats" />} />
      <SettingRow label="Time zone" value="Europe/London" action={<Edit name="time zone" />} />
    </SettingList>
  ),
  appearance: () => (
    <SettingList>
      <SettingRow label="Theme" value="Follows the system" action={<Edit name="theme" />} />
    </SettingList>
  ),
  danger: () => (
    <Stack gap="md">
      <p class="text-sm text-muted">
        Deleting your account removes your notes and groups. It cannot be undone.
      </p>
      <div>
        <Button variant="danger" size="sm">Delete account</Button>
      </div>
    </Stack>
  ),
}

/** An Edit button named after its setting. */
function Edit({ name }: { name: string }) {
  return <Button variant="outline" size="sm" aria-label={`Edit ${name}`}>Edit</Button>
}

/**
 * A profile with its own router: `navigate` maps a section's address to its id, and the list's
 * address to `null`, so on a phone the list is the page until a section is chosen. It opens on
 * Account; back on the list's address, `defaultSection` keeps Account showing from `md` up.
 */
function SettingsLayoutDemo() {
  const current = useSignal<string | null>("account")
  const route = useSignal("none")
  const navigate = (href: string) => {
    route.value = href
    current.value = SECTIONS.find((section) => section.href === href)?.id ?? null
  }
  const open = current.value
  return (
    <Stack gap="md">
      <div data-e2e="settings-layout-demo">
        <SettingsLayout
          title="Profile"
          headingLevel={4}
          href="#settings"
          sections={SECTIONS}
          current={open}
          defaultSection="account"
          navigate={navigate}
          intro={
            <div class="flex items-center gap-3">
              <Avatar name="Ada Lovelace" size="md" alt="" />
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-medium text-foreground">Ada Lovelace</span>
                <span class="truncate text-sm text-muted">ada@example.com</span>
              </div>
            </div>
          }
        >
          {CONTENT[open ?? "account"]()}
        </SettingsLayout>
      </div>
      <p class="text-sm text-muted">
        Routed to: <strong data-e2e="settings-layout-demo-route">{route.value}</strong>
      </p>
    </Stack>
  )
}

export const settingsLayoutDemos = {
  SettingsLayout: {
    summary:
      "A settings page with sub-pages: a sticky nav beside the open section from `md` up, and on a phone the list first, then one section with a link back.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "The page title, drawn by `PageHeader`." },
      { name: "href", type: "string", description: "The list's own address: the back link's." },
      {
        name: "sections",
        type: "readonly SettingsSection[]",
        description:
          '`id`, `label`, `href`, and optional `description`, `value` (the phone list\'s muted state) and `tone: "danger"` (last, after a divider).',
      },
      {
        name: "current",
        type: "string | null",
        description: "The open section's id; `null` makes the list the page on a phone.",
      },
      {
        name: "defaultSection",
        type: "string",
        description:
          "The section shown from `md` up while `current` is `null`: its heading and a current-looking item, by CSS only.",
      },
      {
        name: "navigate",
        type: "(href: string) => void",
        description: "The app's router; a plain click on a nav item or the back link calls it.",
      },
      {
        name: "intro",
        type: "ComponentChildren",
        description: "Drawn under the title, such as who is signed in.",
      },
    ],
    snippet: `<SettingsLayout
  title="Profile"
  href="/profile"
  sections={[
    { id: "account", label: "Account", href: "/profile/account" },
    { id: "security", label: "Sign-in and security", href: "/profile/security", value: "Two-factor off" },
    { id: "danger", label: "Delete account", href: "/profile/danger", tone: "danger" },
  ]}
  current={sectionId ?? null}
  defaultSection="account"
  navigate={(href) => router.navigate(href)}
>
  {sectionId === "security" ? <SecuritySettings /> : <AccountSettings />}
</SettingsLayout>`,
    render: () => (
      <ArabicSwitch name="settings-layout">
        <SettingsLayoutDemo />
      </ArabicSwitch>
    ),
  },
} satisfies DemoFragment
