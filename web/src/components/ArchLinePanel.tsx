import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Espelho de ArchLineView (src/integrations/arch-line.service.ts). */
interface ArchLineSystem {
  id: string;
  name: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  url: string | null;
  role: string | null;
  lastSeen: string | null;
  architecture: { score: number; grade: string | null; delta: number | null; analyzedAt: string | null } | null;
}

interface ArchLineView {
  enabled: boolean;
  hubUrl: string | null;
  systems: ArchLineSystem[];
  fetchedAt: string;
  error: string | null;
}

const REFRESH_MS = 30_000;
const SELF_ID = 'simple-arch';

const STATUS_LABEL: Record<ArchLineSystem['status'], string> = {
  UP: 'online',
  DOWN: 'offline',
  UNKNOWN: 'sem sinal',
};

const ROLE_LABEL: Record<string, string> = {
  platform: 'plataforma',
  business: 'negócio',
  collaboration: 'colaboração',
  insight: 'análise',
};

function gradeColor(grade: string | null): string {
  const key = (grade ?? '').toLowerCase();
  return ['a', 'b', 'c', 'd', 'f'].includes(key) ? `var(--arch-grade-${key})` : 'var(--arch-status-unknown)';
}

/**
 * "Linha Arch": os sistemas irmãos (PDV, Hub, ArchMAP…) com status e score de
 * arquitetura, lidos do Arch Hub pela API. Some por completo quando a
 * integração não está configurada — o SIMPLE ArCh continua sendo só um board.
 */
export function ArchLinePanel() {
  const [view, setView] = useState<ArchLineView | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<ArchLineView>('/arch-line')
        .then((v) => alive && setView(v))
        .catch(() => alive && setView(null));
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!view?.enabled) return null;

  return (
    <section aria-labelledby="arch-line-title" className="fade-up mt-12">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="arch-line-title" className="flex items-center gap-2 font-display text-sm font-semibold text-soft">
          <img src="/arch-mark.svg" alt="" width={18} height={18} />
          Linha Arch
        </h2>
        {view.hubUrl && (
          <a href={view.hubUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-faint transition hover:text-soft">
            Abrir Arch Hub ↗
          </a>
        )}
      </div>

      {view.error && (
        <p className="mb-3 rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {view.error}{view.systems.length > 0 && ' — mostrando o último retrato conhecido.'}
        </p>
      )}

      {view.systems.length === 0 && !view.error ? (
        <p className="text-[13px] text-faint">Nenhum sistema registrado no Hub ainda.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {view.systems.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-panel px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(--arch-status-${s.status.toLowerCase()})` }}
                    title={STATUS_LABEL[s.status]}
                  />
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold hover:underline">
                      {s.name}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-semibold">{s.name}</span>
                  )}
                  {s.id === SELF_ID && <span className="font-mono text-[10px] text-faint">(este)</span>}
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {STATUS_LABEL[s.status]}
                  {s.role && ` · ${ROLE_LABEL[s.role] ?? s.role}`}
                </p>
              </div>
              {s.architecture && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold text-[#0f1115]"
                  style={{ background: gradeColor(s.architecture.grade) }}
                  title="Score de arquitetura (ArchMAP)"
                >
                  {s.architecture.score}
                  {s.architecture.grade && ` ${s.architecture.grade}`}
                  {s.architecture.delta ? ` ${s.architecture.delta > 0 ? '▲' : '▼'}${Math.abs(s.architecture.delta)}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
