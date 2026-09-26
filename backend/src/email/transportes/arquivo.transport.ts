import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { EmailTransport, MensagemEmail } from '../email.transport.js';

// Só para desenvolvimento: em vez de enviar de verdade, grava cada e-mail em uma pasta local
// (fora do git) para você abrir o link de verificação/recuperação. Em produção é proibido (ver env.ts).
export class ArquivoTransport implements EmailTransport {
  private readonly pasta: string;

  constructor(pasta = '.emails-dev') {
    this.pasta = resolve(pasta);
  }

  async enviar(mensagem: MensagemEmail): Promise<void> {
    await mkdir(this.pasta, { recursive: true });
    const nome = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}.json`;
    await writeFile(join(this.pasta, nome), JSON.stringify(mensagem, null, 2), 'utf-8');
  }
}
