/**
 * The `PushSettings` card. Spread into the System section, after `InstallPrompt`.
 *
 * No real push service is involved: each case runs `usePushSubscription` from
 * `@spy4x/preact-signals` on a stand-in browser that answers the permission prompt the way the case
 * says, and a stand-in server that counts what it was asked to store. What only a browser shows —
 * no prompt before the press, focus staying on the button through the change, focus moving to the
 * explanation when the browser blocks, the announcements, a permission changed while the page was
 * hidden, a key that arrives after the first render, and the listener going when the block leaves
 * the page — is driven by `pages/e2e/system-push.spec.ts`.
 */

import { PushSettings } from "@spy4x/preact-system/push-settings"
import {
  type PushServiceWorker,
  type PushSubscriptionLike,
  type PushVisibility,
  usePushSubscription,
} from "@spy4x/preact-signals/push-subscription"
import { Button, Cluster, Grid, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useRef } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"

/** One captioned part of the card. */
function Part({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <Stack gap="sm">
      <h4 class="text-xs font-semibold text-muted">{title}</h4>
      {children}
    </Stack>
  )
}

/** Stands in for the server's public key: base64url of the text "demo-key", not a real key. */
const DEMO_PUBLIC_KEY = "ZGVtby1rZXk"

/**
 * A stand-in for the browser's side of push: the permission, its prompt and one subscription.
 *
 * @param answer What the permission prompt answers when the page asks.
 */
function fakeBrowser(answer: "granted" | "denied") {
  let permission = "default"
  let subscription: PushSubscriptionLike | null = null
  let prompts = 0
  const listeners = new Set<() => void>()
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(subscription),
      subscribe: () => {
        subscription = {
          endpoint: "https://push.example/device-1",
          toJSON: () => ({ endpoint: "https://push.example/device-1", keys: {} }),
          unsubscribe: () => {
            subscription = null
            return Promise.resolve(true)
          },
        }
        return Promise.resolve(subscription)
      },
    },
  }
  const serviceWorker: PushServiceWorker = {
    getRegistration: () => Promise.resolve(registration),
    ready: Promise.resolve(registration),
  }
  const visibility: PushVisibility = {
    visibilityState: "visible",
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  return {
    serviceWorker,
    visibility,
    notification: {
      get permission() {
        return permission
      },
      requestPermission: () => {
        prompts++
        permission = answer
        return Promise.resolve(permission)
      },
    },
    /** How many times the page opened the permission prompt. */
    prompts: () => prompts,
    subscribed: () => subscription !== null,
    /** How many `visibilitychange` listeners the page holds now. */
    listening: () => listeners.size,
    /** Block the site in the browser's settings, then come back to the page. */
    blockWhileAway: () => {
      permission = "denied"
      subscription = null
      listeners.forEach((listener) => listener())
    },
  }
}

/** One browser, one server, and the block they draw. The line under it says what each holds. */
function PushCase({ name, answer }: { name: string; answer: "granted" | "denied" }) {
  const browser = useRef(fakeBrowser(answer)).current
  const stored = useSignal(0)
  const failNext = useSignal(false)
  // Read by the state line; changed so the line is drawn again after the browser's side moved.
  const tick = useSignal(0)
  /** A server call that fails once after "Fail the next server call" was pressed. */
  const server = (work: () => void) => () => {
    if (failNext.value) {
      failNext.value = false
      return Promise.reject(new Error("The demo's server refused"))
    }
    work()
    return Promise.resolve()
  }
  const push = usePushSubscription({
    publicKey: DEMO_PUBLIC_KEY,
    // One device, so the server holds one subscription or none: `save` is an upsert.
    save: server(() => (stored.value = 1)),
    remove: server(() => (stored.value = 0)),
    sendTest: server(() => {}),
    onError: () => tick.value++,
    serviceWorker: browser.serviceWorker,
    notification: browser.notification,
    visibility: browser.visibility,
  })
  return (
    <Stack gap="sm" data-e2e={`push-${name}`}>
      <PushSettings {...push} class="pc-card p-4" />
      <p class="text-xs text-muted" data-e2e="push-state" data-tick={tick.value}>
        prompts shown: {browser.prompts()}, browser subscribed:{" "}
        {browser.subscribed() ? "yes" : "no"}, server has: {stored.value}
      </p>
      {answer === "granted"
        ? (
          <Cluster gap="sm">
            <Button
              variant="outline"
              size="sm"
              data-e2e="push-fail-next"
              aria-pressed={failNext.value}
              onClick={() => (failNext.value = !failNext.value)}
            >
              Fail the next server call
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-e2e="push-block-away"
              onClick={browser.blockWhileAway}
            >
              Block in browser settings, then return
            </Button>
          </Cluster>
        )
        : null}
    </Stack>
  )
}

/**
 * An app that fetches the server's key: the block is drawn before the key is there, and the app can
 * take the block off the page.
 */
function LateKeyCase() {
  const browser = useRef(fakeBrowser("granted")).current
  const publicKey = useSignal<string | undefined>(undefined)
  const shown = useSignal(true)
  // Changed so the line under the block is drawn again after a listener was added or removed.
  const tick = useSignal(0)
  return (
    <Stack gap="sm" data-e2e="push-late">
      {shown.value
        ? <LateKeyBlock browser={browser} publicKey={publicKey.value} />
        : <p class="text-sm text-muted">The block is off the page.</p>}
      <p class="text-xs text-muted" data-e2e="push-listeners" data-tick={tick.value}>
        visibility listeners: {browser.listening()}
      </p>
      <Cluster gap="sm">
        <Button
          variant="outline"
          size="sm"
          data-e2e="push-give-key"
          onClick={() => (publicKey.value = DEMO_PUBLIC_KEY)}
        >
          The key arrives
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-e2e="push-unmount"
          onClick={() => (shown.value = false)}
        >
          Take the block off the page
        </Button>
        <Button variant="outline" size="sm" data-e2e="push-count" onClick={() => tick.value++}>
          Count the listeners again
        </Button>
      </Cluster>
    </Stack>
  )
}

/** The block of {@link LateKeyCase}: its own component, so unmounting it unmounts the hook. */
function LateKeyBlock(
  { browser, publicKey }: { browser: ReturnType<typeof fakeBrowser>; publicKey?: string },
) {
  const push = usePushSubscription({
    publicKey,
    save: () => {},
    remove: () => {},
    serviceWorker: browser.serviceWorker,
    notification: browser.notification,
    visibility: browser.visibility,
  })
  return <PushSettings {...push} class="pc-card p-4" />
}

const noop = () => {}

/** The two browsers a person can meet, then the states that have no button. */
function PushSettingsDemo() {
  return (
    <Stack gap="xl">
      <Grid minColumnWidth="lg" gap="xl">
        <Part title="A browser where the person allows it">
          <PushCase name="allow" answer="granted" />
        </Part>
        <Part title="A browser where the person blocks it">
          <PushCase name="deny" answer="denied" />
        </Part>
        <Part title="An app whose key arrives after the block is drawn">
          <LateKeyCase />
        </Part>
      </Grid>
      <Grid minColumnWidth="md" gap="xl">
        <Part title="iPhone or iPad, in a browser tab">
          <PushSettings status="needs-install" onEnable={noop} onDisable={noop} />
        </Part>
        <Part title="A browser without push">
          <PushSettings status="unsupported" onEnable={noop} onDisable={noop} />
        </Part>
        <Part title="A server without keys">
          <PushSettings status="unavailable" onEnable={noop} onDisable={noop} />
        </Part>
      </Grid>
    </Stack>
  )
}

export const pushSettingsDemos = {
  PushSettings: {
    summary:
      "The settings block that says whether this device gets notifications and turns them on or off. The browser's permission prompt opens only after the press.",
    wide: true,
    props: [
      {
        name: "status",
        type:
          '"checking" | "unsupported" | "needs-install" | "unavailable" | "blocked" | "off" | "on"',
        description: "What to show; `usePushSubscription` from preact-signals returns it.",
      },
      {
        name: "busy / failed",
        type: '"enable" | "disable" | "test" | null',
        description: "The action running now, and the one that failed last.",
      },
      {
        name: "onEnable / onDisable",
        type: "() => void",
        description: "Turn notifications on or off for this device.",
      },
      {
        name: "onTest",
        type: "() => void",
        description: "Optional; adds Send a test notification while notifications are on.",
      },
      {
        name: "labels",
        type: "Partial<PushSettingsLabels>",
        description: "Every sentence and button name, each with an English default.",
      },
    ],
    snippet: `const push = usePushSubscription({
  publicKey, // the server's VAPID public key; null when it has none
  save: (subscription) => server.savePushSubscription(subscription),
  remove: (endpoint) => server.removePushSubscription(endpoint),
  sendTest: () => server.sendTestPush(),
})

<PushSettings {...push} />`,
    render: () => <PushSettingsDemo />,
  },
} satisfies DemoFragment
