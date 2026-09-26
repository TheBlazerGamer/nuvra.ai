import 'dotenv/config';
import { SmtpTransport } from '../src/email/transportes/smtp.transport.js';

// Uso: npm run email:teste -- seu-email@exemplo.com
// Lê SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_FROM do .env. Nunca imprime senha nem chave.
const destino = process.argv[2];
if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
  console.error('Informe um e-mail de destino válido. Exemplo: npm run email:teste -- voce@exemplo.com');
  process.exit(1);
}

const faltando = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'].filter((v) => !process.env[v]);
if (faltando.length > 0) {
  console.error(`Faltam no .env: ${faltando.join(', ')}`);
  process.exit(1);
}

const transporte = new SmtpTransport(
  {
    host: process.env.SMTP_HOST!,
    porta: Number(process.env.SMTP_PORT ?? 587),
    usuario: process.env.SMTP_USER!,
    senha: process.env.SMTP_PASS!,
  },
  process.env.EMAIL_FROM!,
);

function explicar(erro: unknown): string {
  const e = erro as { responseCode?: number; code?: string; message?: string };
  if (e.responseCode === 535 || e.code === 'EAUTH') {
    return 'Login recusado. Confira SMTP_USER (o "login" da página SMTP do Brevo) e SMTP_PASS (a CHAVE SMTP, não a senha da conta).';
  }
  if (e.code === 'ESOCKET' || e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION') {
    return 'Não foi possível conectar. Confira SMTP_HOST e SMTP_PORT (587) e se sua rede não bloqueia a porta.';
  }
  if (e.responseCode === 550 || e.responseCode === 553 || e.responseCode === 554) {
    return 'O servidor recusou o remetente. O e-mail de EMAIL_FROM precisa estar cadastrado e validado em "Remetentes" no Brevo.';
  }
  return e.message ?? 'Erro desconhecido.';
}

try {
  await transporte.verificar();
  console.log('1/2 Conexão e login no servidor SMTP: OK');

  await transporte.enviar({
    para: destino,
    assunto: 'Teste de e-mail da Nuvra.AI',
    texto: 'Se você recebeu esta mensagem, o envio de e-mails da Nuvra.AI está funcionando.',
    html: '<p>Se você recebeu esta mensagem, o envio de e-mails da <strong>Nuvra.AI</strong> está funcionando.</p>',
  });
  console.log(`2/2 E-mail de teste enviado para ${destino}. Confira a caixa de entrada e o spam.`);
} catch (erro) {
  console.error(`Falhou: ${explicar(erro)}`);
  process.exit(1);
}
