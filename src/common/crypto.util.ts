import * as crypto from 'crypto';

/**
 * CryptoUtil — criptografia simétrica para dados sensíveis em repouso.
 *
 * POR QUÊ AES-256-GCM?
 *  - AES-256: padrão forte de criptografia simétrica.
 *  - GCM (Galois/Counter Mode): além de criptografar, gera um "authTag" que
 *    DETECTA adulteração. Ou seja, garante confidencialidade E integridade.
 *
 * A chave (ENCRYPTION_KEY) deve ter 32 bytes (256 bits), vinda de variável de
 * ambiente — NUNCA hardcoded. Gere com:  openssl rand -hex 32
 *
 * Formato do texto cifrado guardado no banco:  iv:authTag:ciphertext  (todos em hex)
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';

  private static getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || Buffer.from(key, 'hex').length !== 32) {
      throw new Error('ENCRYPTION_KEY ausente ou inválida (esperado 32 bytes em hex).');
    }
    return Buffer.from(key, 'hex');
  }

  static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96 bits, recomendado para GCM
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  static decrypt(payload: string): string {
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Formato de ciphertext inválido.');
    }
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      this.getKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
