import { Devvit } from '@devvit/public-api';
import { COLORS } from '../../constants.js';
import { WarningBadge } from './badge.js';
import type { Dossier } from '../../types.js';
import type { LiveUserData } from '../../features/dossier.js';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface DossierPanelProps {
  dossier: Dossier;
  live: LiveUserData;
  compact?: boolean;
}

export function DossierPanel({ dossier, live, compact = false }: Readonly<DossierPanelProps>): JSX.Element {
  const recentCases = dossier.cases.slice(0, compact ? 2 : 5);
  const recentNotes = dossier.notes.slice(0, compact ? 1 : 3);

  return (
    <vstack
      backgroundColor={COLORS.card}
      cornerRadius="medium"
      padding="medium"
      border="thin"
      borderColor={COLORS.border}
      gap="small"
      minWidth="180px"
    >
      <vstack gap="small">
        <text size="medium" weight="bold" color={COLORS.textPrimary}>
          👤 u/{dossier.username}
        </text>
        <WarningBadge level={dossier.warningLevel} />
      </vstack>

      <vstack gap="small">
        <text size="xsmall" color={COLORS.textMuted} weight="bold">
          ACCOUNT
        </text>
        {live.isSuspended ? (
          <text size="xsmall" color={COLORS.danger}>⛔ Suspended</text>
        ) : (
          <vstack gap="small">
            <text size="xsmall" color={COLORS.textPrimary}>
              Age: {live.accountAgeDays}d  ·  Karma: {live.totalKarma.toLocaleString()}
            </text>
            <text size="xsmall" color={COLORS.textMuted}>
              Link: {live.linkKarma}  ·  Comment: {live.commentKarma}
            </text>
          </vstack>
        )}
      </vstack>

      {dossier.cases.length > 0 ? (
        <vstack gap="small">
          <text size="xsmall" color={COLORS.textMuted} weight="bold">
            CASE HISTORY ({dossier.cases.length})
          </text>
          {recentCases.map((c) => (
            <hstack key={c.caseId} gap="small" alignment="middle">
              <text
                size="xsmall"
                color={c.outcome === 'removed' || c.outcome === 'banned' ? COLORS.danger : COLORS.success}
              >
                {c.outcome === 'removed' || c.outcome === 'banned' ? '✗' : '✓'}
              </text>
              <text size="xsmall" color={COLORS.textPrimary} overflow="ellipsis">
                {c.outcome.charAt(0).toUpperCase() + c.outcome.slice(1)} · {c.reason}
              </text>
              <spacer grow />
              <text size="xsmall" color={COLORS.textDim}>
                {timeAgo(c.at)}
              </text>
            </hstack>
          ))}
          {dossier.cases.length > recentCases.length ? (
            <text size="xsmall" color={COLORS.textDim}>
              +{dossier.cases.length - recentCases.length} more
            </text>
          ) : null}
        </vstack>
      ) : (
        <text size="xsmall" color={COLORS.textMuted}>No case history</text>
      )}

      {!compact && recentNotes.length > 0 ? (
        <vstack gap="small">
          <text size="xsmall" color={COLORS.textMuted} weight="bold">
            MOD NOTES ({dossier.notes.length})
          </text>
          {recentNotes.map((n) => (
            <vstack key={String(n.at)} gap="small">
              <text size="xsmall" color={COLORS.textPrimary} overflow="ellipsis">
                "{n.text.slice(0, 80)}"
              </text>
              <text size="xsmall" color={COLORS.textDim}>
                u/{n.addedBy}  ·  {timeAgo(n.at)}
              </text>
            </vstack>
          ))}
        </vstack>
      ) : null}
    </vstack>
  );
}
