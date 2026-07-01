/**
 * Funções puras para extrair referências de Task a partir de um PR.
 * Sem dependências externas → fáceis de testar isoladamente.
 */

/**
 * Extrai todos os números de task referenciados em um texto.
 * Reconhece:
 *   - "#123"                  (corpo/título: "Closes #42")
 *   - ".../123-..." ou "/123" (nomes de branch: "feature/issue-12", "fix/7-bug")
 */
export function extractTaskNumbers(...sources: (string | null | undefined)[]): number[] {
  const haystack = sources.filter(Boolean).join('\n');
  const found = new Set<number>();

  const regex = /#(\d+)|\/(?:issue-)?(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(haystack)) !== null) {
    const num = Number(match[1] ?? match[2]);
    if (!Number.isNaN(num) && num > 0) found.add(num);
  }

  return Array.from(found);
}
