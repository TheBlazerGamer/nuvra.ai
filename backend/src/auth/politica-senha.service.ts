import { BadRequestException, Injectable } from '@nestjs/common';
import { SenhaVazadaService } from './senha-vazada.service.js';

// Tamanho mínimo/máximo já é validado nos DTOs. Aqui ficam as regras que dependem do contexto.
@Injectable()
export class PoliticaSenhaService {
  constructor(private readonly vazadas: SenhaVazadaService) {}

  async validar(senha: string, email: string): Promise<void> {
    if (senha.toLowerCase() === email.toLowerCase()) {
      throw new BadRequestException('A senha não pode ser igual ao e-mail.');
    }
    if (await this.vazadas.estaVazada(senha)) {
      throw new BadRequestException(
        'Essa senha já apareceu em vazamentos de dados. Escolha outra, de preferência uma frase longa.',
      );
    }
  }
}
