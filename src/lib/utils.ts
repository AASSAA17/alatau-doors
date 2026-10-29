import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatPrice(value: number, locale = 'ru') {
  // Browsers without Kazakh ICU data may fall back to comma grouping. Keep KZT
  // display identical during SSR and hydration; domain amounts are integer tenge.
  return new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {numberingSystem:'latn', maximumFractionDigits:0})
    .formatToParts(value).map(part=>part.type==='group'?'\u00a0':part.value).join('') + ' ₸';
}
export function formatDate(value: string, locale = 'ru', withTime = false) {
  const parts = new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
    calendar:'gregory', numberingSystem:'latn', timeZone:'Asia/Qyzylorda',
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:withTime?'2-digit':undefined, minute:withTime?'2-digit':undefined, hourCycle:'h23',
  }).formatToParts(new Date(value));
  const fields=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${fields.day}.${fields.month}.${fields.year}${withTime?` · ${fields.hour}:${fields.minute}`:''}`;
}
