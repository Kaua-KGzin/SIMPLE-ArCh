import { CryptoUtil } from './crypto.util';
import * as crypto from 'crypto';

describe('CryptoUtil', () => {
  beforeAll(() => {
    // Chave de teste (32 bytes em hex).
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  it('faz round-trip: decrypt(encrypt(x)) === x', () => {
    const original = 'gho_tokenSecretoDoGitHub123';
    const cipher = CryptoUtil.encrypt(original);
    expect(cipher).not.toContain(original); // não vaza o texto puro
    expect(CryptoUtil.decrypt(cipher)).toBe(original);
  });

  it('gera ciphertexts diferentes para o mesmo texto (IV aleatório)', () => {
    const a = CryptoUtil.encrypt('mesmo');
    const b = CryptoUtil.encrypt('mesmo');
    expect(a).not.toBe(b);
  });

  it('detecta adulteração (authTag GCM) e lança erro', () => {
    const cipher = CryptoUtil.encrypt('intacto');
    const [iv, tag, data] = cipher.split(':');
    const adulterado = `${iv}:${tag}:${data.replace(/.$/, '0')}`;
    expect(() => CryptoUtil.decrypt(adulterado)).toThrow();
  });
});
