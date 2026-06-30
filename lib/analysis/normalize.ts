// Turn noisy bank descriptions into a stable merchant key and tag need-vs-want.
// e.g. "SQ *BLUE BOTTLE 0421", "AMZN Mktp US*2X4..." → "BLUE BOTTLE", "AMZN MKTP"

const PROCESSOR_PREFIXES =
  /\b(SQ|TST|PY|POS|PP|PAYPAL|SP|IC|CKE|DD|VEN|GUSTO|INTUIT|WEB|ACH|PMT|PURCHASE|RECURRING)\b/g;

export function normalizeMerchant(raw: string | null | undefined): string {
  let s = (raw || '').toUpperCase();
  s = s.replace(/[*#]/g, ' ');
  s = s.replace(PROCESSOR_PREFIXES, ' ');
  s = s.replace(/\bHTTPS?\b/g, ' ');
  s = s.replace(/\bWWW\b/g, ' ');
  s = s.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' '); // dates
  s = s.replace(/\b\d{2,}\b/g, ' '); // store numbers / long digit runs
  s = s.replace(/\b(LLC|INC|CO|COM|USA|US|CA|NY|TX)\b/g, ' ');
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const key = s.split(' ').filter(Boolean).slice(0, 3).join(' ');
  return key || (raw || '').toUpperCase().trim();
}

// Plaid personal_finance_category.primary values considered non-discretionary.
const NEED_CATEGORIES = new Set([
  'RENT_AND_UTILITIES',
  'LOAN_PAYMENTS',
  'MEDICAL',
  'TRANSPORTATION',
  'BANK_FEES',
  'GOVERNMENT_AND_NON_PROFIT',
  'INSURANCE',
]);

// Categories that are never "spending we can cut" (transfers, income, etc.).
export const NON_SPEND_CATEGORIES = new Set([
  'INCOME',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
]);

export function isDiscretionary(pfcPrimary: string | null | undefined): boolean {
  if (!pfcPrimary) return true;
  if (NON_SPEND_CATEGORIES.has(pfcPrimary)) return false;
  return !NEED_CATEGORIES.has(pfcPrimary);
}

// Display-friendly merchant name from the normalized key.
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
