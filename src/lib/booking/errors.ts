/**
 * Domain errors for the Booking Service. Callers catch these instead of
 * inspecting raw Postgres SQLSTATE codes — the DB layer is an implementation
 * detail that must not leak past this service.
 */

/**
 * Raised when a slot could not be locked because a live lock already holds
 * it (the partial unique index rejected the insert with 23505). This is the
 * race-loser of a double-booking attempt — expected, not exceptional.
 */
export class SlotUnavailableError extends Error {
  readonly creatorId: string;
  readonly slotStart: string;

  constructor(creatorId: string, slotStart: string) {
    super(`Slot ${slotStart} for creator ${creatorId} is no longer available`);
    this.name = "SlotUnavailableError";
    this.creatorId = creatorId;
    this.slotStart = slotStart;
  }
}
