export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', locale: 'ar-SA' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'SGD', symbol: 'SG$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', locale: 'he-IL' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', locale: 'ar-QA' },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', locale: 'ar-BH' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', locale: 'ar-OM' },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound', locale: 'ar-EG' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'sw-KE' },
  { code: 'PKR', symbol: 'PKR', name: 'Pakistani Rupee', locale: 'ur-PK' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', locale: 'es-CL' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', locale: 'es-CO' },
];

export const CURRENCY_MAP = new Map<string, Currency>(
  CURRENCIES.map((c) => [c.code, c])
);

export function getCurrencySymbol(currencyCode = 'USD'): string {
  const match = CURRENCY_MAP.get(currencyCode.toUpperCase());
  return match ? match.symbol : currencyCode;
}

export function formatCurrency(value: number | string | undefined | null, currencyCode = 'USD'): string {
  const num = Number(value || 0);
  const code = (currencyCode || 'USD').toUpperCase();
  const meta = CURRENCY_MAP.get(code);

  try {
    return new Intl.NumberFormat(meta?.locale || 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    const symbol = meta?.symbol || code;
    return `${symbol} ${num.toFixed(2)}`;
  }
}
