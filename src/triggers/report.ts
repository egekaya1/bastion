import type { TriggerContext, TriggerEventType } from '@devvit/public-api';

export async function onPostReport(_event: TriggerEventType['PostReport'], _context: TriggerContext): Promise<void> {
  // reserved for future auto-escalation
}

export async function onCommentReport(_event: TriggerEventType['CommentReport'], _context: TriggerContext): Promise<void> {
  // reserved for future auto-escalation
}
