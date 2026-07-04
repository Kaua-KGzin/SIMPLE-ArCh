import { resolveAllowedOrigins } from './cors.util';

describe('resolveAllowedOrigins', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => {
    process.env.FRONTEND_URL = original;
  });

  it('lança se FRONTEND_URL não estiver definida (falha fechado, não abre pra qualquer origem)', () => {
    delete process.env.FRONTEND_URL;
    expect(() => resolveAllowedOrigins()).toThrow();
  });

  it('lança se FRONTEND_URL estiver vazia', () => {
    process.env.FRONTEND_URL = '   ';
    expect(() => resolveAllowedOrigins()).toThrow();
  });

  it('devolve uma única origem', () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(resolveAllowedOrigins()).toEqual(['https://app.example.com']);
  });

  it('aceita múltiplas origens separadas por vírgula', () => {
    process.env.FRONTEND_URL = 'https://app.example.com, https://preview.example.com';
    expect(resolveAllowedOrigins()).toEqual([
      'https://app.example.com',
      'https://preview.example.com',
    ]);
  });
});
