import type { TriggerContext } from '@devvit/public-api';
import { KEYS } from '../constants.js';
import type { ModlogEntry } from '../types.js';

type DayStats = Record<string, ModlogEntry>;

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function pastDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    );
  }
  return dates;
}

export async function recordModAction(
  subredditId: string,
  modName: string,
  action: 'removes' | 'approves' | 'bans' | 'nukes',
  context: TriggerContext
): Promise<void> {
  const date = todayKey();
  const key = KEYS.modlog(subredditId, date);
  const raw = await context.redis.get(key);
  const stats: DayStats = raw ? JSON.parse(raw) : {};
  if (!stats[modName]) {
    stats[modName] = { removes: 0, approves: 0, bans: 0, nukes: 0 };
  }
  stats[modName][action]++;
  await context.redis.set(key, JSON.stringify(stats));
}

export async function getStatsForRange(
  subredditId: string,
  days: number,
  context: TriggerContext
): Promise<{ aggregated: Record<string, ModlogEntry>; daily: { date: string; stats: DayStats }[] }> {
  const dates = pastDates(days);
  const daily: { date: string; stats: DayStats }[] = [];
  const aggregated: Record<string, ModlogEntry> = {};

  for (const date of dates) {
    const raw = await context.redis.get(KEYS.modlog(subredditId, date));
    const stats: DayStats = raw ? JSON.parse(raw) : {};
    daily.push({ date, stats });
    for (const [mod, entry] of Object.entries(stats)) {
      if (!aggregated[mod]) aggregated[mod] = { removes: 0, approves: 0, bans: 0, nukes: 0 };
      aggregated[mod].removes += entry.removes;
      aggregated[mod].approves += entry.approves;
      aggregated[mod].bans += entry.bans;
      aggregated[mod].nukes += entry.nukes;
    }
  }

  return { aggregated, daily };
}
