import { Devvit } from '@devvit/public-api';
import { addNote } from '../features/dossier.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const quickNoteForm = Devvit.createForm(
  (data: { [key: string]: any }) => ({
    title: data.username ? `📝 Note for u/${String(data.username)}` : '📝 Add Mod Note',
    acceptLabel: 'Save',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'targetUsername',
        label: 'Reddit username',
        type: 'string',
        required: true,
        defaultValue: String(data.username ?? ''),
      },
      {
        name: 'note',
        label: 'Note',
        type: 'paragraph',
        required: true,
      },
    ],
  }),
  async ({ values }, context) => {
    const targetUsername = String(values.targetUsername ?? '').replace(/^u\//, '').trim();
    const note = String(values.note ?? '').trim();
    if (!targetUsername || !note) {
      context.ui.showToast('Username and note are required.');
      return;
    }
    try {
      const user = await context.reddit.getUserByUsername(targetUsername);
      if (!user) throw new Error('user not found');
      await addNote(
        context.subredditId,
        user.id,
        user.username,
        note,
        context.username ?? 'unknown',
        context
      );
      context.ui.showToast(`✅ Note added for u/${targetUsername}`);
    } catch {
      context.ui.showToast('❌ User not found.');
    }
  }
);
