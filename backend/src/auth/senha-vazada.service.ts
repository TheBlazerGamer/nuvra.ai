import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

// Consulta a base pública "Have I Been Pwned" por k-anonimato: só os 5 primeiros caracteres do SHA-1
// da senha saem daqui; a senha (e o hash completo) nunca são enviados. Se o serviço estiver fora do ar,
// o cadastro segue normalmente (a checagem é uma camada extra, não pode derrubar o login).
@Injectable()
export class SenhaVazadaService {
  private readonly logger = new Logger(SenhaVazadaService.name);

  constructor(private readonly config: ConfigService) {}

  async estaVazada(senha: string): Promise<boolean> {
    if (this.config.get<string>('SENHAS_VAZADAS') === 'desligado') return false;

    const sha1 = createHash('sha1').update(senha).digest('hex').toUpperCase();
    const prefixo = sha1.slice(0, 5);
    const sufixo = sha1.slice(5);

    try {
      const resposta = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(3000),
      });
      if (!resposta.ok) return false;

      const texto = await resposta.text();
      return texto.split('\n').some((linha) => {
        const [candidato, ocorrencias] = linha.trim().split(':');
        return candidato === sufixo && Number(ocorrencias) > 0;
      });
    } catch {
      this.logger.warn('Consulta de senhas vazadas indisponível; seguindo sem ela.');
      return false;
    }
  }
}
