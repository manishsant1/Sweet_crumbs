// Calendar-date helpers shared by browser and server. Dates are plain "YYYY-MM-DD" strings in the
// bakery's timezone; no Date objects cross the API, so a viewer's timezone can't shift the day.
import { MAX_ADVANCE_DAYS, MIN_LEAD_DAYS, TIMEZONE } from './config.js';

// "YYYY-MM-DD" that is a real calendar date.
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
}

// Today's date in the bakery's timezone (en-CA formats dates as YYYY-MM-DD).
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

export function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const earliestDate = () => addDays(today(), MIN_LEAD_DAYS);
export const latestDate = () => addDays(today(), MAX_ADVANCE_DAYS);

// Returns an error message, or null when the day may be chosen for pickup/delivery.
export function checkFulfilDate(date) {
  if (!isValidDate(date)) return 'Choose a valid date';
  if (date < earliestDate()) return 'Orders need at least a day\'s notice';
  if (date > latestDate()) return `We take orders up to ${MAX_ADVANCE_DAYS} days ahead`;
  return null;
}
