import { Devvit } from '@devvit/public-api';
import type { TriggerContext } from '@devvit/public-api';
import type { Case, Vote, BastionSettings } from '../types.js';
import { createCase as dbCreateCase, addVoteToCase, resolveCase } from '../redis/cases.js';
import { recordCaseOutcome } from '../redis/dossier.js';
import { recordModAction } from '../redis/modlog.js';
import { KEYS } from '../constants.js';

export async function createCouncilCase(
  params: {
    subredditId: string;
    targetType: 'post' | 'comment';
    targetId: string;
    targetAuthor: string;
    targetAuthorId: string;
    contentSnapshot: string;
    referredBy: string;
    referredById: string;
    reason: string;
    note?: string;
  },
  settings: BastionSettings,
  context: TriggerContext
): Promise<Case> {
  // Create a placeholder council post first so we have an ID
  const subreddit = await context.reddit.getCurrentSubreddit();
  const councilPost = await context.reddit.submitPost({
    title: `⚖️ Council Case | ${params.targetType === 'post' ? 'Post' : 'Comment'} by u/${params.targetAuthor} | ${params.reason}`,
    subredditName: subreddit.name,
    preview: Devvit.createElement(
      'vstack',
      { padding: 'medium', alignment: 'center middle' },
      Devvit.createElement('text', { size: 'large', weight: 'bold' }, '⚖️ Loading Council Case...')
    ),
  });

  await context.redis.set(KEYS.postKind(councilPost.id), 'council');

  const c = await dbCreateCase(
    { ...params, councilPostId: councilPost.id },
    context
  );

  if (settings.notifyModmail) {
    try {
      await context.reddit.modMail.createConversation({
        subredditName: subreddit.name,
        subject: `[Bastion] New council case: ${params.reason}`,
        body: `New council case opened by u/${params.referredBy}.\n\nUser: u/${params.targetAuthor}\nReason: ${params.reason}\n\nView case: https://reddit.com${councilPost.permalink}`,
        isAuthorHidden: true,
        to: null,
      });
    } catch {
      // modmail is best-effort
    }
  }

  return c;
}

export async function castVote(
  subredditId: string,
  caseId: string,
  vote: Vote,
  settings: BastionSettings,
  context: TriggerContext
): Promise<{ case: Case | null; quorumReached: boolean; alreadyResolved: boolean }> {
  const updated = await addVoteToCase(subredditId, caseId, vote, context);
  if (!updated) return { case: null, quorumReached: false, alreadyResolved: true };

  const quorumReached = checkQuorum(updated, settings.quorumCount);
  if (quorumReached) {
    await executeDecision(subredditId, caseId, updated, context);
  }

  return { case: updated, quorumReached, alreadyResolved: false };
}

export function checkQuorum(c: Case, quorumCount: number): boolean {
  if (c.votes.length < quorumCount) return false;
  const counts: Record<string, number> = {};
  for (const v of c.votes) {
    counts[v.vote] = (counts[v.vote] ?? 0) + 1;
  }
  return Object.values(counts).some((n) => n >= quorumCount);
}

export function getWinningVote(c: Case): 'remove' | 'approve' | 'escalate' | null {
  const counts: Record<string, number> = {};
  for (const v of c.votes) {
    counts[v.vote] = (counts[v.vote] ?? 0) + 1;
  }
  let winner: string | null = null;
  let max = 0;
  for (const [vote, count] of Object.entries(counts)) {
    if (count > max) { max = count; winner = vote; }
  }
  return winner as 'remove' | 'approve' | 'escalate' | null;
}

async function executeDecision(
  subredditId: string,
  caseId: string,
  c: Case,
  context: TriggerContext
): Promise<void> {
  const decision = getWinningVote(c);
  if (!decision) return;

  const subreddit = await context.reddit.getCurrentSubreddit();
  let outcome: Case['decision'] = 'approved';

  try {
    if (decision === 'remove') {
      await context.reddit.remove(c.targetId, false);
      outcome = 'removed';
      await recordModAction(subredditId, 'Bastion', 'removes', context);
    } else if (decision === 'approve') {
      await context.reddit.approve(c.targetId);
      await recordModAction(subredditId, 'Bastion', 'approves', context);
    } else if (decision === 'escalate') {
      await context.reddit.remove(c.targetId, false);
      try {
        await context.reddit.banUser({
          subredditName: subreddit.name,
          username: c.targetAuthor,
          note: `[Bastion] Escalated via council case. Reason: ${c.reason}`,
          reason: c.reason,
        });
      } catch {
        // ban may fail if already banned
      }
      outcome = 'banned';
      await recordModAction(subredditId, 'Bastion', 'bans', context);
    }
  } catch (e) {
    console.error('executeDecision error:', e);
    outcome = 'approved'; // fallback
  }

  // Write native Reddit mod note
  try {
    const voteStr = c.votes.map((v) => `${v.modName}: ${v.vote}`).join(', ');
    await context.reddit.addModNote({
      subreddit: subreddit.name,
      user: c.targetAuthor,
      note: `[Bastion] ${outcome.toUpperCase()} via council. Reason: ${c.reason}. Votes: ${voteStr}`,
      label: outcome === 'approved' ? 'HELPFUL_USER' : 'ABUSE_WARNING',
      redditId: c.targetId as `t3_${string}` | `t1_${string}`,
    });
  } catch {
    // mod notes are best-effort
  }

  await resolveCase(subredditId, caseId, outcome, context);

  await recordCaseOutcome(
    subredditId,
    c.targetAuthorId,
    c.targetAuthor,
    { caseId, outcome, reason: c.reason, at: Date.now() },
    context
  );
}
