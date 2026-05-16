import type { TriggerContext } from '@devvit/public-api';
import { KEYS } from '../constants.js';
import type { DomainTag, TagColor } from '../types.js';

export type DomainsMap = Record<string, DomainTag>;

export async function getDomains(
  subredditId: string,
  context: TriggerContext
): Promise<DomainsMap> {
  const raw = await context.redis.get(KEYS.domains(subredditId));
  if (!raw) return {};
  return JSON.parse(raw) as DomainsMap;
}

export async function saveDomain(
  subredditId: string,
  domain: string,
  tag: DomainTag,
  context: TriggerContext
): Promise<void> {
  const map = await getDomains(subredditId, context);
  map[domain.toLowerCase()] = tag;
  await context.redis.set(KEYS.domains(subredditId), JSON.stringify(map));
}

export async function removeDomain(
  subredditId: string,
  domain: string,
  context: TriggerContext
): Promise<void> {
  const map = await getDomains(subredditId, context);
  delete map[domain.toLowerCase()];
  await context.redis.set(KEYS.domains(subredditId), JSON.stringify(map));
}

export async function checkDomain(
  subredditId: string,
  domain: string,
  context: TriggerContext
): Promise<DomainTag | null> {
  const map = await getDomains(subredditId, context);
  return map[domain.toLowerCase()] ?? null;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
