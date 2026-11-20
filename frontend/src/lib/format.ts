/** Shortens a Stellar address to its first 6 and last 4 characters. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Formats a timestamp as a short "time ago" label (e.g. "just now", "5m ago",
 * "3h ago", "2d ago"). Future timestamps — clock skew between the browser and
 * the backend — are treated as "just now".
 */
export function formatTimeAgo(timestamp: string | Date, now: Date = new Date()): string {
  const then = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (Number.isNaN(seconds)) return 'unknown';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
