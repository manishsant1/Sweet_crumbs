import { CURRENCY } from '../../shared/config';

export const formatPrice = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY }).format(n);

// "YYYY-MM-DD" -> "Saturday, October 24". Parsed as UTC and formatted as UTC so the viewer's
// own timezone can never shift the day.
export function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(date + 'T00:00:00Z'));
}
