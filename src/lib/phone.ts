/** Contact number only: this does not assert ownership or SMS verification. */
export function normalizePhone(value: string): string | null {
  if (value.length > 30 || !/^\+?[\d\s()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (!/^[78]\d{10}$/.test(digits)) return null;
  return '+7' + digits.slice(1);
}
