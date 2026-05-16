import type { TriggerContext } from '@devvit/public-api';
import { KEYS } from '../constants.js';
import type { Case, CaseStatus, Vote } from '../types.js';

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getCase(
  subredditId: string,
  caseId: string,
  context: TriggerContext
): Promise<Case | null> {
  const raw = await context.redis.get(KEYS.case(subredditId, caseId));
  if (!raw) return null;
  return JSON.parse(raw) as Case;
}

export async function saveCase(c: Case, context: TriggerContext): Promise<void> {
  await context.redis.set(KEYS.case(c.subredditId, c.id), JSON.stringify(c));
}

export async function getOpenCases(subredditId: string, context: TriggerContext): Promise<Case[]> {
  const raw = await context.redis.get(KEYS.casesOpen(subredditId));
  if (!raw) return [];
  const ids = JSON.parse(raw) as string[];
  const cases = await Promise.all(ids.map((id) => getCase(subredditId, id, context)));
  return cases.filter((c): c is Case => c !== null && c.status === 'open');
}

async function setOpenIndex(
  subredditId: string,
  ids: string[],
  context: TriggerContext
): Promise<void> {
  await context.redis.set(KEYS.casesOpen(subredditId), JSON.stringify(ids));
}

export async function createCase(
  params: {
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
    councilPostId: string;
  },
  context: TriggerContext
): Promise<Case> {
  const c: Case = {
    ...params,
    id: newId(),
    status: 'open',
    votes: [],
    createdAt: Date.now(),
  };
  await saveCase(c, context);
  // Reverse index: post ID → case ID for fast lookup in council post renderer
  await context.redis.set(`postcase:${params.subredditId}:${params.councilPostId}`, c.id);
  const raw = await context.redis.get(KEYS.casesOpen(params.subredditId));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  ids.push(c.id);
  await setOpenIndex(params.subredditId, ids, context);
  return c;
}

export async function getCaseByPostId(
  subredditId: string,
  postId: string,
  context: TriggerContext
): Promise<Case | null> {
  const caseId = await context.redis.get(`postcase:${subredditId}:${postId}`);
  if (!caseId) return null;
  return getCase(subredditId, caseId, context);
}

export async function addVoteToCase(
  subredditId: string,
  caseId: string,
  vote: Vote,
  context: TriggerContext
): Promise<Case | null> {
  const c = await getCase(subredditId, caseId, context);
  if (!c || c.status !== 'open') return null;
  const alreadyVoted = c.votes.some((v) => v.modId === vote.modId);
  if (alreadyVoted) return c;
  c.votes.push(vote);
  await saveCase(c, context);
  return c;
}

export async function resolveCase(
  subredditId: string,
  caseId: string,
  decision: Case['decision'],
  context: TriggerContext
): Promise<void> {
  const c = await getCase(subredditId, caseId, context);
  if (!c) return;
  c.status = 'resolved';
  c.decision = decision;
  c.resolvedAt = Date.now();
  await saveCase(c, context);
  const raw = await context.redis.get(KEYS.casesOpen(subredditId));
  if (raw) {
    const ids = (JSON.parse(raw) as string[]).filter((id) => id !== caseId);
    await setOpenIndex(subredditId, ids, context);
  }
}

export async function expireOldCases(
  subredditId: string,
  expiryMs: number,
  context: TriggerContext
): Promise<number> {
  const cases = await getOpenCases(subredditId, context);
  const now = Date.now();
  let count = 0;
  for (const c of cases) {
    if (now - c.createdAt > expiryMs) {
      await resolveCase(subredditId, c.id, 'expired', context);
      count++;
    }
  }
  return count;
}
