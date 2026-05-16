import type { TriggerContext, TriggerEventType } from '@devvit/public-api';
import { scoreItem, processItem } from '../features/detector.js';
import { DEFAULT_SETTINGS } from '../types.js';

export async function onPostSubmit(event: TriggerEventType['PostSubmit'], context: TriggerContext): Promise<void> {
  const { post, author, subreddit } = event;
  if (!post || !author || !subreddit) return;

  if (post.title.startsWith('⚖️ Council Case') || post.title.startsWith('🛡️ Bastion Dashboard')) return;

  const rawSettings = await context.settings.getAll();
  const settings = { ...DEFAULT_SETTINGS, ...rawSettings };

  const item = {
    type: 'post' as const,
    id: post.id,
    authorName: author.name,
    authorId: author.id,
    title: post.title,
    url: post.url,
    createdAt: Date.now(),
  };

  const signals = await scoreItem(
    {
      authorName: author.name,
      authorId: author.id,
      subredditId: subreddit.id,
      title: post.title,
      url: post.url,
      body: post.selftext,
      createdAt: Date.now(),
    },
    settings,
    context
  );

  await processItem(item, signals, subreddit.id, context);
}
