/**
 * Payments layer public surface. Outside code uses the orchestrator and the
 * provider boundary only — never a provider implementation or the SDK directly.
 */
export { initiate } from "./initiate";
export type { InitiateInput, CheckoutPayload } from "./initiate";
export { getPaymentProvider } from "./provider";
export type { PaymentProvider } from "./provider";
export { NotImplementedError, OrderCreationError } from "./errors";
