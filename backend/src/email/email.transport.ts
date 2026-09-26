export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export interface EmailTransport {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');
