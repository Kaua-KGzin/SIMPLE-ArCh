import { extractTaskNumbers } from './task-reference.util';

describe('extractTaskNumbers', () => {
  it('extrai número de "Closes #42" no corpo', () => {
    expect(extractTaskNumbers('Fix login', 'Closes #42', 'main')).toEqual([42]);
  });

  it('extrai número do padrão de branch feature/issue-12', () => {
    expect(extractTaskNumbers('PR', null, 'feature/issue-12')).toEqual([12]);
  });

  it('extrai do padrão fix/7-bug', () => {
    expect(extractTaskNumbers('PR', null, 'fix/7-bug')).toEqual([7]);
  });

  it('deduplica quando o mesmo número aparece em vários lugares', () => {
    expect(extractTaskNumbers('#5', 'ref #5', 'feature/issue-5')).toEqual([5]);
  });

  it('retorna lista vazia quando não há referência', () => {
    expect(extractTaskNumbers('sem ref', 'nada aqui', 'main')).toEqual([]);
  });

  it('captura múltiplos números distintos', () => {
    expect(extractTaskNumbers('Closes #1 and #2', null, 'main').sort()).toEqual([1, 2]);
  });
});
