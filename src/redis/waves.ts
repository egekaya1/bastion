import type { TriggerContext } from '@devvit/public-api';
import { KEYS } from '../constants.js';
import type { Wave, WaveStatus, WaveItem, Signal } from '../types.js';

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getWave(
  subredditId: string,
  waveId: string,
  context: TriggerContext
): Promise<Wave | null> {
  const raw = await context.redis.get(KEYS.wave(subredditId, waveId));
  if (!raw) return null;
  return JSON.parse(raw) as Wave;
}

export async function saveWave(wave: Wave, context: TriggerContext): Promise<void> {
  await context.redis.set(KEYS.wave(wave.subredditId, wave.id), JSON.stringify(wave));
}

export async function getPendingWaves(subredditId: string, context: TriggerContext): Promise<Wave[]> {
  const raw = await context.redis.get(KEYS.wavesPending(subredditId));
  if (!raw) return [];
  const ids = JSON.parse(raw) as string[];
  const waves = await Promise.all(ids.map((id) => getWave(subredditId, id, context)));
  return waves.filter((w): w is Wave => w !== null && w.status === 'pending');
}

async function setPendingIndex(
  subredditId: string,
  ids: string[],
  context: TriggerContext
): Promise<void> {
  await context.redis.set(KEYS.wavesPending(subredditId), JSON.stringify(ids));
}

export async function createWave(
  subredditId: string,
  firstItem: WaveItem,
  signals: Signal[],
  context: TriggerContext
): Promise<Wave> {
  const wave: Wave = {
    id: newId(),
    subredditId,
    items: [firstItem],
    signals,
    status: 'pending',
    createdAt: Date.now(),
  };
  await saveWave(wave, context);
  const raw = await context.redis.get(KEYS.wavesPending(subredditId));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  ids.push(wave.id);
  await setPendingIndex(subredditId, ids, context);
  return wave;
}

export async function addItemToWave(
  subredditId: string,
  waveId: string,
  item: WaveItem,
  context: TriggerContext
): Promise<Wave | null> {
  const wave = await getWave(subredditId, waveId, context);
  if (!wave || wave.status !== 'pending') return null;
  const alreadyIn = wave.items.some((i) => i.id === item.id);
  if (!alreadyIn) wave.items.push(item);
  await saveWave(wave, context);
  return wave;
}

export async function updateWaveStatus(
  subredditId: string,
  waveId: string,
  status: WaveStatus,
  actionedBy: string,
  context: TriggerContext
): Promise<void> {
  const wave = await getWave(subredditId, waveId, context);
  if (!wave) return;
  wave.status = status;
  wave.actionedBy = actionedBy;
  wave.actionedAt = Date.now();
  await saveWave(wave, context);
  // Remove from pending index
  const raw = await context.redis.get(KEYS.wavesPending(subredditId));
  if (raw) {
    const ids = (JSON.parse(raw) as string[]).filter((id) => id !== waveId);
    await setPendingIndex(subredditId, ids, context);
  }
}
