import { Injectable, Logger } from '@nestjs/common';
import { resolveArchHubConfig } from './arch-hub.service';

/**
 * Visão da linha Arch para o usuário do SIMPLE ArCh: status e score de
 * arquitetura de cada sistema, lidos do Arch Hub pelo servidor.
 *
 * Por que passar pelo backend em vez do browser chamar o Hub direto:
 * o Hub pode estar numa rede que só o servidor alcança, não manda CORS, e a
 * resposta é cacheada (todos os usuários abrindo a home = 1 chamada ao Hub
 * a cada CACHE_MS). Só campos conhecidos atravessam — nada do Hub é repassado
 * cru para o front.
 */
export const ARCH_LINE_CACHE_MS = 15_000;

export interface ArchLineScore {
  score: number;
  grade: string | null;
  delta: number | null;
  analyzedAt: string | null;
}

export interface ArchLineSystem {
  id: string;
  name: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  url: string | null;
  role: string | null;
  lastSeen: string | null;
  architecture: ArchLineScore | null;
}

export interface ArchLineView {
  enabled: boolean;
  hubUrl: string | null;
  systems: ArchLineSystem[];
  fetchedAt: string;
  error: string | null;
}

type Json = Record<string, unknown>;

const STATUSES = new Set(['UP', 'DOWN', 'UNKNOWN']);

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 200) : null;
}

function httpUrl(value: unknown): string | null {
  const s = str(value);
  return s && /^https?:\/\//i.test(s) ? s : null;
}

function toScore(summary: unknown): ArchLineScore | null {
  if (!summary || typeof summary !== 'object') return null;
  const latest = (summary as Json).latest as Json | undefined;
  if (!latest || typeof latest.score !== 'number') return null;
  const delta = (summary as Json).delta;
  return {
    score: Math.max(0, Math.min(100, Math.round(latest.score))),
    grade: str(latest.grade),
    delta: typeof delta === 'number' ? delta : null,
    analyzedAt: str(latest.analyzedAt),
  };
}

/** Junta /systems (quem está no ar) com /architecture (inclui repos só com CI). */
export function buildArchLineSystems(systems: unknown, architecture: unknown): ArchLineSystem[] {
  const result = new Map<string, ArchLineSystem>();
  for (const raw of Array.isArray(systems) ? systems : []) {
    const s = raw as Json;
    const id = str(s.id);
    if (!id) continue;
    const tags = Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === 'string') : [];
    const role = tags.find((t) => t.startsWith('role:'))?.slice(5) ?? null;
    result.set(id, {
      id,
      name: str(s.name) ?? id,
      status: STATUSES.has(s.status as string) ? (s.status as ArchLineSystem['status']) : 'UNKNOWN',
      url: httpUrl(s.baseUrl),
      role,
      lastSeen: str(s.lastSeen),
      architecture: toScore(s.architecture),
    });
  }
  for (const raw of Array.isArray(architecture) ? architecture : []) {
    const entry = raw as Json;
    const id = str(entry.systemId);
    if (!id || result.has(id)) continue;
    result.set(id, {
      id,
      name: id,
      status: 'UNKNOWN',
      url: null,
      role: null,
      lastSeen: null,
      architecture: toScore(entry.architecture),
    });
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

@Injectable()
export class ArchLineService {
  private readonly logger = new Logger(ArchLineService.name);
  private cache?: { at: number; view: ArchLineView };
  private inflight?: Promise<ArchLineView>;

  constructor(
    private readonly hubUrl: string | null = resolveArchHubConfig()?.hubUrl ?? null,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async view(): Promise<ArchLineView> {
    if (!this.hubUrl) {
      return { enabled: false, hubUrl: null, systems: [], fetchedAt: new Date(this.now()).toISOString(), error: null };
    }
    if (this.cache && this.now() - this.cache.at < ARCH_LINE_CACHE_MS) return this.cache.view;
    // Várias requisições simultâneas compartilham a mesma ida ao Hub.
    this.inflight ??= this.load().finally(() => (this.inflight = undefined));
    return this.inflight;
  }

  private async load(): Promise<ArchLineView> {
    const hubUrl = this.hubUrl!;
    const fetchedAt = new Date(this.now()).toISOString();
    try {
      const [systems, architecture] = await Promise.all([
        this.getJson(`${hubUrl}/api/v1/systems`),
        this.getJson(`${hubUrl}/api/v1/architecture`).catch(() => []), // Hub antigo sem o endpoint
      ]);
      const view: ArchLineView = {
        enabled: true,
        hubUrl: httpUrl(hubUrl),
        systems: buildArchLineSystems(systems, architecture),
        fetchedAt,
        error: null,
      };
      this.cache = { at: this.now(), view };
      return view;
    } catch (err) {
      this.logger.warn(`Arch Hub indisponível em ${hubUrl}: ${(err as Error).message}`);
      // Mantém o último retrato bom (marcado com erro) em vez de esvaziar a tela.
      const stale = this.cache?.view;
      return {
        enabled: true,
        hubUrl: httpUrl(hubUrl),
        systems: stale?.systems ?? [],
        fetchedAt: stale?.fetchedAt ?? fetchedAt,
        error: 'Arch Hub indisponível',
      };
    }
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
