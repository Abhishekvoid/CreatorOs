/**
 * Domain errors for the payments layer. Callers depend on these, never on
 * provider-specific or pg error shapes.
 */

/** A provider method that isn't wired up yet (RouteProvider, Phase 4+ stubs). */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = "NotImplementedError";
  }
}

/**
 * The provider failed to create an order after the booking + lock were
 * committed. The orchestrator has already compensated (lock released,
 * booking cancelled) before throwing this.
 */
export class OrderCreationError extends Error {
  readonly correlationId: string;
  readonly cause?: unknown;

  constructor(correlationId: string, cause?: unknown) {
    super(`Provider failed to create an order (correlation_id=${correlationId})`);
    this.name = "OrderCreationError";
    this.correlationId = correlationId;
    this.cause = cause;
  }
}

/** A recovery action targeted a row that does not exist. */
export class RecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryError";
  }
}
