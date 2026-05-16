import { Devvit } from '@devvit/public-api';
import { nukeThread, nukeCommentThread } from '../features/nuke.js';

export const nukePostForm = Devvit.createForm(
  () => ({
    title: '🗑️ Nuke Thread Comments',
    acceptLabel: 'Nuke',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'remove',
        label: 'Remove all comments',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'lock',
        label: 'Lock post after nuking',
        type: 'boolean',
        defaultValue: false,
      },
      {
        name: 'isSpam',
        label: 'Mark as spam',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  }),
  async ({ values }, context) => {
    if (!values.remove && !values.lock) {
      context.ui.showToast('Select at least one action.');
      return;
    }
    const postId = context.postId;
    if (!postId) {
      context.ui.showToast('❌ No post found.');
      return;
    }
    context.ui.showToast('Nuking thread...');
    const result = await nukeThread(
      postId,
      {
        remove: Boolean(values.remove),
        lock: Boolean(values.lock),
        isSpam: Boolean(values.isSpam),
      },
      context
    );
    const noun = result.count === 1 ? 'comment' : 'comments';
    const skipped = result.errors > 0 ? ` (${result.errors} skipped)` : '';
    context.ui.showToast(`✅ Done. ${result.count} ${noun} processed${skipped}.`);
  }
);

export const nukeCommentForm = Devvit.createForm(
  () => ({
    title: '🗑️ Nuke Comment Replies',
    acceptLabel: 'Nuke Replies',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'remove',
        label: 'Remove this comment and replies',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'isSpam',
        label: 'Mark as spam',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  }),
  async ({ values }, context) => {
    const commentId = context.commentId;
    if (!commentId) {
      context.ui.showToast('❌ No comment found.');
      return;
    }
    context.ui.showToast('Nuking comment thread...');
    const result = await nukeCommentThread(
      commentId,
      {
        remove: Boolean(values.remove),
        lock: false,
        isSpam: Boolean(values.isSpam),
      },
      context
    );
    const itemNoun = result.count === 1 ? 'item' : 'items';
    context.ui.showToast(`✅ Done. ${result.count} ${itemNoun} processed.`);
  }
);
