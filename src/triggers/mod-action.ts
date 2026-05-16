import type { TriggerContext, TriggerEventType } from '@devvit/public-api';
import { recordModAction } from '../redis/modlog.js';

const ACTION_MAP: Record<string, 'removes' | 'approves' | 'bans' | 'nukes'> = {
  removelink: 'removes',
  removecomment: 'removes',
  spamlink: 'removes',
  spamcomment: 'removes',
  approvelink: 'approves',
  approvecomment: 'approves',
  banuser: 'bans',
};

export async function onModAction(event: TriggerEventType['ModAction'], context: TriggerContext): Promise<void> {
  const { action, moderator, subreddit } = event;
  if (!action || !moderator || !subreddit) return;

  const mapped = ACTION_MAP[action.toLowerCase()];
  if (!mapped) return;

  await recordModAction(subreddit.id, moderator.name, mapped, context);
}
