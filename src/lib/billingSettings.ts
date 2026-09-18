export interface BillingSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  defaultNotes: string;
  defaultFooterNote: string;
}

const STORAGE_KEY = 'fc_billing_settings_v1';

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  companyName: 'Freelancecomm',
  companyEmail: '', // Removed billing@freelancecomm.site
  companyPhone: '',
  companyAddress: '',
  defaultCurrency: 'USD',
  defaultPaymentTerms: 'Payment due within 14 days of invoice date.',
  defaultNotes: 'Thank you for your business. Please remit payment by the due date.',
  defaultFooterNote: 'Thank you for choosing Freelancecomm.'
};

export function getBillingSettings(): BillingSettings {
  if (typeof window === 'undefined') return DEFAULT_BILLING_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BILLING_SETTINGS;
    const parsed = JSON.parse(raw);
    // Sanitize: ensure no obsolete billing@freelancecomm.site is persisted
    if (parsed.companyEmail === 'billing@freelancecomm.site') {
      parsed.companyEmail = '';
    }
    return { ...DEFAULT_BILLING_SETTINGS, ...parsed };
  } catch (e) {
    console.warn('Failed to parse billing settings from localStorage:', e);
    return DEFAULT_BILLING_SETTINGS;
  }
}

export function saveBillingSettings(settings: Partial<BillingSettings>): BillingSettings {
  const current = getBillingSettings();
  const updated: BillingSettings = {
    ...current,
    ...settings
  };
  // Sanitize
  if (updated.companyEmail === 'billing@freelancecomm.site') {
    updated.companyEmail = '';
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save billing settings to localStorage:', e);
    }
  }
  return updated;
}
