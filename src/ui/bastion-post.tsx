import { Devvit, useState, useAsync, useForm, useChannel } from '@devvit/public-api'; // Devvit used as JSX factory (jsxFactory: "Devvit.createElement")
import type { Context } from '@devvit/public-api';
import { COLORS, APP_NAME, KEYS, TAG_COLOR_LABELS } from '../constants.js';
import { WaveCard } from './components/wave-card.js';
import { StatRow, StatHeader } from './components/stat-row.js';
import { StatusBadge } from './components/badge.js';
import { DossierPanel } from './components/dossier-panel.js';
import { VoteBar } from './components/vote-bar.js';
import { getPendingWaves, updateWaveStatus } from '../redis/waves.js';
import { getOpenCases, getCaseByPostId } from '../redis/cases.js';
import { getDomains, removeDomain, saveDomain, extractDomain } from '../redis/domains.js';
import { getStatsForRange } from '../redis/modlog.js';
import { getDossierWithLiveData } from '../features/dossier.js';
import { castVote } from '../features/council.js';
import { nukeThread } from '../features/nuke.js';
import { DEFAULT_SETTINGS } from '../types.js';
import type { DashboardTab, Wave, Case, ModlogEntry, DomainTag, TagColor } from '../types.js';
import type { DomainsMap } from '../redis/domains.js';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TAB_LABELS: Record<DashboardTab, string> = {
  waves: '🚨 Waves',
  cases: '⚖️ Cases',
  stats: '📊 Stats',
  domains: '🌐 Domains',
};

// Single custom post type for both dashboard and council cases.
// ALL hooks must be called unconditionally at the top — Devvit's runtime
// enforces the same ordering every render.
export function BastionPost(context: Context): JSX.Element {
  const [tab, setTab] = useState<DashboardTab>('waves');
  const [dashRefresh, setDashRefresh] = useState(0);
  const [caseRefresh, setCaseRefresh] = useState(0);
  const [confirmNukeWaveId, setConfirmNukeWaveId] = useState('');

  // Determine post kind and load council data if needed.
  // Also gates access — non-mods and logged-out users see an access-denied screen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: councilRaw, loading: kindLoading } = useAsync<any>(
    async () => {
      if (!context.username) return { accessDenied: true };
      try {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const listing = context.reddit.getModerators({ subredditName: subreddit.name, username: context.username });
        const mods = await listing.all();
        if (!mods.some((m) => m.username === context.username)) return { accessDenied: true };
      } catch {
        return { accessDenied: true };
      }

      const postId = context.postId;
      if (!postId) return null;
      const stored = await context.redis.get(KEYS.postKind(postId));
      if (stored === 'dashboard') return null;
      const c = await getCaseByPostId(context.subredditId, postId, context);
      if (!c) return null;
      let dossierData = null;
      try {
        dossierData = await getDossierWithLiveData(
          context.subredditId, c.targetAuthorId, c.targetAuthor, context
        );
      } catch { /* best-effort */ }
      const rawSettings = await context.settings.getAll();
      const quorumCount = Number(rawSettings.quorumCount ?? 2);
      return { councilCase: c, dossierData, quorumCount };
    },
    { depends: [caseRefresh] }
  );

  // Dashboard data — always fetched regardless of post kind (hook ordering rule).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wavesRaw, loading: wLoading } = useAsync<any>(
    async () => getPendingWaves(context.subredditId, context),
    { depends: [dashRefresh] }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: casesRaw, loading: cLoading } = useAsync<any>(
    async () => getOpenCases(context.subredditId, context),
    { depends: [dashRefresh] }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statsRaw, loading: sLoading } = useAsync<any>(
    async () => getStatsForRange(context.subredditId, 7, context),
    { depends: [dashRefresh] }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: domainsRaw, loading: dLoading } = useAsync<any>(
    async () => getDomains(context.subredditId, context),
    { depends: [dashRefresh] }
  );

  const addDomainForm = useForm(
    {
      title: '🌐 Tag Domain',
      acceptLabel: 'Save Tag',
      cancelLabel: 'Cancel',
      fields: [
        { name: 'domain', label: 'Domain', type: 'string', required: true, helpText: 'Just the domain, e.g. spamsite.com' },
        { name: 'label', label: 'Label', type: 'string', required: true },
        {
          name: 'color',
          label: 'Tag color',
          type: 'select',
          required: true,
          options: Object.entries(TAG_COLOR_LABELS).map(([value, label]) => ({ value, label })),
        },
      ],
    },
    async (values) => {
      const rawDomain = String(values.domain ?? '').trim();
      const label = String(values.label ?? '').trim();
      const color = String(values.color ?? 'red') as TagColor;
      const domain = extractDomain(rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`);
      if (!domain) { context.ui.showToast('❌ Invalid domain format.'); return; }
      await saveDomain(context.subredditId, domain, { label, color, addedBy: context.username ?? 'unknown', addedAt: Date.now() }, context);
      context.ui.showToast(`✅ Tagged ${domain} as ${color}.`);
      setDashRefresh((k) => k + 1);
      await context.realtime.send(`bastion_${context.subredditId}`, { type: 'dash' });
    }
  );

  // Realtime channel — broadcasts state changes to all open Bastion posts in this subreddit.
  // 'dash' events refresh the dashboard; 'case' events (with matching postId) refresh a council case.
  const realtimeChannelName = `bastion_${context.subredditId}`;
  const channel = useChannel({
    name: realtimeChannelName,
    onMessage: (msg) => {
      const data = msg as { type: string; postId?: string };
      if (data.type === 'dash') setDashRefresh((k) => k + 1);
      if (data.type === 'case' && data.postId === context.postId) setCaseRefresh((k) => k + 1);
    },
  });
  channel.subscribe();

  const dashRefreshFn = (): void => setDashRefresh((k) => k + 1);

  // All hooks have been called — safe to return early from here.
  if (kindLoading) {
    return (
      <blocks height="tall">
        <vstack width="100%" height="100%" backgroundColor={COLORS.bg} alignment="center middle">
          <text color={COLORS.textMuted}>Loading...</text>
        </vstack>
      </blocks>
    );
  }

  if (councilRaw?.accessDenied === true) {
    return (
      <blocks height="tall">
        <vstack width="100%" height="100%" backgroundColor={COLORS.bg} alignment="center middle" gap="small">
          <text size="xxlarge">🛡️</text>
          <text size="medium" weight="bold" color={COLORS.textPrimary}>Moderator access only</text>
          <text size="small" color={COLORS.textMuted} alignment="center">This tool is for the mod team of this subreddit.</text>
        </vstack>
      </blocks>
    );
  }

  // Council case view
  if (councilRaw) {
    const { councilCase, dossierData, quorumCount } = councilRaw as {
      councilCase: Case;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dossierData: any;
      quorumCount: number;
    };
    const isResolved = councilCase.status !== 'open';
    const alreadyVoted = councilCase.votes.some((v) => v.modId === context.userId);

    const handleVote = async (vote: 'remove' | 'approve' | 'escalate'): Promise<void> => {
      const settings = { ...DEFAULT_SETTINGS, ...await context.settings.getAll() };
      const result = await castVote(
        context.subredditId,
        councilCase.id,
        { modId: context.userId ?? '', modName: context.username ?? '', vote, at: Date.now() },
        settings,
        context
      );
      if (result.alreadyResolved) { context.ui.showToast('Case already resolved.'); return; }
      const quorumMessages: Record<string, string> = {
        approve: '✅ Quorum reached: content approved.',
        escalate: '✅ Quorum reached: user banned.',
        remove: '✅ Quorum reached: content removed.',
      };
      const outcomeMsg = result.quorumReached ? (quorumMessages[vote] ?? '✅ Quorum reached.') : 'Vote recorded.';
      setCaseRefresh((k) => k + 1);
      context.ui.showToast(outcomeMsg);
      await context.realtime.send(realtimeChannelName, { type: 'case', postId: context.postId ?? '' });
    };

    return (
      <blocks height="tall">
        <vstack width="100%" height="100%" backgroundColor={COLORS.bg} gap="none">
          <hstack padding="medium" backgroundColor={COLORS.card} border="thin" borderColor={COLORS.border} alignment="middle" gap="small">
            <text size="large" weight="bold" color={COLORS.orange}>⚖️ COUNCIL CASE</text>
            <spacer grow />
            <StatusBadge status={councilCase.status} />
          </hstack>

          <hstack grow padding="medium" gap="medium">
            <vstack gap="small" minWidth="160px" maxWidth="220px">
              {dossierData ? (
                <DossierPanel dossier={dossierData.dossier} live={dossierData.live} compact={true} />
              ) : (
                <vstack backgroundColor={COLORS.card} cornerRadius="medium" padding="medium" border="thin" borderColor={COLORS.border}>
                  <text size="small" color={COLORS.textMuted}>User info unavailable</text>
                </vstack>
              )}
            </vstack>

            <vstack gap="small" grow>
              <vstack backgroundColor={COLORS.card} cornerRadius="medium" padding="medium" border="thin" borderColor={COLORS.border} gap="small">
                <text size="xsmall" color={COLORS.textMuted} weight="bold">{councilCase.targetType.toUpperCase()} UNDER REVIEW</text>
                <text size="small" color={COLORS.textPrimary} overflow="ellipsis">"{councilCase.contentSnapshot}"</text>
                <hstack gap="small">
                  <text size="xsmall" color={COLORS.textMuted}>Referred by</text>
                  <text size="xsmall" color={COLORS.blue}>u/{councilCase.referredBy}</text>
                  <text size="xsmall" color={COLORS.textMuted}>·</text>
                  <text size="xsmall" color={COLORS.warning}>⚠ {councilCase.reason}</text>
                </hstack>
                {councilCase.note ? (
                  <text size="xsmall" color={COLORS.textMuted}>Note: {councilCase.note}</text>
                ) : null}
              </vstack>

              <vstack backgroundColor={COLORS.card} cornerRadius="medium" padding="medium" border="thin" borderColor={COLORS.border} gap="small">
                <VoteBar votes={councilCase.votes} quorumCount={quorumCount} currentUserId={context.userId} />

                {!isResolved && !alreadyVoted ? (
                  <hstack gap="small">
                    <button size="medium" appearance="destructive" grow onPress={() => handleVote('remove')}>🔴 Remove</button>
                    <button size="medium" appearance="secondary" grow onPress={() => handleVote('approve')}>🟢 Approve</button>
                    <button size="medium" appearance="destructive" grow onPress={() => handleVote('escalate')}>⚡ Escalate</button>
                  </hstack>
                ) : null}

                {isResolved ? (() => {
                  const decisionBg = councilCase.decision === 'approved' ? COLORS.successDim : COLORS.dangerDim;
                  const decisionLabels: Record<string, string> = {
                    approved: '✅ CASE RESOLVED: APPROVED',
                    removed: '🗑️ CASE RESOLVED: REMOVED',
                    banned: '⛔ CASE RESOLVED: BANNED',
                  };
                  const decisionLabel = councilCase.decision ? (decisionLabels[councilCase.decision] ?? '⏰ CASE EXPIRED') : '⏰ CASE EXPIRED';
                  return (
                    <vstack backgroundColor={decisionBg} cornerRadius="medium" padding="medium" alignment="center middle">
                      <text size="medium" weight="bold" color={COLORS.white}>{decisionLabel}</text>
                    </vstack>
                  );
                })() : null}

                {alreadyVoted && !isResolved ? (
                  <text size="xsmall" color={COLORS.success} alignment="center">✓ Your vote has been recorded</text>
                ) : null}
              </vstack>
            </vstack>
          </hstack>
        </vstack>
      </blocks>
    );
  }

  // Dashboard view
  const waves = (wavesRaw ?? null) as Wave[] | null;
  const cases = (casesRaw ?? null) as Case[] | null;
  const domains = (domainsRaw ?? null) as DomainsMap | null;

  return (
    <blocks height="tall">
      <vstack width="100%" height="100%" backgroundColor={COLORS.bg}>
        <hstack padding="medium" backgroundColor={COLORS.card} border="thin" borderColor={COLORS.border} alignment="middle" gap="small">
          <text size="large" weight="bold" color={COLORS.orange}>🛡️ {APP_NAME.toUpperCase()}</text>
          <spacer grow />
          <LiveIndicator status={channel.status} />
          <button size="medium" appearance="secondary" onPress={dashRefreshFn} icon="refresh">Refresh</button>
        </hstack>

        <hstack backgroundColor={COLORS.card} border="thin" borderColor={COLORS.border} padding="xsmall" gap="small">
          {(['waves', 'cases', 'stats', 'domains'] as DashboardTab[]).map((t) => (
            <button key={t} size="medium" appearance={tab === t ? 'primary' : 'secondary'} onPress={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </hstack>

        <vstack grow padding="medium" gap="small">
          {tab === 'waves' && renderWaves(waves, wLoading, context, realtimeChannelName, dashRefreshFn, { waveId: confirmNukeWaveId, onRequest: (id: string) => setConfirmNukeWaveId(id), onCancel: () => setConfirmNukeWaveId('') })}
          {tab === 'cases' && renderCases(cases, cLoading, context)}
          {tab === 'stats' && renderStats(statsRaw, sLoading)}
          {tab === 'domains' && renderDomains(domains, dLoading, context, realtimeChannelName, dashRefreshFn, addDomainForm)}
        </vstack>
      </vstack>
    </blocks>
  );
}

type WaveConfirm = { waveId: string; onRequest: (id: string) => void; onCancel: () => void };

function renderWaves(
  waves: Wave[] | null,
  loading: boolean,
  context: Context,
  channelName: string,
  refresh: () => void,
  confirm: WaveConfirm
): JSX.Element {
  if (loading) return <EmptyState icon="🔍" text="Scanning for waves..." />;
  if (!waves || waves.length === 0) {
    return <EmptyState icon="✅" text="No suspicious activity detected." subtitle="Bastion monitors new posts and comments automatically." />;
  }
  return (
    <vstack gap="small">
      <text size="small" color={COLORS.textMuted}>{waves.length} active wave{waves.length === 1 ? '' : 's'}</text>
      {waves.map((wave) => (
        <WaveCard
          key={wave.id}
          wave={wave}
          isConfirming={wave.id === confirm.waveId}
          onRequestConfirm={() => confirm.onRequest(wave.id)}
          onCancelConfirm={confirm.onCancel}
          onNuke={async () => {
            confirm.onCancel();
            context.ui.showToast('Nuking wave...');
            for (const item of wave.items) {
              if (item.type === 'post') await nukeThread(item.id, { remove: true, lock: false, isSpam: true }, context);
              else await context.reddit.remove(item.id, true);
            }
            await updateWaveStatus(context.subredditId, wave.id, 'actioned', context.username ?? '', context);
            const n = wave.items.length;
            context.ui.showToast(`✅ Nuked ${n} item${n === 1 ? '' : 's'}.`);
            refresh();
            await context.realtime.send(channelName, { type: 'dash' });
          }}
          onDismiss={async () => {
            await updateWaveStatus(context.subredditId, wave.id, 'dismissed', context.username ?? '', context);
            refresh();
            await context.realtime.send(channelName, { type: 'dash' });
          }}
        />
      ))}
    </vstack>
  );
}

function renderCases(cases: Case[] | null, loading: boolean, context: Context): JSX.Element {
  if (loading) return <EmptyState icon="⚖️" text="Loading cases..." />;
  if (!cases || cases.length === 0) {
    return <EmptyState icon="✅" text="No open council cases." subtitle="Right-click any post or comment and select Send to Council." />;
  }
  return (
    <vstack gap="small">
      <text size="small" color={COLORS.textMuted}>{cases.length} open case{cases.length === 1 ? '' : 's'}</text>
      {cases.map((c) => (
        <vstack key={c.id} backgroundColor={COLORS.card} cornerRadius="medium" padding="medium" border="thin" borderColor={COLORS.border} gap="small">
          <hstack alignment="middle" gap="small">
            <text size="small" weight="bold" color={COLORS.textPrimary} grow overflow="ellipsis">u/{c.targetAuthor}</text>
            <StatusBadge status={c.status} />
            <button size="small" appearance="secondary" onPress={async () => {
              const post = await context.reddit.getPostById(c.councilPostId);
              context.ui.navigateTo(post);
            }}>Open</button>
          </hstack>
          <text size="xsmall" color={COLORS.textMuted}>{c.reason}  ·  {c.votes.length} vote{c.votes.length === 1 ? '' : 's'}  ·  {timeAgo(c.createdAt)}</text>
          <text size="xsmall" color={COLORS.textDim} overflow="ellipsis">"{c.contentSnapshot.slice(0, 80)}"</text>
          <text size="xsmall" color={COLORS.blue}>Referred by u/{c.referredBy}</text>
        </vstack>
      ))}
    </vstack>
  );
}

function renderStats(statsRaw: unknown, loading: boolean): JSX.Element {
  if (loading) return <EmptyState icon="📊" text="Loading stats..." />;
  const aggregated = statsRaw ? (statsRaw as { aggregated: Record<string, ModlogEntry> }).aggregated : null;
  if (!aggregated || Object.keys(aggregated).length === 0) {
    return <EmptyState icon="📊" text="No mod actions recorded yet." subtitle="Stats appear here as moderators take actions." />;
  }
  const mods = Object.entries(aggregated).sort((a, b) =>
    (b[1].removes + b[1].approves + b[1].bans + b[1].nukes) -
    (a[1].removes + a[1].approves + a[1].bans + a[1].nukes)
  );
  const totals = mods.reduce(
    (acc, [, e]) => ({
      removes: acc.removes + e.removes,
      approves: acc.approves + e.approves,
      bans: acc.bans + e.bans,
      nukes: acc.nukes + e.nukes,
    }),
    { removes: 0, approves: 0, bans: 0, nukes: 0 }
  );
  return (
    <vstack gap="small">
      <text size="small" color={COLORS.textMuted} weight="bold">LAST 7 DAYS</text>
      <vstack backgroundColor={COLORS.card} cornerRadius="medium" padding="small" border="thin" borderColor={COLORS.border} gap="small">
        <StatHeader />
        <vstack borderColor={COLORS.border} border="thin" />
        {mods.map(([mod, entry]) => (
          <StatRow key={mod} modName={mod} entry={entry} isBastion={mod === 'Bastion'} />
        ))}
      </vstack>
      <hstack gap="medium" padding="small">
        <vstack alignment="center" gap="small">
          <text size="large" weight="bold" color={COLORS.danger}>{totals.removes}</text>
          <text size="xsmall" color={COLORS.textMuted}>Removed</text>
        </vstack>
        <vstack alignment="center" gap="small">
          <text size="large" weight="bold" color={COLORS.caution}>{totals.bans}</text>
          <text size="xsmall" color={COLORS.textMuted}>Banned</text>
        </vstack>
        <vstack alignment="center" gap="small">
          <text size="large" weight="bold" color={COLORS.success}>{totals.approves}</text>
          <text size="xsmall" color={COLORS.textMuted}>Approved</text>
        </vstack>
        <vstack alignment="center" gap="small">
          <text size="large" weight="bold" color={COLORS.blue}>{totals.nukes}</text>
          <text size="xsmall" color={COLORS.textMuted}>Nuked</text>
        </vstack>
      </hstack>
    </vstack>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDomains(domains: DomainsMap | null, loading: boolean, context: Context, channelName: string, refresh: () => void, addDomainForm: any): JSX.Element {
  if (loading) return <EmptyState icon="🌐" text="Loading domains..." />;
  const entries: [string, DomainTag][] = domains ? Object.entries(domains) : [];
  const dot: Record<string, string> = { red: '🔴', orange: '🟠', green: '🟢' };
  const domainPlural = entries.length === 1 ? '' : 's';
  const countLabel = entries.length === 0 ? 'No domains tagged yet' : `${entries.length} tagged domain${domainPlural}`;
  return (
    <vstack gap="small">
      <hstack alignment="middle">
        <text size="small" color={COLORS.textMuted}>{countLabel}</text>
        <spacer grow />
        <button size="small" appearance="secondary" onPress={() => context.ui.showForm(addDomainForm)}>+ Add Domain</button>
      </hstack>
      {entries.length === 0 ? (
        <text size="small" color={COLORS.textDim} alignment="center">Tag domains to flag them in wave detection.</text>
      ) : null}
      {entries.map(([domain, tag]) => (
        <hstack key={domain} backgroundColor={COLORS.card} cornerRadius="medium" padding="medium" border="thin" borderColor={COLORS.border} alignment="middle" gap="small">
          <text size="small" color={COLORS.textPrimary} grow>{dot[tag.color] ?? '⚪'} {domain}</text>
          <text size="xsmall" color={COLORS.textMuted}>{tag.label}</text>
          <button size="small" appearance="secondary" icon="delete" onPress={async () => {
            await removeDomain(context.subredditId, domain, context);
            refresh();
            await context.realtime.send(channelName, { type: 'dash' });
          }} />
        </hstack>
      ))}
    </vstack>
  );
}

function LiveIndicator({ status }: Readonly<{ status: number }>): JSX.Element {
  if (status === 2) return <text size="xsmall" color={COLORS.success} weight="bold">● LIVE</text>;
  return <text size="xsmall" color={COLORS.textMuted}>○ Connecting</text>;
}

function EmptyState({ icon, text, subtitle }: Readonly<{ icon: string; text: string; subtitle?: string }>): JSX.Element {
  return (
    <vstack alignment="center middle" gap="small" padding="large" grow>
      <text size="xxlarge">{icon}</text>
      <text size="medium" color={COLORS.textPrimary} weight="bold" alignment="center">{text}</text>
      {subtitle ? <text size="small" color={COLORS.textMuted} alignment="center">{subtitle}</text> : null}
    </vstack>
  );
}
