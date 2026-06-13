/**
 * Notifications layer public surface. Outside code uses the worker and the
 * provider boundary only — never a concrete provider SDK directly.
 */
export {
  processNotifications,
  reapStuckNotifications,
  claimAndLease,
  PROCESSING_LEASE_SECONDS,
  BACKOFF_MINUTES,
} from "./worker";
export type { ProcessNotificationsSummary, ClaimedNotification } from "./worker";
export {
  ConsoleNotificationProvider,
  getNotificationProvider,
} from "./provider";
export type { NotificationProvider, NotificationMessage, NotificationResult } from "./provider";
