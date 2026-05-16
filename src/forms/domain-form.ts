import { Devvit } from '@devvit/public-api';
import { saveDomain, extractDomain } from '../redis/domains.js';
import { TAG_COLOR_LABELS } from '../constants.js';
import type { TagColor } from '../types.js';

export const tagDomainForm = Devvit.createForm(
  () => ({
    title: '🌐 Tag Domain',
    acceptLabel: 'Save Tag',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'domain',
        label: 'Domain',
        type: 'string',
        required: true,
        placeholder: 'example.com',
        helpText: 'Just the domain, e.g. spamsite.com',
      },
      {
        name: 'label',
        label: 'Label',
        type: 'string',
        required: true,
        placeholder: 'e.g. Known spam source',
      },
      {
        name: 'color',
        label: 'Tag color',
        type: 'select',
        required: true,
        options: Object.entries(TAG_COLOR_LABELS).map(([value, label]) => ({ value, label })),
      },
    ],
  }),
  async ({ values }, context) => {
    const rawDomain = String(values.domain ?? '').trim();
    const label = String(values.label ?? '').trim();
    const color = String(values.color ?? 'red') as TagColor;

    // Normalize domain (strip protocol if pasted with it)
    const domain = extractDomain(rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`);
    if (!domain) {
      context.ui.showToast('❌ Invalid domain format.');
      return;
    }

    await saveDomain(
      context.subredditId,
      domain,
      { label, color, addedBy: context.username ?? 'unknown', addedAt: Date.now() },
      context
    );
    context.ui.showToast(`✅ Tagged ${domain} as ${color}.`);
  }
);

