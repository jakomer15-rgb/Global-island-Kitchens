/** Request-time clock helpers for server-rendered admin pages. */

/** The calendar date in Bahrain `days` from now, as YYYY-MM-DD. */
export function bahrainDate(days = 0): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bahrain",
  });
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
