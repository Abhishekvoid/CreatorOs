/**
 * Billing layer public surface. Outside code uses these entry points and the
 * billing provider boundary only — never a provider implementation or the SDK.
 * Billing mirrors the payments architecture on its own tables and never
 * modifies the frozen payments tables, payment_events, or the payments ingest.
 */
export { classifyWebhookEvent } from "./classify";
export type { WebhookRoute } from "./classify";
export { ingestBillingWebhook } from "./ingest";
export type { BillingIngestInput, BillingIngestResult } from "./ingest";
export {
  processPendingBillingEvents,
  reconcileBillingExpiries,
} from "./processor";
export type { BillingProcessSummary, BillingReconcileSummary } from "./processor";
export { getBillingProvider } from "./provider";
export type { BillingProvider } from "./provider";
export {
  BookingsUnavailableError,
  canAcceptBooking,
  canCreateService,
  confirmedBookingsThisMonth,
  enqueueCreatorLimitNudges,
  getPlan,
  FREE_BOOKINGS_PER_MONTH,
  FREE_MAX_SERVICES,
} from "./enforcement";
