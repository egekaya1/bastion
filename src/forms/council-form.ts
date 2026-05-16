import { Devvit } from '@devvit/public-api';
import { REASON_OPTIONS } from '../constants.js';
import { createCouncilCase, castVote } from '../features/council.js';
import { DEFAULT_SETTINGS } from '../types.js';
import type { VoteChoice } from '../types.js';

export const councilPostForm = Devvit.createForm(
  () => ({
    title: '⚖️ Send to Council',
    acceptLabel: 'Send to Council',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'reason',
        label: 'Reason for referral',
        type: 'select',
        options: REASON_OPTIONS,
        required: true,
      },
      {
        name: 'note',
        label: 'Additional context (optional)',
        type: 'paragraph',
        required: false,
        helpText: 'Provide any extra context for your fellow mods.',
      },
      {
        name: 'recommendation',
        label: 'Your initial recommendation',
        type: 'select',
        options: [
          { label: '🔴 Remove', value: 'remove' },
          { label: '🟢 Approve', value: 'approve' },
          { label: '⚡ Escalate (Remove + Ban)', value: 'escalate' },
        ],
        required: true,
      },
    ],
  }),
  async ({ values }, context) => {
    const { postId, commentId, userId, username, subredditId } = context;
    const targetId = commentId ?? postId;
    if (!targetId || !userId || !username) {
      context.ui.showToast('❌ Could not identify target content.');
      return;
    }

    const targetType: 'post' | 'comment' = commentId ? 'comment' : 'post';

    // Fetch content snapshot
    let snapshot = '';
    let authorName = '';
    let authorId = '';
    try {
      if (targetType === 'post') {
        const post = await context.reddit.getPostById(targetId);
        snapshot = post.title.slice(0, 200);
        authorName = post.authorName ?? '';
        authorId = post.authorId ?? '';
      } else {
        const comment = await context.reddit.getCommentById(targetId);
        snapshot = comment.body.slice(0, 200);
        authorName = comment.authorName ?? '';
        authorId = comment.authorId ?? '';
      }
    } catch {
      context.ui.showToast('❌ Could not fetch content. It may have been deleted.');
      return;
    }

    if (!authorName) {
      context.ui.showToast('❌ Could not identify content author.');
      return;
    }

    // Load settings
    const rawSettings = await context.settings.getAll();
    const settings = { ...DEFAULT_SETTINGS, ...rawSettings };

    context.ui.showToast('Creating council case...');

    try {
      const c = await createCouncilCase(
        {
          subredditId,
          targetType,
          targetId,
          targetAuthor: authorName,
          targetAuthorId: authorId,
          contentSnapshot: snapshot,
          referredBy: username,
          referredById: userId,
          reason: String(values.reason ?? 'other'),
          note: values.note ? String(values.note) : undefined,
        },
        settings,
        context
      );

      // Count the referring mod's recommendation as their first vote.
      const initialVote = String(values.recommendation ?? 'remove') as VoteChoice;
      await castVote(
        subredditId,
        c.id,
        { modId: userId, modName: username, vote: initialVote, at: Date.now() },
        settings,
        context
      );

      context.ui.showToast('✅ Council case created. Your recommendation has been recorded.');
    } catch (e) {
      console.error('council form error:', e);
      context.ui.showToast('❌ Failed to create council case. Please try again.');
    }
  }
);

