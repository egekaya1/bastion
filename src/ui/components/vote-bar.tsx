import { Devvit } from '@devvit/public-api';
import { COLORS } from '../../constants.js';
import type { Vote } from '../../types.js';

interface VoteBarProps {
  votes: Vote[];
  quorumCount: number;
  currentUserId?: string;
}

export function VoteBar({ votes, quorumCount, currentUserId }: VoteBarProps): JSX.Element {
  const currentUserVoted = currentUserId ? votes.some((v) => v.modId === currentUserId) : false;
  const total = votes.length;
  const filledBlocks = Math.min(total, quorumCount);
  const emptyBlocks = Math.max(quorumCount - filledBlocks, 0);
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    <vstack gap="small">
      <hstack gap="small" alignment="middle">
        <text size="small" weight="bold" color={COLORS.textMuted}>
          VOTES
        </text>
        <text size="medium" color={total >= quorumCount ? COLORS.success : COLORS.warning}>
          {progressBar}
        </text>
        <text size="small" color={COLORS.textMuted}>
          {total} of {quorumCount} needed
        </text>
      </hstack>

      {currentUserVoted && votes.length > 0 ? (
        <vstack gap="small">
          {votes.map((v, i) => (
            <hstack key={String(i)} gap="small" alignment="middle">
              <text
                size="xsmall"
                color={
                  v.vote === 'remove' || v.vote === 'escalate' ? COLORS.danger : COLORS.success
                }
              >
                {v.vote === 'remove' ? '🔴' : v.vote === 'escalate' ? '⚡' : '🟢'}
              </text>
              <text size="xsmall" color={COLORS.textPrimary} weight="bold">
                u/{v.modName}:
              </text>
              <text size="xsmall" color={COLORS.textPrimary}>
                {v.vote}
              </text>
              {v.reason ? (
                <text size="xsmall" color={COLORS.textMuted} overflow="ellipsis">
                  "{v.reason.slice(0, 60)}"
                </text>
              ) : null}
            </hstack>
          ))}
        </vstack>
      ) : (
        !currentUserVoted && votes.length > 0 ? (
          <text size="xsmall" color={COLORS.textMuted}>
            {votes.length} mod{votes.length === 1 ? '' : 's'} voted. Cast your vote to see results.
          </text>
        ) : null
      )}

      {!currentUserVoted ? (
        <text size="xsmall" color={COLORS.textDim}>
          Vote below to reveal other mods' reasoning
        </text>
      ) : null}
    </vstack>
  );
}
