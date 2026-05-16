import { Devvit } from '@devvit/public-api';

import { BastionPost } from './ui/bastion-post.js';

import { councilPostForm } from './forms/council-form.js';
import { nukePostForm, nukeCommentForm } from './forms/nuke-form.js';
import { quickNoteForm } from './forms/note-form.js';
import { tagDomainForm } from './forms/domain-form.js';
import { viewDossierForm } from './forms/dossier-form.js';

import { onPostSubmit } from './triggers/post-submit.js';
import { onCommentSubmit } from './triggers/comment-submit.js';
import { onModAction } from './triggers/mod-action.js';
import { onPostReport, onCommentReport } from './triggers/report.js';

import { expireOldCases } from './redis/cases.js';
import { getPendingWaves, updateWaveStatus } from './redis/waves.js';
import { getDossierWithLiveData } from './features/dossier.js';
import { KEYS } from './constants.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  realtime: true,
});

Devvit.addSettings([
  {
    name: 'quorumCount',
    label: 'Votes needed for council quorum',
    type: 'number',
    defaultValue: 2,
    scope: 'installation',
    helpText: 'How many mods must agree before an action is automatically executed.',
  },
  {
    name: 'expiryHours',
    label: 'Council case expiry (hours)',
    type: 'number',
    defaultValue: 24,
    scope: 'installation',
    helpText: 'Cases with no quorum after this many hours will expire with no action.',
  },
  {
    name: 'waveAccountAgeDays',
    label: 'New account threshold (days)',
    type: 'number',
    defaultValue: 30,
    scope: 'installation',
    helpText: 'Accounts younger than this are flagged as new-account by the wave detector.',
  },
  {
    name: 'waveKarmaThreshold',
    label: 'Low karma threshold',
    type: 'number',
    defaultValue: 100,
    scope: 'installation',
    helpText: 'Accounts with total karma below this are flagged as low-karma.',
  },
  {
    name: 'wavePostsPerHour',
    label: 'High-frequency post threshold',
    type: 'number',
    defaultValue: 3,
    scope: 'installation',
    helpText: 'More than this many posts per hour by the same user triggers high-frequency signal.',
  },
  {
    name: 'notifyModmail',
    label: 'Notify mod team via modmail on new council case',
    type: 'boolean',
    defaultValue: false,
    scope: 'installation',
  },
  {
    name: 'autoEscalateAfter',
    label: 'Auto-recommend ban after N prior removals',
    type: 'number',
    defaultValue: 3,
    scope: 'installation',
    helpText: 'When a user has this many prior removals, the council form pre-selects Escalate.',
  },
]);

Devvit.addCustomPostType({
  name: 'bastion-post',
  description: 'Bastion',
  height: 'tall',
  render: BastionPost,
});


Devvit.addMenuItem({
  label: '🛡️ Open Bastion Dashboard',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const key = KEYS.dashboardPost(context.subredditId);
    const existingId = await context.redis.get(key);
    if (existingId) {
      try {
        const post = await context.reddit.getPostById(existingId);
        await context.redis.set(KEYS.postKind(existingId), 'dashboard');
        context.ui.navigateTo(post);
        return;
      } catch {
        // post deleted, recreate below
      }
    }
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: `🛡️ Bastion Dashboard | r/${subreddit.name}`,
      subredditName: subreddit.name,
      preview: Devvit.createElement(
        'vstack',
        { padding: 'medium', alignment: 'center middle', gap: 'small' },
        Devvit.createElement('text', { size: 'large', weight: 'bold', color: '#FF4500' }, '🛡️ Bastion'),
        Devvit.createElement('text', { size: 'small', color: '#818384' }, 'Loading dashboard...')
      ),
    });
    await context.redis.set(key, post.id);
    await context.redis.set(KEYS.postKind(post.id), 'dashboard');
    context.ui.navigateTo(post);
  },
});

Devvit.addMenuItem({
  label: '⚖️ Send to Council',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const kind = await context.redis.get(KEYS.postKind(event.targetId));
    if (kind) { context.ui.showToast('Not available on Bastion posts.'); return; }
    context.ui.showForm(councilPostForm);
  },
});

Devvit.addMenuItem({
  label: '⚖️ Send to Council',
  location: 'comment',
  forUserType: 'moderator',
  onPress: (_event, context) => { context.ui.showForm(councilPostForm); },
});

Devvit.addMenuItem({
  label: '👤 View User Dossier',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const kind = await context.redis.get(KEYS.postKind(event.targetId));
      if (kind) { context.ui.showToast('Not available on Bastion posts.'); return; }
      const post = await context.reddit.getPostById(event.targetId);
      const authorName = post.authorName ?? '';
      const authorId = post.authorId ?? '';
      if (!authorName) { context.ui.showToast('Author not found.'); return; }
      const { dossier, live } = await getDossierWithLiveData(context.subredditId, authorId, authorName, context);
      const levelLabels = ['✓ Clean', '⚠ Watch', '🟠 Warned', '🔴 Escalated'];
      context.ui.showForm(viewDossierForm, {
        title: `👤 u/${dossier.username}`,
        level: levelLabels[dossier.warningLevel] ?? '',
        account: `${live.accountAgeDays} days old${live.isSuspended ? '  •  SUSPENDED' : ''}`,
        karma: `${live.totalKarma.toLocaleString()} total  (link: ${live.linkKarma.toLocaleString()}, comment: ${live.commentKarma.toLocaleString()})`,
        cases: dossier.cases.length === 0
          ? 'No prior cases.'
          : dossier.cases.map((c) => `${c.outcome.toUpperCase()}  ${c.reason}  (${new Date(c.at).toLocaleDateString()})`).join('\n'),
        notes: dossier.notes.length === 0
          ? 'No notes.'
          : dossier.notes.map((n) => `"${n.text}"  — u/${n.addedBy}`).join('\n'),
      });
    } catch {
      context.ui.showToast('Could not load dossier.');
    }
  },
});

Devvit.addMenuItem({
  label: '👤 View User Dossier',
  location: 'comment',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const comment = await context.reddit.getCommentById(event.targetId);
      const authorName = comment.authorName ?? '';
      const authorId = comment.authorId ?? '';
      if (!authorName) { context.ui.showToast('Author not found.'); return; }
      const { dossier, live } = await getDossierWithLiveData(context.subredditId, authorId, authorName, context);
      const levelLabels = ['✓ Clean', '⚠ Watch', '🟠 Warned', '🔴 Escalated'];
      context.ui.showForm(viewDossierForm, {
        title: `👤 u/${dossier.username}`,
        level: levelLabels[dossier.warningLevel] ?? '',
        account: `${live.accountAgeDays} days old${live.isSuspended ? '  •  SUSPENDED' : ''}`,
        karma: `${live.totalKarma.toLocaleString()} total  (link: ${live.linkKarma.toLocaleString()}, comment: ${live.commentKarma.toLocaleString()})`,
        cases: dossier.cases.length === 0
          ? 'No prior cases.'
          : dossier.cases.map((c) => `${c.outcome.toUpperCase()}  ${c.reason}  (${new Date(c.at).toLocaleDateString()})`).join('\n'),
        notes: dossier.notes.length === 0
          ? 'No notes.'
          : dossier.notes.map((n) => `"${n.text}"  — u/${n.addedBy}`).join('\n'),
      });
    } catch {
      context.ui.showToast('Could not load dossier.');
    }
  },
});

Devvit.addMenuItem({
  label: '📝 Add Mod Note',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const kind = await context.redis.get(KEYS.postKind(event.targetId));
      if (kind) { context.ui.showToast('Not available on Bastion posts.'); return; }
      const post = await context.reddit.getPostById(event.targetId);
      context.ui.showForm(quickNoteForm, { username: post.authorName ?? '' });
    } catch {
      context.ui.showForm(quickNoteForm, {});
    }
  },
});

Devvit.addMenuItem({
  label: '📝 Add Mod Note',
  location: 'comment',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const comment = await context.reddit.getCommentById(event.targetId);
      context.ui.showForm(quickNoteForm, { username: comment.authorName ?? '' });
    } catch {
      context.ui.showForm(quickNoteForm, {});
    }
  },
});

Devvit.addMenuItem({
  label: '🗑️ Nuke Thread Comments',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const kind = await context.redis.get(KEYS.postKind(event.targetId));
    if (kind) { context.ui.showToast('Not available on Bastion posts.'); return; }
    context.ui.showForm(nukePostForm);
  },
});

Devvit.addMenuItem({
  label: '🗑️ Nuke Comment Replies',
  location: 'comment',
  forUserType: 'moderator',
  onPress: (_event, context) => { context.ui.showForm(nukeCommentForm); },
});

Devvit.addMenuItem({
  label: '🌐 Tag this Domain',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const kind = await context.redis.get(KEYS.postKind(event.targetId));
    if (kind) { context.ui.showToast('Not available on Bastion posts.'); return; }
    context.ui.showForm(tagDomainForm);
  },
});

Devvit.addTrigger({ event: 'PostSubmit',    onEvent: onPostSubmit });
Devvit.addTrigger({ event: 'CommentSubmit', onEvent: onCommentSubmit });
Devvit.addTrigger({ event: 'ModAction',     onEvent: onModAction });
Devvit.addTrigger({ event: 'PostReport',    onEvent: onPostReport });
Devvit.addTrigger({ event: 'CommentReport', onEvent: onCommentReport });

Devvit.addSchedulerJob({
  name: 'expire-cases',
  onRun: async (_event, context) => {
    const settings = await context.settings.getAll();
    const expiryHours = Number(settings.expiryHours ?? 24);
    const expired = await expireOldCases(context.subredditId, expiryHours * 60 * 60 * 1000, context);
    if (expired > 0) console.log(`[Bastion] Expired ${expired} cases`);
  },
});

Devvit.addSchedulerJob({
  name: 'cleanup-waves',
  onRun: async (_event, context) => {
    const waves = await getPendingWaves(context.subredditId, context);
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const wave of waves) {
      if (wave.createdAt < cutoff) {
        await updateWaveStatus(context.subredditId, wave.id, 'dismissed', 'Bastion', context);
      }
    }
  },
});

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_event, context) => {
    await context.scheduler.runJob({ name: 'expire-cases',  cron: '0 * * * *'   });
    await context.scheduler.runJob({ name: 'cleanup-waves', cron: '0 */6 * * *' });
    console.log('[Bastion] Installed.');
  },
});

export default Devvit;
