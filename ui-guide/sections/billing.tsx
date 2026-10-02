/**
 * The `ui/` billing components: a pricing table, the current plan's card and an upgrade prompt.
 *
 * Every form here posts to `form-demo/`, the static page `pages/build.ts` copies into the artefact,
 * as the enhanced-forms cards do: with scripts off, or with the pricing card's callback switched
 * off, a "Choose" lands there. Only `pages/serve.ts`, the local server `verify` drives, answers a
 * POST; the published GitHub Pages site answers it with `405 Method Not Allowed`.
 */

import {
  BillingInterval,
  Checkbox,
  Grid,
  PlanCard,
  type PricingPlan,
  PricingTable,
  Stack,
  SubscriptionStatus,
  UpgradePrompt,
} from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** Where every form in this section posts while no callback takes it over. */
const FORM_DEMO_ACTION = "form-demo/"

/** The pricing card's plans: a free plan under both intervals, and two paid plans per interval. */
const DEMO_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For trying it out.",
    amount: 0,
    currency: "EUR",
    features: ["1 project", "Community support"],
  },
  {
    id: "pro-month",
    name: "Pro",
    description: "For a working team.",
    amount: 1200,
    currency: "EUR",
    interval: BillingInterval.Month,
    features: ["Unlimited projects", "Email support"],
    highlighted: true,
  },
  {
    id: "pro-year",
    name: "Pro",
    description: "For a working team.",
    amount: 12000,
    currency: "EUR",
    interval: BillingInterval.Year,
    features: ["Unlimited projects", "Email support", "Two months free"],
    highlighted: true,
  },
  {
    id: "business-month",
    name: "Business",
    description: "For several teams.",
    amount: 4900,
    currency: "EUR",
    interval: BillingInterval.Month,
    features: ["Everything in Pro", "Single sign-on", "Priority support"],
  },
  {
    id: "business-year",
    name: "Business",
    description: "For several teams.",
    amount: 49000,
    currency: "EUR",
    interval: BillingInterval.Year,
    features: ["Everything in Pro", "Single sign-on", "Priority support"],
  },
]

/**
 * The pricing table, with `onChoose` on by default. Switching it off leaves every "Choose" a plain
 * form post, which is also what a visitor with no script gets either way.
 */
function PricingTableDemo() {
  const callbackOn = useSignal(true)
  const chosen = useSignal("nothing yet")

  return (
    <Stack>
      <Checkbox
        checked={callbackOn.value}
        onChange={(event) => callbackOn.value = event.currentTarget.checked}
        data-e2e="pricing-callback-toggle"
      >
        Hand the choice to onChoose
      </Checkbox>
      <PricingTable
        plans={DEMO_PLANS}
        action={FORM_DEMO_ACTION}
        headingLevel={4}
        onChoose={callbackOn.value ? (plan) => chosen.value = plan.id : undefined}
      />
      <DemoNote>
        onChoose received: <span data-e2e="pricing-chosen">{chosen.value}</span>
      </DemoNote>
    </Stack>
  )
}

/** 23:30 UTC on 31 October 2026, the end of every demo plan's period. */
const PERIOD_END = new Date(Date.UTC(2026, 9, 31, 23, 30))

/** One card per status, and an active plan set to stop at the end of its period. */
function PlanCardDemo() {
  const price = { amount: 1200, currency: "EUR", interval: BillingInterval.Month }
  return (
    <Grid>
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.Active}
        price={price}
        periodEnd={PERIOD_END}
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.PastDue}
        price={price}
        periodEnd={PERIOD_END}
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.Trialing}
        price={price}
        periodEnd={PERIOD_END}
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.Active}
        price={price}
        periodEnd={PERIOD_END}
        cancelAtPeriodEnd
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.Incomplete}
        price={price}
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
      <PlanCard
        planName="Pro"
        status={SubscriptionStatus.Canceled}
        periodEnd={PERIOD_END}
        manageAction={FORM_DEMO_ACTION}
        headingLevel={4}
      />
    </Grid>
  )
}

export const billingDemos = {
  PricingTable: {
    summary:
      "Plans side by side, each with a Choose form that posts its ID, and a monthly or yearly toggle that needs no script.",
    wide: true,
    props: [
      {
        name: "plans",
        type: "PricingPlan[]",
        description:
          "Each price its own entry, with an amount in the smallest unit; one with no `interval` shows under both.",
      },
      {
        name: "onChoose",
        type: "(plan: PricingPlan) => void",
        description: "Takes the choice over from the form post once the script runs.",
      },
      {
        name: "action",
        type: "string",
        description: "Where each plan's form posts; left out, the page's own URL.",
      },
      {
        name: "fieldName",
        type: "string",
        default: `"planId"`,
        description: "The hidden field that carries the plan's ID.",
      },
      {
        name: "defaultInterval",
        type: "BillingIntervalValue",
        default: "BillingInterval.Month",
        description: "The interval shown first.",
      },
      {
        name: "labels",
        type: "Partial<PricingTableLabels>",
        description:
          "Replaces any of the English words; `intervals` and `per` merge key by key, and `chooseName` follows `choose` unless given.",
      },
    ],
    snippet: `<PricingTable
  plans={[
    { id: "free", name: "Free", amount: 0, currency: "EUR" },
    { id: "pro-month", name: "Pro", amount: 1200, currency: "EUR",
      interval: BillingInterval.Month, highlighted: true },
    { id: "pro-year", name: "Pro", amount: 12000, currency: "EUR",
      interval: BillingInterval.Year, highlighted: true },
  ]}
  action="/billing/checkout"
  onChoose={(plan) => startCheckout(plan.id)}
/>`,
    render: () => <PricingTableDemo />,
  },
  PlanCard: {
    summary:
      "The current plan with its status, the date it renews or ends, a warning when payment failed, and a Manage billing form.",
    wide: true,
    props: [
      {
        name: "status",
        type: "SubscriptionStatusValue",
        description:
          "Trialing, active, past due, canceled or incomplete, shown in words; another package's same-valued enum passes too.",
      },
      {
        name: "periodEnd",
        type: "Date",
        description: "When the period ends; the card words it by status.",
      },
      {
        name: "cancelAtPeriodEnd",
        type: "boolean",
        default: "false",
        description: "Says the plan ends rather than renews.",
      },
      {
        name: "manageAction",
        type: "string",
        description: "Where Manage billing posts: the app's billing-portal route.",
      },
      {
        name: "timeZone",
        type: "string",
        default: `"UTC"`,
        description: "The zone the date is shown in.",
      },
      {
        name: "labels",
        type: "Partial<PlanCardLabels>",
        description:
          "Replaces any of the English words, the date lines as functions; `status` and `per` merge key by key.",
      },
    ],
    snippet: `<PlanCard
  planName="Pro"
  status={SubscriptionStatus.PastDue}
  price={{ amount: 1200, currency: "EUR", interval: BillingInterval.Month }}
  periodEnd={subscription.currentPeriodEnd}
  manageAction="/billing/portal"
/>`,
    render: () => <PlanCardDemo />,
  },
  UpgradePrompt: {
    summary:
      "A short message and an upgrade link, in place of a feature the plan does not include.",
    wide: false,
    props: [
      { name: "href", type: "string", description: "Where the upgrade link goes." },
      {
        name: "navigate",
        type: "(href: string) => void",
        description: "The app's router, called on a plain click instead of following the link.",
      },
      {
        name: "labels",
        type: "Partial<UpgradePromptLabels>",
        description: "Replaces the title, the message or the link's text.",
      },
    ],
    snippet: `<UpgradePrompt
  href="/pricing"
  labels={{ message: "Exports come with the Pro plan." }}
/>`,
    render: () => (
      <UpgradePrompt
        href="#billing"
        headingLevel={4}
        labels={{ message: "Exports come with the Pro plan." }}
      />
    ),
  },
} satisfies DemoFragment
