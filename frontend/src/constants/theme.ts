export const COLORS = {
  primary: '#0077B6',
  primaryDark: '#005A8C',
  primaryLight: '#E0F7FA',
  primarySurface: '#F0F9FF',

  white: '#FFFFFF',
  black: '#000000',

  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textLight: '#94A3B8',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#1976D2',
  infoLight: '#E3F2FD',

  disabled: '#F5F5F5',

  whatsapp: '#25D366',
  debit: '#64748B',
  credit: '#16A34A',
} as const;

export const FONTS = {
  regular: {
    fontSize: 14,
    color: COLORS.text,
  },
  medium: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: COLORS.text,
  },
  bold: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  caption: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
