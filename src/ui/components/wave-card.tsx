import { Devvit } from '@devvit/public-api';
import { COLORS } from '../../constants.js';
import { SignalBadge } from './badge.js';
import type { Wave } from '../../types.js';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface WaveCardProps {
  key?: string;
  wave: Wave;
  onNuke: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}

export function WaveCard({ wave, onNuke, onDismiss }: WaveCardProps): JSX.Element {
  const uniqueAuthors = [...new Set(wave.items.map((i) => `u/${i.authorName}`))];
  const displayAuthors =
    uniqueAuthors.length <= 3
      ? uniqueAuthors.join('  ')
      : `${uniqueAuthors.slice(0, 3).join('  ')}  +${uniqueAuthors.length - 3} more`;

  const titlePreview = wave.items[0]?.title ?? '';

  return (
    <vstack
      backgroundColor={COLORS.card}
      cornerRadius="medium"
      padding="medium"
      border="thin"
      borderColor={COLORS.caution}
      gap="small"
    >
      <hstack alignment="middle" gap="small">
        <text size="small" weight="bold" color={COLORS.danger}>
          🚨 WAVE
        </text>
        <text size="small" color={COLORS.textMuted}>
          ·  {wave.items.length} item{wave.items.length === 1 ? '' : 's'}  ·  {timeAgo(wave.createdAt)}
        </text>
        <spacer grow />
      </hstack>

      <hstack gap="small">
        {wave.signals.map((s) => (
          <SignalBadge key={s} signal={s} />
        ))}
      </hstack>

      <text size="xsmall" color={COLORS.textMuted}>
        {displayAuthors}
      </text>

      {titlePreview ? (
        <text size="xsmall" color={COLORS.textDim} overflow="ellipsis">
          "{titlePreview.slice(0, 80)}"
        </text>
      ) : null}

      <hstack gap="small" alignment="middle">
        <button
          size="small"
          appearance="destructive"
          onPress={onNuke}
          icon="delete"
        >
          Nuke Wave
        </button>
        <button
          size="small"
          appearance="secondary"
          onPress={onDismiss}
        >
          Dismiss ✓
        </button>
      </hstack>
    </vstack>
  );
}
