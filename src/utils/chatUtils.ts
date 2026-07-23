import { ChatMessage } from '../types';

/**
 * Safely parses ISO timestamp or string timestamp into epoch milliseconds with full precision.
 */
export function parseMessageTimestamp(ts: string | undefined | null): number {
  if (!ts) return 0;
  const num = Number(ts);
  if (!isNaN(num) && isFinite(num) && num > 0) return num;
  
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sorts array of ChatMessages chronologically (oldest first, newest last)
 * taking into account exact millisecond precision and a deterministic ID tie-breaker.
 */
export function sortMessagesChronologically(msgs: ChatMessage[]): ChatMessage[] {
  if (!msgs || !Array.isArray(msgs)) return [];
  return [...msgs].sort((a, b) => {
    const timeA = parseMessageTimestamp(a?.timestamp);
    const timeB = parseMessageTimestamp(b?.timestamp);
    if (timeA !== timeB) {
      return timeA - timeB; // Ascending epoch time
    }
    // Tie-breaker when two messages have identical millisecond timestamps
    return (a?.id || '').localeCompare(b?.id || '');
  });
}
