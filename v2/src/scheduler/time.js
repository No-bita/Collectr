/**
 * Scheduler Time Engine
 * Computes recurrence advancement while strictly preserving local wall-clock time
 * in the schedule's configured IANA timezone (e.g. 'Asia/Kolkata').
 */

/**
 * Converts local components (year, month 1-12, day, hour 0-23, min, sec) in timezone `tz` to UTC Date.
 */
export function localToUtc(y, m, d, h, min, s = 0, tz = "UTC") {
  const safeTz = isValidTimezone(tz) ? tz : "UTC";
  const guess = new Date(Date.UTC(y, m - 1, d, h, min, s));
  
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const getParts = (date) => {
    const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
    let hr = parseInt(p.hour, 10);
    if (hr === 24) hr = 0;
    return new Date(Date.UTC(
      parseInt(p.year, 10),
      parseInt(p.month, 10) - 1,
      parseInt(p.day, 10),
      hr,
      parseInt(p.minute, 10),
      parseInt(p.second, 10)
    ));
  };

  const localDateForGuess = getParts(guess);
  const diffMs = guess.getTime() - localDateForGuess.getTime();
  return new Date(guess.getTime() + diffMs);
}

/**
 * Extracts local date-time components for a given UTC date in a specific timezone.
 */
export function utcToLocalParts(utcDate, tz = "UTC") {
  const safeTz = isValidTimezone(tz) ? tz : "UTC";
  const d = typeof utcDate === "string" ? parseSqliteUtc(utcDate) : utcDate;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  let hr = parseInt(p.hour, 10);
  if (hr === 24) hr = 0;

  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10), // 1 - 12
    day: parseInt(p.day, 10),
    hour: hr,
    minute: parseInt(p.minute, 10),
    second: parseInt(p.second, 10)
  };
}



/**
 * Converts a JS Date into a standardized SQLite UTC string: 'YYYY-MM-DD HH:MM:SS'
 */
export function toSqliteUtc(date) {
  const d = new Date(date);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * Parses an SQLite UTC string or ISO string into a JS Date
 */
export function parseSqliteUtc(str) {
  if (!str) return new Date();
  if (str.includes("T")) return new Date(str);
  return new Date(str.replace(" ", "T") + "Z");
}

/**
 * Validates whether an IANA timezone string is recognized by the V8 runtime.
 */
export function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Converts a scheduledFor input (which may be a datetime-local string 'YYYY-MM-DDTHH:mm'
 * or an ISO UTC string) in a given IANA timezone to a standardized SQLite UTC string.
 * Strictly guarantees datetime-local strings are parsed in the specified IANA timezone,
 * never accidentally interpreted as UTC.
 */
export function parseScheduledForToUtc(scheduledFor, timezone = "Asia/Kolkata") {
  if (!scheduledFor) return toSqliteUtc(new Date());

  const safeTz = isValidTimezone(timezone) ? timezone : "Asia/Kolkata";

  // Case 1: If string includes an explicit UTC offset ('Z' or '+/-HH:mm')
  if (typeof scheduledFor === "string" && (scheduledFor.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(scheduledFor))) {
    const d = new Date(scheduledFor);
    if (!isNaN(d.getTime())) return toSqliteUtc(d);
  }

  // Case 2: datetime-local string format "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm:ss" without offset
  // Parse year, month, day, hour, minute and convert using localToUtc in the target IANA timezone
  if (typeof scheduledFor === "string") {
    const match = scheduledFor.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, y, m, d, h, min, s] = match;
      const utcDate = localToUtc(
        parseInt(y, 10),
        parseInt(m, 10),
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s || "0", 10),
        safeTz
      );
      return toSqliteUtc(utcDate);
    }
  }

  // Fallback if Date object or other parseable date
  const d = new Date(scheduledFor);
  if (!isNaN(d.getTime())) return toSqliteUtc(d);
  return toSqliteUtc(new Date());
}
