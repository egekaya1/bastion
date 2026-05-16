import type { TriggerContext, TriggerEventType } from '@devvit/public-api';
import { scoreItem, processItem } from '../features/detector.js';
import { DEFAULT_SETTINGS } from '../types.js';

export async function onCommentSubmit(event: TriggerEventType['CommentSubmit'], context: TriggerContext): Promise<void> {
  const { comment, author, subreddit } = event;
  if (!comment || !author || !subreddit) return;

  const rawSettings = await context.settings.getAll();
  const settings = { ...DEFAULT_SETTINGS, ...rawSettings };

  const item = {
    type: 'comment' as const,
    id: comment.id,
    authorName: author.name,
    authorId: author.id,
    title: comment.body.slice(0, 100),
    createdAt: Date.now(),
  };

  const signals = await scoreItem(
    {
      authorName: author.name,
      authorId: author.id,
      subredditId: subreddit.id,
      title: comment.body.slice(0, 100),
      body: comment.body,
      createdAt: Date.now(),
    },
    settings,
    context
  );

  await processItem(item, signals, subreddit.id, context);
}
