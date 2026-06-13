/**
 * Booking Service — owns slot locks, booking lifecycle and availability.
 * ZERO Razorpay / payment-provider / orchestrator knowledge (those start
 * in Phase 3). The public surface of the service.
 */
export { acquireLock, expireToReconciliation, confirmBooking, releaseLock } from "./locks";
export type { AcquireLockInput } from "./locks";
export { getAvailability } from "./availability";
export type { AvailableSlot } from "./availability";
export { SlotUnavailableError } from "./errors";
