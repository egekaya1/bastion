import type { TriggerContext, Comment } from '@devvit/public-api';
import { recordModAction } from '../redis/modlog.js';

export interface NukeOptions {
  remove: boolean;
  lock: boolean;
  isSpam: boolean;
}

export interface NukeResult {
  count: number;
  errors: number;
}

async function applyToComment(comment: Comment, options: NukeOptions): Promise<boolean> {
  try {
    if (options.remove) await comment.remove(options.isSpam);
    if (options.lock) await comment.lock();
    return true;
  } catch {
    return false;
  }
}

export async function nukeThread(
  postId: string,
  options: NukeOptions,
  context: TriggerContext
): Promise<NukeResult> {
  let count = 0;
  let errors = 0;

  try {
    const comments = context.reddit.getComments({ postId, limit: 500, pageSize: 100 });

    for await (const comment of comments) {
      if (await applyToComment(comment, options)) count++;
      else errors++;
    }

    if (options.lock) {
      try {
        const post = await context.reddit.getPostById(postId);
        await post.lock();
      } catch {
        // best-effort post lock
      }
    }

    await recordModAction(context.subredditId, context.appSlug ?? 'Bastion', 'nukes', context);
  } catch (e) {
    console.error('nukeThread error:', e);
  }

  return { count, errors };
}

export async function nukeCommentThread(
  commentId: string,
  options: NukeOptions,
  context: TriggerContext
): Promise<NukeResult> {
  let count = 0;
  let errors = 0;

  try {
    const comment = await context.reddit.getCommentById(commentId);
    const postId = comment.postId;

    if (await applyToComment(comment, options)) count++;
    else errors++;

    const allComments = context.reddit.getComments({ postId, limit: 500, pageSize: 100 });

    for await (const c of allComments) {
      if (c.parentId !== `t1_${commentId}` || c.body === '[removed]') continue;
      if (await applyToComment(c, options)) count++;
      else errors++;
    }
  } catch (e) {
    console.error('nukeCommentThread error:', e);
  }

  return { count, errors };
}
