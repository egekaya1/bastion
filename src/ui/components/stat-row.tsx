import { Devvit } from '@devvit/public-api';
import { COLORS } from '../../constants.js';
import type { ModlogEntry } from '../../types.js';

interface StatRowProps {
  key?: string;
  modName: string;
  entry: ModlogEntry;
  isBastion?: boolean;
}

export function StatRow({ modName, entry, isBastion = false }: StatRowProps): JSX.Element {
  const total = entry.removes + entry.approves + entry.bans + entry.nukes;
  return (
    <hstack
      gap="medium"
      padding="small"
      backgroundColor={isBastion ? COLORS.cardHover : 'transparent'}
      cornerRadius="small"
    >
      <text size="xsmall" color={isBastion ? COLORS.orange : COLORS.textPrimary} weight={isBastion ? 'bold' : 'regular'} grow>
        {isBastion ? '🛡️ Bastion (auto)' : `u/${modName}`}
      </text>
      <text size="xsmall" color={COLORS.danger} minWidth="40px" alignment="end">
        {entry.removes}
      </text>
      <text size="xsmall" color={COLORS.success} minWidth="40px" alignment="end">
        {entry.approves}
      </text>
      <text size="xsmall" color={COLORS.caution} minWidth="40px" alignment="end">
        {entry.bans}
      </text>
      <text size="xsmall" color={COLORS.textMuted} minWidth="40px" alignment="end">
        {entry.nukes}
      </text>
    </hstack>
  );
}

export function StatHeader(): JSX.Element {
  return (
    <hstack gap="medium" padding="small">
      <text size="xsmall" color={COLORS.textMuted} weight="bold" grow>
        MOD
      </text>
      <text size="xsmall" color={COLORS.danger} weight="bold" minWidth="40px" alignment="end">
        RM
      </text>
      <text size="xsmall" color={COLORS.success} weight="bold" minWidth="40px" alignment="end">
        AP
      </text>
      <text size="xsmall" color={COLORS.caution} weight="bold" minWidth="40px" alignment="end">
        BAN
      </text>
      <text size="xsmall" color={COLORS.textMuted} weight="bold" minWidth="40px" alignment="end">
        NUK
      </text>
    </hstack>
  );
}
