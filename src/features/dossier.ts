import type { TriggerContext } from '@devvit/public-api';
import { getOrCreateDossier, addNoteToDossier } from '../redis/dossier.js';
import type { Dossier } from '../types.js';

export interface LiveUserData {
  accountAgeDays: number;
  totalKarma: number;
  linkKarma: number;
  commentKarma: number;
  isSuspended: boolean;
}

export async function getLiveUserData(
  username: string,
  context: TriggerContext
): Promise<LiveUserData> {
  try {
    const user = await context.reddit.getUserByUsername(username);
    if (!user) throw new Error('user not found');
    return {
      accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86400000),
      totalKarma: user.linkKarma + user.commentKarma,
      linkKarma: user.linkKarma,
      commentKarma: user.commentKarma,
      isSuspended: false,
    };
  } catch {
    return { accountAgeDays: 0, totalKarma: 0, linkKarma: 0, commentKarma: 0, isSuspended: true };
  }
}

export async function getDossierWithLiveData(
  subredditId: string,
  userId: string,
  username: string,
  context: TriggerContext
): Promise<{ dossier: Dossier; live: LiveUserData }> {
  const [dossier, live] = await Promise.all([
    getOrCreateDossier(subredditId, userId, username, context),
    getLiveUserData(username, context),
  ]);
  return { dossier, live };
}

export async function addNote(
  subredditId: string,
  userId: string,
  username: string,
  text: string,
  addedBy: string,
  context: TriggerContext
): Promise<void> {
  await addNoteToDossier(subredditId, userId, username, { text, addedBy, at: Date.now() }, context);
}
