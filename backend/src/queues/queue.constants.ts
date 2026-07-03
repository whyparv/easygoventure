/**
 * Canonical queue names. Use these constants everywhere instead of string literals
 * so queue registration and producers can never drift apart.
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  FOLLOWUPS: 'followups',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
