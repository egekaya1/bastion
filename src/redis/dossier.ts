import type { TriggerContext } from '@devvit/public-api';
import { KEYS } from '../constants.js';
import type { Dossier, DossierNote, DossierCase, WarningLevel } from '../types.js';

function recalcLevel(cases: DossierCase[]): WarningLevel {
  const bad = cases.filter((c) => c.outcome === 'removed' || c.outcome === 'banned').length;
  if (bad === 0) return 0;
  if (bad === 1) return 1;
  if (bad === 2) return 2;
  return 3;
}

export async function getDossier(
  subredditId: string,
  userId: string,
  context: TriggerContext
): Promise<Dossier | null> {
  const raw = await context.redis.get(KEYS.dossier(subredditId, userId));
  if (!raw) return null;
  return JSON.parse(raw) as Dossier;
}

export async function getOrCreateDossier(
  subredditId: string,
  userId: string,
  username: string,
  context: TriggerContext
): Promise<Dossier> {
  const existing = await getDossier(subredditId, userId, context);
  if (existing) return existing;
  const dossier: Dossier = {
    userId,
    username,
    warningLevel: 0,
    cases: [],
    notes: [],
    lastUpdated: Date.now(),
  };
  await saveDossier(subredditId, dossier, context);
  return dossier;
}

export async function saveDossier(
  subredditId: string,
  dossier: Dossier,
  context: TriggerContext
): Promise<void> {
  dossier.lastUpdated = Date.now();
  await context.redis.set(KEYS.dossier(subredditId, dossier.userId), JSON.stringify(dossier));
}

export async function addNoteToDossier(
  subredditId: string,
  userId: string,
  username: string,
  note: DossierNote,
  context: TriggerContext
): Promise<void> {
  const dossier = await getOrCreateDossier(subredditId, userId, username, context);
  dossier.notes.unshift(note);
  if (dossier.notes.length > 20) dossier.notes = dossier.notes.slice(0, 20);
  await saveDossier(subredditId, dossier, context);
}

export async function recordCaseOutcome(
  subredditId: string,
  userId: string,
  username: string,
  caseEntry: DossierCase,
  context: TriggerContext
): Promise<void> {
  const dossier = await getOrCreateDossier(subredditId, userId, username, context);
  dossier.cases.unshift(caseEntry);
  if (dossier.cases.length > 50) dossier.cases = dossier.cases.slice(0, 50);
  dossier.warningLevel = recalcLevel(dossier.cases);
  await saveDossier(subredditId, dossier, context);
}
