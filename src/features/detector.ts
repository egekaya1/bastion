import type { TriggerContext } from '@devvit/public-api';
import { KEYS, WAVE_GROUPING_WINDOW_MS, CONTENT_HASH_TTL_SECS, FREQ_COUNTER_TTL_SECS } from '../constants.js';
import type { Signal, WaveItem, BastionSettings } from '../types.js';
import { getPendingWaves, createWave, addItemToWave } from '../redis/waves.js';
import { extractDomain, getDomains } from '../redis/domains.js';

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60).trim();
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.trunc(Math.imul(31, h) + (str.codePointAt(i) ?? 0));
  }
  return Math.abs(h).toString(36);
}

export async function scoreItem(
  params: {
    authorName: string;
    authorId: string;
    subredditId: string;
    title: string;
    url?: string;
    body?: string;
    createdAt: number;
  },
  settings: BastionSettings,
  context: TriggerContext
): Promise<Signal[]> {
  const signals: Signal[] = [];

  // Fetch user data to check account age and karma
  try {
    const user = await context.reddit.getUserByUsername(params.authorName);
    if (!user) throw new Error('user not found');
    const ageInDays = (Date.now() - user.createdAt.getTime()) / 86400000;
    if (ageInDays < settings.waveAccountAgeDays) signals.push('new-account');
    const totalKarma = user.linkKarma + user.commentKarma;
    if (totalKarma < settings.waveKarmaThreshold) signals.push('low-karma');
  } catch {
    // deleted or suspended accounts treated as suspicious
    signals.push('new-account');
  }

  // Frequency counter: posts by this author in this sub in current hour
  const hour = String(Math.floor(Date.now() / (1000 * 60 * 60)));
  const freqKey = KEYS.freqCounter(params.subredditId, params.authorId, hour);
  const freqRaw = await context.redis.get(freqKey);
  const freq = Number.parseInt(freqRaw ?? '0') + 1;
  await context.redis.set(freqKey, String(freq));
  await context.redis.expire(freqKey, FREQ_COUNTER_TTL_SECS);
  if (freq > settings.wavePostsPerHour) signals.push('high-frequency');

  // Similar content: normalized title hash
  const titleHash = simpleHash(normalizeTitle(params.title));
  const hashKey = KEYS.contentHash(params.subredditId, titleHash);
  const existingHash = await context.redis.get(hashKey);
  if (existingHash) {
    signals.push('similar-content');
  } else {
    await context.redis.set(hashKey, '1');
    await context.redis.expire(hashKey, CONTENT_HASH_TTL_SECS);
  }

  // Known domain check — red-tagged domains in post URL, title, and body text
  const domainsMap = await getDomains(params.subredditId, context);
  const redDomains = Object.entries(domainsMap)
    .filter(([, tag]) => tag.color === 'red')
    .map(([d]) => d);

  if (redDomains.length > 0) {
    const urlDomain = params.url ? extractDomain(params.url) : '';
    const allText = `${urlDomain} ${params.title} ${params.body ?? ''}`.toLowerCase();
    if (redDomains.some((d) => allText.includes(d))) {
      signals.push('known-domain');
    }
  }

  return signals;
}

export async function processItem(
  item: WaveItem & { url?: string },
  signals: Signal[],
  subredditId: string,
  context: TriggerContext
): Promise<void> {
  // Only process if 2+ signals
  if (signals.length < 2) return;

  const pendingWaves = await getPendingWaves(subredditId, context);
  const now = Date.now();

  // Find an existing wave from the same time window with overlapping signals
  const matchingWave = pendingWaves.find((w) => {
    const withinWindow = now - w.createdAt < WAVE_GROUPING_WINDOW_MS;
    const signalOverlap = signals.some((s) => w.signals.includes(s));
    return withinWindow && signalOverlap;
  });

  if (matchingWave) {
    await addItemToWave(subredditId, matchingWave.id, item, context);
  } else {
    await createWave(subredditId, item, signals, context);
  }
}
