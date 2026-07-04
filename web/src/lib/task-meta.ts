import type { TaskPriority } from '../types';

/** Rótulo PT, cor do "dot" e classes de chip por prioridade. */
export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; chip: string; order: number }
> = {
  URGENT: { label: 'Urgente', dot: 'bg-red-500', chip: 'bg-red-950 text-red-300 border-red-900', order: 0 },
  HIGH: { label: 'Alta', dot: 'bg-orange-500', chip: 'bg-orange-950 text-orange-300 border-orange-900', order: 1 },
  MEDIUM: { label: 'Média', dot: 'bg-blue-500', chip: 'bg-blue-950 text-blue-300 border-blue-900', order: 2 },
  LOW: { label: 'Baixa', dot: 'bg-zinc-500', chip: 'bg-zinc-800 text-zinc-300 border-zinc-700', order: 3 },
};

export const PRIORITY_ORDER: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** Estado do prazo relativo a agora — dirige a cor no card. */
export function dueState(dueDate: string | null | undefined): 'none' | 'overdue' | 'soon' | 'later' {
  if (!dueDate) return 'none';
  const diffMs = new Date(dueDate).getTime() - Date.now();
  if (diffMs < 0) return 'overdue';
  if (diffMs < 48 * 3600 * 1000) return 'soon'; // vence em até 2 dias
  return 'later';
}

/** "31/07", "hoje", "amanhã", "ontem" — formato curto e humano do prazo. */
export function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  const today = new Date();
  const dayMs = 24 * 3600 * 1000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / dayMs);
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'amanhã';
  if (diffDays === -1) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Contraste de texto (preto/branco) sobre uma cor hex — para chips de label. */
export function textOn(hex: string): string {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  // Luminância relativa aproximada (fórmula YIQ).
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#000000' : '#ffffff';
}
