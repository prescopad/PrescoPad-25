import Constants from 'expo-constants';

// Backend URL: read from Expo config (set via BACKEND_URL env var or app.config.ts)
const configuredUrl = Constants.expoConfig?.extra?.backendUrl as string | undefined;

function resolveBackendUrl(): string {
  // 1. If explicitly configured (production / EAS build), use that
  if (configuredUrl) {
    return configuredUrl;
  }

  // 2. In dev mode, auto-detect LAN IP from Expo debug server
  if (__DEV__) {
    const debuggerHost =
      Constants.expoConfig?.hostUri ??
      (Constants.manifest2 as Record<string, unknown> & { extra?: { expoGo?: { debuggerHost?: string } } })
        ?.extra?.expoGo?.debuggerHost;
    if (typeof debuggerHost === 'string') {
      const host = debuggerHost.split(':')[0];
      return `http://${host}:3000/api`;
    }
  }

  // 3. Fallback – will show a warning; user must set BACKEND_URL
  console.warn('[PrescoPad] No backend URL configured. Set BACKEND_URL env var or update app.config.ts');
  return 'http://localhost:3000/api';
}

export const APP_CONFIG = {
  name: 'PrescoPad',
  tagline: 'Digital Clinic for Modern Doctors',
  version: '2.0.0',

  api: {
    baseUrl: resolveBackendUrl(),
    timeout: 10000,
  },

  wallet: {
    costPerPrescription: 1,
    defaultRechargeAmount: 100,
    lowBalanceThreshold: 10,
    currency: 'INR',
    currencySymbol: '\u20B9',
  },

  polling: {
    queueIntervalMs: 10000,
  },

  prescription: {
    maxMedicines: 20,
    maxLabTests: 15,
    pdfWidth: 595,
    pdfHeight: 842,
  },

  otp: {
    length: 6,
    expiryMinutes: 5,
  },
} as const;
