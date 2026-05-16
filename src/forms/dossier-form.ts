import { Devvit } from '@devvit/public-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const viewDossierForm = Devvit.createForm(
  (data: { [key: string]: any }) => ({
    title: String(data.title ?? 'User Dossier'),
    acceptLabel: 'Close',
    fields: [
      { name: 'level',   label: 'Warning Level', type: 'string'    as const, defaultValue: String(data.level   ?? '') },
      { name: 'account', label: 'Account Age',   type: 'string'    as const, defaultValue: String(data.account ?? '') },
      { name: 'karma',   label: 'Karma',         type: 'string'    as const, defaultValue: String(data.karma   ?? '') },
      { name: 'cases',   label: 'Case History',  type: 'paragraph' as const, defaultValue: String(data.cases   ?? 'No prior cases.') },
      { name: 'notes',   label: 'Mod Notes',     type: 'paragraph' as const, defaultValue: String(data.notes   ?? 'No notes.') },
    ],
  }),
  async () => {}
);
