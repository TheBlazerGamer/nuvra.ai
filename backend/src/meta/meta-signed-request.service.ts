import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface DadosSignedRequest {
  userId: string;
}

// Os avisos da Meta (desautorização e exclusão de dados) chegam como "signed_request":
// "<assinatura>.<dados>", ambos em base64url. A assinatura é um HMAC-SHA256 dos dados feito com o
// App Secret — só a Meta e nós o conhecemos. Sem conferir isso, qualquer pessoa na internet poderia
// mandar "apague a conexão do usuário X".
@Injectable()
export class MetaSignedRequestService {
  constructor(private readonly config: ConfigService) {}

  verificar(signedRequest: unknown): DadosSignedRequest | null {
    if (typeof signedRequest !== 'string' || signedRequest.length > 4096) return null;

    const partes = signedRequest.split('.');
    if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
    const [assinaturaB64, dadosB64] = partes;

    const esperada = createHmac('sha256', this.config.getOrThrow<string>('META_APP_SECRET')).update(dadosB64).digest();
    const recebida = Buffer.from(assinaturaB64, 'base64url');
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

    try {
      const dados = JSON.parse(Buffer.from(dadosB64, 'base64url').toString('utf8')) as {
        algorithm?: string;
        user_id?: unknown;
      };
      if (dados.algorithm?.toUpperCase() !== 'HMAC-SHA256') return null;
      if (typeof dados.user_id !== 'string' || dados.user_id.length === 0 || dados.user_id.length > 64) return null;
      return { userId: dados.user_id };
    } catch {
      return null;
    }
  }
}
