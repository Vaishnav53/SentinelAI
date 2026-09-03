/**
 * SentinelAI Date & Time Utility
 *
 * Safely parses and formats UTC timestamps from the SentinelAI backend,
 * ensuring naive UTC strings (e.g. "2026-08-26T10:30:08.370903") are
 * properly treated as UTC and rendered in the browser's local timezone.
 */

/**
 * Parses an input value (string, number, Date) into a valid Date object,
 * treating timezone-naive ISO date strings from SentinelAI as UTC.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {Date|null} Date object or null if invalid/empty
 */
export function parseUtcDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const str = value.trim();
  if (!str) return null;

  // Check if string already contains an explicit timezone designator:
  // 1. Ends with 'Z' (case-insensitive) -> e.g. "2026-08-26T10:30:08Z"
  // 2. Contains explicit offset suffix -> e.g. "+05:30", "-04:00", "+0000", "-05"
  const hasTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(str);

  let parseableStr = str;
  if (!hasTimezone) {
    // If it's a space-separated SQL timestamp like "2026-08-26 10:30:08.370903", convert to ISO "T"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(parseableStr)) {
      parseableStr = parseableStr.replace(' ', 'T');
    }
    // Append 'Z' to treat naive string as UTC
    parseableStr = `${parseableStr}Z`;
  }

  const date = new Date(parseableStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a UTC timestamp into a browser-local time string (e.g. "4:00:08 PM").
 *
 * @param {string|number|Date|null|undefined} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} Formatted local time string or empty string on failure
 */
export function formatLocalTime(value, options) {
  const date = parseUtcDate(value);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, options);
}

/**
 * Formats a UTC timestamp into a browser-local date and time string (e.g. "8/26/2026, 4:00:08 PM").
 *
 * @param {string|number|Date|null|undefined} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} Formatted local date-time string or empty string on failure
 */
export function formatLocalDateTime(value, options) {
  const date = parseUtcDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, options);
}

/**
 * Formats a UTC timestamp into a browser-local date string (e.g. "8/26/2026").
 *
 * @param {string|number|Date|null|undefined} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} Formatted local date string or empty string on failure
 */
export function formatLocalDate(value, options) {
  const date = parseUtcDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, options);
}

/**
 * Checks whether an event occurred recently (within thresholdMs).
 * Evaluates against the client's current time epoch.
 *
 * @param {string|number|Date|null|undefined} value
 * @param {number} [thresholdMs=20000] Default 20 seconds (20,000 ms)
 * @returns {boolean} True if event was captured within thresholdMs
 */
export function isRecentEvent(value, thresholdMs = 20000) {
  const date = parseUtcDate(value);
  if (!date) return false;
  const elapsed = Date.now() - date.getTime();
  return elapsed >= 0 && elapsed < thresholdMs;
}
