export const COLORS = {
  bg: '#1A1A1B',
  card: '#272729',
  cardHover: '#313233',
  border: '#343536',
  divider: '#343536',
  textPrimary: '#D7DADC',
  textMuted: '#818384',
  textDim: '#5c5c5f',
  orange: '#FF4500',
  orangeLight: '#FF6534',
  success: '#46D160',
  successDim: '#2d8a3e',
  warning: '#FFD635',
  caution: '#FF8717',
  danger: '#FF585B',
  dangerDim: '#cc3337',
  blue: '#0DD3BB',
  blueDim: '#0a9e8d',
  white: '#FFFFFF',
} as const;

export const WARNING_COLORS: Record<number, string> = {
  0: COLORS.success,
  1: COLORS.warning,
  2: COLORS.caution,
  3: COLORS.danger,
};

export const WARNING_LABELS: Record<number, string> = {
  0: 'Clean',
  1: 'Watch',
  2: 'Warned',
  3: 'Escalated',
};

export const WARNING_ICONS: Record<number, string> = {
  0: '✓',
  1: '⚠',
  2: '🟠',
  3: '🔴',
};

export const SIGNAL_LABELS: Record<string, string> = {
  'new-account': 'New account',
  'low-karma': 'Low karma',
  'high-frequency': 'High frequency',
  'similar-content': 'Similar content',
  'known-domain': 'Known spam domain',
};

export const REASON_OPTIONS = [
  { label: 'Harassment / Abuse', value: 'harassment' },
  { label: 'Spam / Promotion', value: 'spam' },
  { label: 'Rule Violation', value: 'rule-violation' },
  { label: 'Misinformation', value: 'misinformation' },
  { label: 'Borderline / Not Sure', value: 'borderline' },
  { label: 'Other', value: 'other' },
];

export const TAG_COLOR_LABELS: Record<string, string> = {
  red: '🔴 Red: Spam/Banned',
  orange: '🟠 Orange: Caution',
  green: '🟢 Green: Approved',
};

// Redis key prefixes
export const KEYS = {
  wave: (subredditId: string, waveId: string) => `wave:${subredditId}:${waveId}`,
  wavesPending: (subredditId: string) => `waves:pending:${subredditId}`,
  case: (subredditId: string, caseId: string) => `case:${subredditId}:${caseId}`,
  casesOpen: (subredditId: string) => `cases:open:${subredditId}`,
  dossier: (subredditId: string, userId: string) => `dossier:${subredditId}:${userId}`,
  domains: (subredditId: string) => `domains:${subredditId}`,
  modlog: (subredditId: string, date: string) => `modlog:${subredditId}:${date}`,
  freqCounter: (subredditId: string, authorId: string, hour: string) =>
    `freq:${subredditId}:${authorId}:${hour}`,
  contentHash: (subredditId: string, hash: string) => `hash:${subredditId}:${hash}`,
  dashboardPost: (subredditId: string) => `dashboard:${subredditId}`,
  postKind: (postId: string) => `postkind:${postId}`,
} as const;

export const WAVE_CONFIRM_THRESHOLD = 3; // items needed to confirm a wave
export const WAVE_GROUPING_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
export const CONTENT_HASH_TTL_SECS = 86400; // 24 hours
export const FREQ_COUNTER_TTL_SECS = 3600; // 1 hour

export const APP_VERSION = '0.0.1';
export const APP_NAME = 'Bastion';
