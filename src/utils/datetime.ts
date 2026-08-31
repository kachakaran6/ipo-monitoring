/**
 * Converts a Date or ISO string into an Indian Standard Time (IST) formatted string.
 * Example: '31 Aug 2026, 8:42 PM IST'
 */
export function formatToIST(date: Date | string | number | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(d.getTime())) return 'Invalid Date';

  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d) + ' IST'
  );
}

/**
 * Returns formatted time only in IST (e.g. '20:31 IST').
 */
export function formatTimeIST(date: Date | string | number | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(d.getTime())) return 'N/A';

  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' IST'
  );
}

/**
 * Formats duration in seconds to human readable string (e.g. '4m 18s' or '35s').
 */
export function formatDuration(durationSeconds: number): string {
  if (durationSeconds < 60) {
    return `${Math.round(durationSeconds)}s`;
  }
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculates freshness string relative to now (e.g. '12 seconds ago', '5 minutes ago').
 */
export function calculateFreshness(date: Date | string | null | undefined): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours} hours ago`;
}
