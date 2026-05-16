import { Devvit } from '@devvit/public-api';
import { COLORS, WARNING_COLORS, WARNING_LABELS, WARNING_ICONS, SIGNAL_LABELS } from '../../constants.js';
import type { WarningLevel, Signal } from '../../types.js';

interface WarningBadgeProps {
  level: WarningLevel;
}

export function WarningBadge({ level }: WarningBadgeProps): JSX.Element {
  if (level === 0) {
    return (
      <hstack backgroundColor={COLORS.successDim} cornerRadius="full" padding="xsmall" gap="none">
        <spacer size="xsmall" />
        <text size="xsmall" weight="bold" color={COLORS.white}>
          {WARNING_ICONS[0]} {WARNING_LABELS[0]}
        </text>
        <spacer size="xsmall" />
      </hstack>
    );
  }
  return (
    <hstack backgroundColor={WARNING_COLORS[level]} cornerRadius="full" padding="xsmall" gap="none">
      <spacer size="xsmall" />
      <text size="xsmall" weight="bold" color={COLORS.bg}>
        {WARNING_ICONS[level]} LEVEL {level}: {WARNING_LABELS[level].toUpperCase()}
      </text>
      <spacer size="xsmall" />
    </hstack>
  );
}

interface SignalBadgeProps {
  key?: string;
  signal: Signal;
}

export function SignalBadge({ signal }: Readonly<SignalBadgeProps>): JSX.Element {
  return (
    <hstack backgroundColor={COLORS.card} cornerRadius="full" padding="xsmall" gap="none" border="thin" borderColor={COLORS.caution}>
      <spacer size="xsmall" />
      <text size="xsmall" color={COLORS.caution}>
        ⚡ {SIGNAL_LABELS[signal] ?? signal}
      </text>
      <spacer size="xsmall" />
    </hstack>
  );
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: Readonly<StatusBadgeProps>): JSX.Element {
  const colorMap: Record<string, string> = {
    pending: COLORS.warning,
    open: COLORS.warning,
    actioned: COLORS.success,
    resolved: COLORS.success,
    dismissed: COLORS.textMuted,
    expired: COLORS.textMuted,
  };
  const color = colorMap[status] ?? COLORS.textMuted;
  return (
    <hstack cornerRadius="full" padding="xsmall" gap="none" border="thin" borderColor={color}>
      <spacer size="xsmall" />
      <text size="xsmall" color={color} weight="bold">
        {status.toUpperCase()}
      </text>
      <spacer size="xsmall" />
    </hstack>
  );
}
