export type Signal = 'new-account' | 'low-karma' | 'high-frequency' | 'similar-content' | 'known-domain';

export type WaveStatus = 'pending' | 'actioned' | 'dismissed';
export type CaseStatus = 'open' | 'resolved' | 'expired';
export type VoteChoice = 'remove' | 'approve' | 'escalate';
export type WarningLevel = 0 | 1 | 2 | 3;
export type TagColor = 'red' | 'orange' | 'green';
export type DashboardTab = 'waves' | 'cases' | 'stats' | 'domains';

export interface WaveItem {
  type: 'post' | 'comment';
  id: string;
  authorName: string;
  authorId: string;
  title: string;
  createdAt: number;
}

export interface Wave {
  id: string;
  subredditId: string;
  items: WaveItem[];
  signals: Signal[];
  status: WaveStatus;
  createdAt: number;
  actionedBy?: string;
  actionedAt?: number;
}

export interface Vote {
  modId: string;
  modName: string;
  vote: VoteChoice;
  reason?: string;
  at: number;
}

export interface Case {
  id: string;
  subredditId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  targetAuthor: string;
  targetAuthorId: string;
  contentSnapshot: string;
  referredBy: string;
  referredById: string;
  reason: string;
  note?: string;
  status: CaseStatus;
  votes: Vote[];
  decision?: 'removed' | 'approved' | 'banned' | 'expired';
  councilPostId: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface DossierNote {
  text: string;
  addedBy: string;
  at: number;
}

export interface DossierCase {
  caseId: string;
  outcome: string;
  reason: string;
  at: number;
}

export interface Dossier {
  userId: string;
  username: string;
  warningLevel: WarningLevel;
  cases: DossierCase[];
  notes: DossierNote[];
  lastUpdated: number;
}

export interface DomainTag {
  label: string;
  color: TagColor;
  addedBy: string;
  addedAt: number;
}

export interface ModlogEntry {
  removes: number;
  approves: number;
  bans: number;
  nukes: number;
}

export interface BastionSettings {
  quorumCount: number;
  expiryHours: number;
  waveAccountAgeDays: number;
  waveKarmaThreshold: number;
  wavePostsPerHour: number;
  notifyModmail: boolean;
  autoEscalateAfter: number;
}

export const DEFAULT_SETTINGS: BastionSettings = {
  quorumCount: 2,
  expiryHours: 24,
  waveAccountAgeDays: 30,
  waveKarmaThreshold: 100,
  wavePostsPerHour: 3,
  notifyModmail: false,
  autoEscalateAfter: 3,
};
