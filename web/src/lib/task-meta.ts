import type { TaskPriority, TaskStatus } from '../types';

/**
 * Metadados de prioridade — cores em OKLCH (mais uniformes em tela dark).
 * Média puxa para violeta (290) alinhando à marca; alta laranja, urgente vermelho.
 */
export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string; bg: string; border: string; order: number }
> = {
  URGENT: { label: 'Urgente', color: 'oklch(72% 0.19 25)',  bg: 'oklch(27% 0.05 25)',   border: 'oklch(40% 0.09 25)',   order: 0 },
  HIGH:   { label: 'Alta',    color: 'oklch(76% 0.15 55)',  bg: 'oklch(27% 0.045 55)',  border: 'oklch(40% 0.08 55)',   order: 1 },
  MEDIUM: { label: 'Média',   color: 'oklch(76% 0.16 290)', bg: 'oklch(27% 0.05 290)',  border: 'oklch(40% 0.09 290)',  order: 2 },
  LOW:    { label: 'Baixa',   color: 'oklch(66% 0.02 290)', bg: 'oklch(24% 0.01 290)',  border: 'oklch(34% 0.015 290)', order: 3 },
};

export const PRIORITY_ORDER: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** Colunas do board com rótulo e cor do "dot" (OKLCH). */
export const COLUMN_META: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'BACKLOG',     label: 'Backlog',      dot: 'oklch(62% 0.02 290)' },
  { status: 'TODO',        label: 'A Fazer',      dot: 'oklch(72% 0.15 250)' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', dot: 'oklch(80% 0.15 85)' },
  { status: 'IN_REVIEW',   label: 'Em Revisão',   dot: 'oklch(72% 0.19 300)' },
  { status: 'DONE',        label: 'Concluído',    dot: 'oklch(76% 0.14 155)' },
];

/** Estado do prazo relativo a agora — dirige a cor no card. */
export function dueState(dueDate: string | null | undefined): 'none' | 'overdue' | 'soon' | 'later' {
  if (!dueDate) return 'none';
  const diffMs = new Date(dueDate).getTime() - Date.now();
  if (diffMs < 0) return 'overdue';
  if (diffMs < 48 * 3600 * 1000) return 'soon';
  return 'later';
}

/** Cor (bg/texto) do badge de prazo por estado. */
export const DUE_STYLE: Record<'overdue' | 'soon' | 'later', { bg: string; color: string }> = {
  overdue: { bg: 'oklch(27% 0.05 25)',  color: 'oklch(72% 0.19 25)' },
  soon:    { bg: 'oklch(27% 0.05 85)',  color: 'oklch(80% 0.15 85)' },
  later:   { bg: '#191921',             color: '#8f8da0' },
};

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
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#000000' : '#ffffff';
}
