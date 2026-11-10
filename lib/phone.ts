const RUSSIAN_PHONE_DIGITS = 10;

function nationalDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutCountryCode =
    digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;

  return withoutCountryCode.slice(0, RUSSIAN_PHONE_DIGITS);
}

export function formatRussianPhone(value: string) {
  const digits = nationalDigits(value);
  if (!digits) return "";

  let formatted = `+7 (${digits.slice(0, 3)}`;
  if (digits.length < 3) return formatted;

  formatted += `) ${digits.slice(3, 6)}`;
  if (digits.length <= 6) return formatted;

  formatted += `-${digits.slice(6, 8)}`;
  if (digits.length <= 8) return formatted;

  return `${formatted}-${digits.slice(8, 10)}`;
}

export function isCompleteRussianPhone(value: string) {
  return nationalDigits(value).length === RUSSIAN_PHONE_DIGITS;
}
