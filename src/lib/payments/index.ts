/**
 * Payments layer public surface. Outside code uses the orchestrator and the
 * provider boundary only — never a provider implementation or the SDK directly.
 */
export { initiate } from "./initiate";
export type { InitiateInput, CheckoutPayload } from "./initiate";
export { ingestWebhook } from "./ingest";
export type { IngestInput, IngestResult } from "./ingest";
export { processPendingEvents } from "./processor";
export type { ProcessSummary } from "./processor";
export { reconcileSweep } from "./reconcile";
export type { SweepCounts } from "./reconcile";
export { getPaymentProvider } from "./provider";
export type { PaymentProvider } from "./provider";
export { NotImplementedError, OrderCreationError, RecoveryError } from "./errors";

// Phase 8 — operational layer (read-only health/integrity/dashboard + safe recovery)
export { getPaymentHealth } from "./health";
export type { PaymentHealth } from "./health";
export { runIntegrityChecks } from "./integrity";
export type { IntegrityViolation } from "./integrity";
export { getDashboardData } from "./dashboard";
export type { DashboardData } from "./dashboard";
export { replayEvent, retryReconciliation, retryNotification } from "./recovery";
