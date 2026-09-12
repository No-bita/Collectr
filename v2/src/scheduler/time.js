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
 * Advances local date components by interval ('daily', 'weekly', 'monthly').
 */
export function advanceLocalParts(parts, interval) {
  const { year, month, day, hour, minute, second } = parts;

  if (interval === "daily") {
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
    return {
      year: nextDate.getUTCFullYear(),
      month: nextDate.getUTCMonth() + 1,
      day: nextDate.getUTCDate(),
      hour,
      minute,
      second
    };
  }

  if (interval === "weekly") {
    const nextDate = new Date(Date.UTC(year, month - 1, day + 7));
    return {
      year: nextDate.getUTCFullYear(),
      month: nextDate.getUTCMonth() + 1,
      day: nextDate.getUTCDate(),
      hour,
      minute,
      second
    };
  }

  if (interval === "monthly") {
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const daysInMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    const nextDay = Math.min(day, daysInMonth);
    return {
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour,
      minute,
      second
    };
  }

  // Fallback: return same parts
  return parts;
}

/**
 * Given a current UTC ISO / SQLite string, computes the next UTC run date in format 'YYYY-MM-DD HH:MM:SS',
 * strictly preserving the local wall-clock hour and minute in `timezone`.
 */
export function calculateNextRunUtc(currentUtcStr, interval, timezone = "UTC") {
  if (!interval || interval === "one_off") {
    return null;
  }
  const currentLocal = utcToLocalParts(currentUtcStr, timezone);
  const nextLocal = advanceLocalParts(currentLocal, interval);
  const nextUtcDate = localToUtc(
    nextLocal.year,
    nextLocal.month,
    nextLocal.day,
    nextLocal.hour,
    nextLocal.minute,
    nextLocal.second,
    timezone
  );

  return toSqliteUtc(nextUtcDate);
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
