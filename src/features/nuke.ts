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

type CommentEntry = { id: string; parentId: string; comment: Comment };

async function fetchCommentEntries(postId: string, excludeId: string, context: TriggerContext): Promise<CommentEntry[]> {
  const entries: CommentEntry[] = [];
  const iter = context.reddit.getComments({ postId, limit: 500, pageSize: 100 });
  for await (const c of iter) {
    if (c.id !== excludeId) entries.push({ id: c.id, parentId: c.parentId, comment: c });
  }
  return entries;
}

function buildSubtree(rootId: string, entries: Pick<CommentEntry, 'id' | 'parentId'>[]): Set<string> {
  const subtree = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const { id, parentId } of entries) {
      if (!subtree.has(id) && subtree.has(parentId.replace(/^t1_/, ''))) {
        subtree.add(id);
        grew = true;
      }
    }
  }
  subtree.delete(rootId);
  return subtree;
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
    const rootComment = await context.reddit.getCommentById(commentId);
    if (await applyToComment(rootComment, options)) count++;
    else errors++;

    const allComments = await fetchCommentEntries(rootComment.postId, commentId, context);
    const subtree = buildSubtree(commentId, allComments);

    for (const { id, comment } of allComments) {
      if (!subtree.has(id)) continue;
      if (await applyToComment(comment, options)) count++;
      else errors++;
    }
  } catch (e) {
    console.error('nukeCommentThread error:', e);
  }

  return { count, errors };
}
