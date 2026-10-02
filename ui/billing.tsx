import { join } from "@spy4x/preact-cn/join"
import { IconAlertTriangle, IconCheck, IconLockClosed } from "@spy4x/preact-icons"
import { formatMoney } from "@spy4x/platform/universal/money"
import type { JSX } from "preact"
import { useId, useState } from "preact/hooks"
import { Button } from "./button.tsx"

/** How often a plan bills. */
export enum BillingInterval {
  Month = 1,
  Year = 2,
}

/**
 * A billing interval: this package's enum, or the same number from an app's own enum, so an app
 * passes its value without a cast.
 */
export type BillingIntervalValue = BillingInterval | 1 | 2

/**
 * Where a subscription stands. The members follow the five statuses spy4x/ts-libs#362 proposes for
 * `@spy4x/billing`, numbered from 1 in the order it lists them. This package does not import that
 * one, so the components stay usable with any billing provider.
 */
export enum SubscriptionStatus {
  Trialing = 1,
  Active = 2,
  PastDue = 3,
  Canceled = 4,
  Incomplete = 5,
}

/**
 * A subscription status: this package's enum, or the same number from another package's enum, such
 * as `@spy4x/billing`'s, so an app passes its value without a cast.
 */
export type SubscriptionStatusValue = SubscriptionStatus | 1 | 2 | 3 | 4 | 5

/** A price: an amount in the currency's smallest unit, and how often it is charged. */
export interface PlanPrice {
  /** In `currency`'s smallest unit: `1200` is €12.00 for `EUR`. Formatted with `formatMoney`. */
  amount: number
  /** ISO 4217 code, such as `"EUR"`. */
  currency: string
  /** How often the price is charged. Left out, the price has no "per month" or "per year". */
  interval?: BillingIntervalValue
}

/** One plan of a {@link PricingTable}. */
export interface PricingPlan extends PlanPrice {
  /** The app's own plan ID, posted in the plan's form and handed to `onChoose`. */
  id: string
  /** The plan's name, shown as its heading and used in its "Choose" button's accessible name. */
  name: string
  /** One short line under the name. */
  description?: string
  /** What the plan includes, one item per line. */
  features?: string[]
  /** Draws this plan raised, with the `highlighted` label under its name. */
  highlighted?: boolean
}

/** Words {@link PricingTable} shows or announces. Each one has an English default. */
export interface PricingTableLabels {
  /** The interval toggle's group name, for screen readers. Defaults to `"Billing period"`. */
  intervalLegend: string
  /**
   * Each interval's option in the toggle. Defaults to `"Monthly"` and `"Yearly"`. Merged key by key
   * over the defaults, so a caller may pass one interval's word alone.
   */
  intervals: Partial<Record<1 | 2, string>>
  /**
   * Text after a price. Defaults to `"per month"` and `"per year"`, merged key by key. A price
   * whose interval has no word shows none.
   */
  per: Partial<Record<1 | 2, string>>
  /** The label under the highlighted plan's name. Defaults to `"Most popular"`. */
  highlighted: string
  /** The visible text of each plan's button. Defaults to `"Choose"`. */
  choose: string
  /**
   * Each plan's button's accessible name, from the plan's name. Left out, it is `choose`, a space
   * and the name, so overriding `choose` alone also renames the button; pass this when the language
   * puts the words in another order.
   */
  chooseName: (planName: string) => string
}

/** The English words {@link PricingTable} uses when a caller passes none. */
export const defaultPricingTableLabels: PricingTableLabels = {
  intervalLegend: "Billing period",
  intervals: { [BillingInterval.Month]: "Monthly", [BillingInterval.Year]: "Yearly" },
  per: { [BillingInterval.Month]: "per month", [BillingInterval.Year]: "per year" },
  highlighted: "Most popular",
  choose: "Choose",
  chooseName: (planName) => `Choose ${planName}`,
}

/** Heading level of a billing component's own heading. */
export type BillingHeadingLevel = 2 | 3 | 4 | 5 | 6

export interface PricingTableProps {
  /**
   * Every plan, each price on its own entry: a plan sold monthly and yearly is two entries with two
   * IDs. A plan with no `interval` shows under both intervals.
   */
  plans: PricingPlan[]
  /**
   * Called with the chosen plan instead of posting its form. Left out, "Choose" posts the form to
   * `action`, which also happens whenever the page runs no script.
   */
  onChoose?: (plan: PricingPlan) => void
  /** Where each plan's form posts. Left out, it posts to the page's own URL. */
  action?: string
  /** Name of the hidden field that carries the plan's ID. Defaults to `"planId"`. */
  fieldName?: string
  /** The interval shown first, when the plans have both. Defaults to monthly. */
  defaultInterval?: BillingIntervalValue
  /** BCP 47 locale the prices are formatted in. Defaults to `"en"`. */
  locale?: string
  /** Level of each plan's name heading. Defaults to `3`. */
  headingLevel?: BillingHeadingLevel
  /** Replaces any of the English words; see {@link PricingTableLabels}. */
  labels?: Partial<PricingTableLabels>
  /** Utilities for the outer element, appended to its own and merged with none of them. */
  class?: string
}

/** Identifier of an interval in markup: the toggle's values and the CSS that reads them. */
const INTERVAL_KEYS: Record<BillingInterval, "month" | "year"> = {
  [BillingInterval.Month]: "month",
  [BillingInterval.Year]: "year",
}

/**
 * Hides a plan while the toggle shows the other interval. Written out whole, once per interval, so
 * Tailwind's scanner sees each class. The rule is CSS (`:has(:checked)` on the table), so the toggle
 * works on a page that runs no script.
 */
const HIDDEN_UNLESS: Partial<Record<1 | 2, string>> = {
  [BillingInterval.Month]: "group-has-[[data-pricing-interval=year]:checked]/pricing:hidden",
  [BillingInterval.Year]: "group-has-[[data-pricing-interval=month]:checked]/pricing:hidden",
}

/** The outline-pill look of a short label: a grey outline `Badge`'s, without `cn`. */
const pillClasses =
  "inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap"

/**
 * Plans side by side, each with its price, its features and a "Choose" button.
 *
 * Each "Choose" is a real `<form method="post">` holding the plan's ID in a hidden field, so a
 * choice works before any script has run; `onChoose`, when given, takes the submit over. When the
 * plans carry both intervals, a monthly/yearly toggle sits above them. The toggle is a pair of
 * native radio buttons, so the arrow keys move it, and a CSS rule hides the plans of the other
 * interval, so it works with no script either.
 *
 * @param props See {@link PricingTableProps}.
 */
export function PricingTable(
  {
    plans,
    onChoose,
    action,
    fieldName = "planId",
    defaultInterval = BillingInterval.Month,
    locale = "en",
    headingLevel = 3,
    labels,
    class: className,
  }: PricingTableProps,
): JSX.Element {
  const words = {
    ...defaultPricingTableLabels,
    ...labels,
    intervals: { ...defaultPricingTableLabels.intervals, ...labels?.intervals },
    per: { ...defaultPricingTableLabels.per, ...labels?.per },
  }
  const chooseName = labels?.chooseName ?? ((name: string) => `${words.choose} ${name}`)
  const groupName = useId()
  const [interval, setInterval] = useState<BillingIntervalValue>(defaultInterval)
  const intervals = [BillingInterval.Month, BillingInterval.Year].filter((each) =>
    plans.some((plan) => plan.interval === each)
  )
  const toggled = intervals.length > 1
  const Heading = `h${headingLevel}` as "h3"

  return (
    <div class={join("group/pricing flex flex-col gap-6", className)}>
      {toggled && (
        <fieldset class="flex justify-center">
          <legend class="sr-only">{words.intervalLegend}</legend>
          <div class="inline-flex gap-1 rounded-md border border-control bg-surface p-1">
            {intervals.map((each) => (
              <label
                key={each}
                class="group/option inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-1 text-sm font-medium text-foreground has-[:checked]:bg-selected has-[:checked]:font-semibold has-[:checked]:text-selected-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus"
              >
                <input
                  type="radio"
                  class="sr-only"
                  name={groupName}
                  value={INTERVAL_KEYS[each]}
                  data-pricing-interval={INTERVAL_KEYS[each]}
                  checked={interval === each}
                  onChange={() => setInterval(each)}
                />
                <IconCheck class="hidden size-4 group-has-[:checked]/option:block" />
                {words.intervals[each]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <ul class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
        {plans.map((plan) => (
          <li
            key={plan.id}
            data-plan={plan.id}
            class={join(
              "pc-card flex flex-col",
              plan.highlighted && "border-2 border-selected shadow-raised",
              toggled && plan.interval !== undefined && HIDDEN_UNLESS[plan.interval],
            )}
          >
            <div class="pc-card-body flex flex-1 flex-col gap-4">
              <div class="flex flex-col gap-1">
                <Heading class="text-lg font-semibold">{plan.name}</Heading>
                {plan.highlighted && (
                  <span
                    class={join(
                      pillClasses,
                      "border-selected bg-selected text-selected-foreground",
                    )}
                  >
                    {words.highlighted}
                  </span>
                )}
                {plan.description && <p class="text-sm text-muted">{plan.description}</p>}
              </div>
              <p class="flex flex-wrap items-baseline gap-1">
                <span class="text-3xl font-semibold">
                  {formatMoney(plan.amount, plan.currency, locale)}
                </span>
                {plan.interval !== undefined && words.per[plan.interval] && (
                  <span class="text-sm text-muted">{words.per[plan.interval]}</span>
                )}
              </p>
              {plan.features && plan.features.length > 0 && (
                <ul class="flex flex-col gap-2 text-sm">
                  {plan.features.map((feature, index) => <li key={index}>{feature}</li>)}
                </ul>
              )}
            </div>
            <form
              method="post"
              action={action}
              class="pc-card-footer"
              onSubmit={onChoose &&
                ((event) => {
                  event.preventDefault()
                  onChoose(plan)
                })}
            >
              <input type="hidden" name={fieldName} value={plan.id} />
              <Button
                type="submit"
                variant={plan.highlighted ? "primary" : "outline"}
                class="w-full"
                aria-label={chooseName(plan.name)}
              >
                {words.choose}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Words {@link PlanCard} shows. Each one has an English default. */
export interface PlanCardLabels {
  /**
   * Each status, in words. Defaults to `"Trial"`, `"Active"`, `"Past due"`, `"Canceled"` and
   * `"Incomplete"`, merged key by key, so a caller may pass some alone. A status with no word shows
   * no pill rather than an empty one.
   */
  status: Partial<Record<1 | 2 | 3 | 4 | 5, string>>
  /** Text after the price. Defaults to `"per month"` and `"per year"`, merged key by key. */
  per: Partial<Record<1 | 2, string>>
  /** The date line of a trial, from the formatted date. Defaults to `Trial ends on <date>`. */
  trialEnds: (date: string) => string
  /** The date line of a plan that renews. Defaults to `Renews on <date>`. */
  renews: (date: string) => string
  /** The date line of a plan set to stop at the end of its period. Defaults to `Ends on <date>`. */
  ends: (date: string) => string
  /** The date line of a canceled plan. Defaults to `Ended on <date>`. */
  ended: (date: string) => string
  /** The warning a past-due plan shows. */
  pastDue: string
  /** The warning a plan whose first payment has not gone through shows. */
  incomplete: string
  /** The button that posts to `manageAction`. Defaults to `"Manage billing"`. */
  manage: string
}

/** The English words {@link PlanCard} uses when a caller passes none. */
export const defaultPlanCardLabels: PlanCardLabels = {
  status: {
    [SubscriptionStatus.Trialing]: "Trial",
    [SubscriptionStatus.Active]: "Active",
    [SubscriptionStatus.PastDue]: "Past due",
    [SubscriptionStatus.Canceled]: "Canceled",
    [SubscriptionStatus.Incomplete]: "Incomplete",
  },
  per: defaultPricingTableLabels.per,
  trialEnds: (date) => `Trial ends on ${date}`,
  renews: (date) => `Renews on ${date}`,
  ends: (date) => `Ends on ${date}`,
  ended: (date) => `Ended on ${date}`,
  pastDue: "Your last payment failed. Update your payment method to keep your plan.",
  incomplete: "Your first payment has not gone through. Complete it to start your plan.",
  manage: "Manage billing",
}

export interface PlanCardProps {
  /** The current plan's name, shown as the card's heading. */
  planName: string
  /** Where the subscription stands: this package's enum, or the same number from another's. */
  status: SubscriptionStatusValue
  /** The plan's price, shown under its name. Left out, the card shows none. */
  price?: PlanPrice
  /** When the current period ends: the renewal, the end of the trial, or the end of access. */
  periodEnd?: Date
  /** The plan stops at `periodEnd` instead of renewing. Defaults to `false`. */
  cancelAtPeriodEnd?: boolean
  /** Where "Manage billing" posts: the app's route that opens the provider's billing portal. */
  manageAction: string
  /** BCP 47 locale for the price and the date. Defaults to `"en"`. */
  locale?: string
  /**
   * Time zone the date is shown in. Defaults to `"UTC"`, so the server and the browser print the
   * same day; pass the viewer's zone when the app knows it.
   */
  timeZone?: string
  /** Level of the plan name's heading. Defaults to `2`. */
  headingLevel?: BillingHeadingLevel
  /** Replaces any of the English words; see {@link PlanCardLabels}. */
  labels?: Partial<PlanCardLabels>
  /** Utilities for the card, appended to its own and merged with none of them. */
  class?: string
}

/**
 * The date line of a plan in `status`, or `null` when the status has none to show.
 *
 * @param words The card's labels.
 * @param status Where the subscription stands.
 * @param cancelAtPeriodEnd Whether an active plan stops at the end of its period.
 * @param date The formatted end of the period.
 * @returns The line, or `null` for a past-due or incomplete plan, whose warning says what matters.
 */
function dateLine(
  words: PlanCardLabels,
  status: SubscriptionStatusValue,
  cancelAtPeriodEnd: boolean,
  date: string,
): string | null {
  switch (status) {
    case SubscriptionStatus.Trialing:
      return words.trialEnds(date)
    case SubscriptionStatus.Active:
      return cancelAtPeriodEnd ? words.ends(date) : words.renews(date)
    case SubscriptionStatus.Canceled:
      return words.ended(date)
    default:
      return null
  }
}

/**
 * The current plan: its name, status, price and the date it renews or ends, with a "Manage billing"
 * form that posts to the app's billing-portal route.
 *
 * A past-due or incomplete plan shows a warning in words beside a warning icon, so the state does
 * not rest on colour. The status is text too, in a pill next to the name.
 *
 * @param props See {@link PlanCardProps}.
 */
export function PlanCard(
  {
    planName,
    status,
    price,
    periodEnd,
    cancelAtPeriodEnd = false,
    manageAction,
    locale = "en",
    timeZone = "UTC",
    headingLevel = 2,
    labels,
    class: className,
  }: PlanCardProps,
): JSX.Element {
  const words = {
    ...defaultPlanCardLabels,
    ...labels,
    status: { ...defaultPlanCardLabels.status, ...labels?.status },
    per: { ...defaultPlanCardLabels.per, ...labels?.per },
  }
  const Heading = `h${headingLevel}` as "h2"
  const statusWord = words.status[status]
  const date = periodEnd &&
    dateLine(
      words,
      status,
      cancelAtPeriodEnd,
      new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(periodEnd),
    )
  const warning = status === SubscriptionStatus.PastDue
    ? words.pastDue
    : status === SubscriptionStatus.Incomplete
    ? words.incomplete
    : null

  return (
    <div class={join("pc-card", className)} data-status={status}>
      <div class="pc-card-header gap-2">
        <Heading class="text-lg font-semibold">{planName}</Heading>
        {statusWord && (
          <span class={join(pillClasses, "border-control text-muted")}>{statusWord}</span>
        )}
      </div>
      <div class="pc-card-body flex flex-col gap-2">
        {price && (
          <p class="flex flex-wrap items-baseline gap-1">
            <span class="text-xl font-semibold">
              {formatMoney(price.amount, price.currency, locale)}
            </span>
            {price.interval !== undefined && words.per[price.interval] && (
              <span class="text-sm text-muted">{words.per[price.interval]}</span>
            )}
          </p>
        )}
        {date && <p class="text-sm text-muted">{date}</p>}
        {warning && (
          <p
            data-plan-warning
            class="flex items-start gap-2 rounded-md border border-warning px-3 py-2 text-sm text-foreground"
          >
            <IconAlertTriangle class="size-5 text-warning" />
            <span>{warning}</span>
          </p>
        )}
      </div>
      <form method="post" action={manageAction} class="pc-card-footer">
        <Button type="submit" variant="outline">{words.manage}</Button>
      </form>
    </div>
  )
}

/** Words {@link UpgradePrompt} shows. Each one has an English default. */
export interface UpgradePromptLabels {
  /** The prompt's heading. Defaults to `"Upgrade to use this feature"`. */
  title: string
  /** The line under the heading. Defaults to `"Your plan does not include this feature."`. */
  message: string
  /** The link's text. Defaults to `"See plans"`. */
  action: string
}

/** The English words {@link UpgradePrompt} uses when a caller passes none. */
export const defaultUpgradePromptLabels: UpgradePromptLabels = {
  title: "Upgrade to use this feature",
  message: "Your plan does not include this feature.",
  action: "See plans",
}

export interface UpgradePromptProps {
  /** Where the upgrade link goes, such as the pricing page. A real `href`, so it works with no script. */
  href: string
  /** Called with `href` on a plain click instead of the browser following the link: the app's router. */
  navigate?: (href: string) => void
  /** Level of the title's heading. Defaults to `2`. */
  headingLevel?: BillingHeadingLevel
  /** Replaces any of the English words; see {@link UpgradePromptLabels}. */
  labels?: Partial<UpgradePromptLabels>
  /** Utilities for the outer element, appended to its own and merged with none of them. */
  class?: string
}

/**
 * A short message and an upgrade link, shown in place of a feature the current plan does not
 * include.
 *
 * @param props See {@link UpgradePromptProps}.
 */
export function UpgradePrompt(
  { href, navigate, headingLevel = 2, labels, class: className }: UpgradePromptProps,
): JSX.Element {
  const words = { ...defaultUpgradePromptLabels, ...labels }
  const Heading = `h${headingLevel}` as "h2"

  return (
    <div
      class={join(
        "flex flex-col items-start gap-4 rounded-md border border-dashed border-control bg-surface p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <IconLockClosed class="size-6 text-muted" />
      <div class="flex flex-1 flex-col gap-1">
        <Heading class="text-base font-semibold">{words.title}</Heading>
        <p class="text-sm text-muted">{words.message}</p>
      </div>
      <Button href={href} navigate={navigate} variant="primary">{words.action}</Button>
    </div>
  )
}
