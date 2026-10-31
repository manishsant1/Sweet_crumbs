// The app's vocabulary and business rules, in one place. Used by both the browser and the server.
export const LABELS = {
  appName: 'Sweet Crumbs',
  appEmoji: '🥐',
  tagline: 'Baked fresh, ready when you are.',
};

export const CURRENCY = 'USD';
export const TAX_RATE = 0.07;
export const DELIVERY_FEE = 4.99;
export const FREE_DELIVERY_THRESHOLD = 40;

// The bakery's own timezone: "tomorrow" and the cancel cutoff are decided here, not by the
// visitor's or the server's clock.
export const TIMEZONE = 'America/New_York';
export const MIN_LEAD_DAYS = 1;          // everything is baked to order, so earliest pickup is tomorrow
export const MAX_ADVANCE_DAYS = 7;       // furthest day ahead an order may be scheduled
export const MAX_ACTIVE_ORDERS_PER_USER = 10; // upcoming orders; accounts are free, so this limits hoarding stock
export const MAX_QTY_PER_LINE = 24;
