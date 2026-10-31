// Checkout rules shared by the form (instant feedback) and the API (the real check).
import { checkFulfilDate } from './dates.js';

export const CONTACT_FIELDS = [
  { name: 'fullName', label: 'Full name', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
];

// Only collected for delivery.
export const ADDRESS_FIELDS = [
  { name: 'address', label: 'Street address', autoComplete: 'street-address' },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'zip', label: 'ZIP / Postal code', autoComplete: 'postal-code' },
];

export const FULFILLMENTS = [
  ['pickup', 'Pick up in store'],
  ['delivery', 'Home delivery'],
];

// Demo only: no payment is processed and no card details are collected.
export const PAYMENT_METHODS = [
  ['card', 'Card (demo, not charged)'],
  ['cash', 'Pay on pickup / delivery'],
];

export const NOTE_MAX = 200;

// `form` is the whole checkout: contact fields, fulfillment, date, payment, note and (delivery) address.
export function validateCheckout(input) {
  const form = input ?? {}; // a JSON body can send null, which a default parameter would not catch
  const errors = {};
  const delivery = form.fulfillment === 'delivery';

  if (!FULFILLMENTS.some(([v]) => v === form.fulfillment)) errors.fulfillment = 'Choose pickup or delivery';
  if (!PAYMENT_METHODS.some(([v]) => v === form.payment)) errors.payment = 'Choose a payment method';
  const dateProblem = checkFulfilDate(form.date);
  if (dateProblem) errors.date = dateProblem;

  for (const f of delivery ? [...CONTACT_FIELDS, ...ADDRESS_FIELDS] : CONTACT_FIELDS) {
    const value = form[f.name];
    if (typeof value !== 'string' || !value.trim()) errors[f.name] = 'Required';
    else if (value.length > 200) errors[f.name] = 'Too long';
  }
  if (!errors.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email';
  if (!errors.phone && !/^[\d\s+()-]{7,}$/.test(form.phone)) errors.phone = 'Enter a valid phone number';

  if (form.note != null && (typeof form.note !== 'string' || form.note.length > NOTE_MAX)) {
    errors.note = `Keep it under ${NOTE_MAX} characters`;
  }
  return errors;
}
