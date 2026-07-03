/**
 * Escape a user-supplied string so it can be used safely as a literal inside a
 * MongoDB `$regex` query — prevents regex injection and ReDoS.
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
