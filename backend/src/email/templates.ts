import type { MensagemEmail } from './email.transport.js';

type Conteudo = Omit<MensagemEmail, 'para'>;

const escapar = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// A logo precisa ser um endereço público (o programa de e-mail do cliente baixa a imagem da internet),
// por isso aponta sempre para o site publicado, inclusive nos e-mails gerados em desenvolvimento.
const LOGO_URL = 'https://gestor.gruponuvra.com.br/brand/lockup-paper.png';

// Os programas de e-mail transformam "Nuvra.AI" em link azul (.ai parece um site). O espaço de largura
// zero depois do ponto quebra esse reconhecimento sem mudar nada visível.
const MARCA = 'Nuvra.&#8203;AI';

function moldura(titulo: string, paragrafos: string[], botao?: { texto: string; url: string }): string {
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1b2540">${p}</p>`)
    .join('');
  const acao = botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:#1747E9;border-radius:8px"><a href="${escapar(botao.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none">${escapar(botao.texto)}</a></td></tr></table>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#E5E5E5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#010C28">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
<div style="background:#010C28;padding:26px 28px"><img src="${LOGO_URL}" width="150" alt="Nuvra" style="display:block;width:150px;max-width:100%;height:auto;border:0;color:#ffffff;font-size:20px;font-weight:700"></div>
<div style="padding:32px 28px 24px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px;color:#010C28">${escapar(titulo)}</h1>${corpo}${acao}</div>
<div style="padding:18px 28px;font-size:12px;line-height:1.5;color:#666E82;border-top:1px solid #E5E5E5">Se você não reconhece esta mensagem, pode ignorá-la com segurança.<br>NUVRA LTDA · Linhares/ES</div>
</div></body></html>`;
}

export function emailVerificacao(nome: string, link: string): Conteudo {
  return {
    assunto: 'Confirme seu e-mail na Nuvra.AI',
    texto: `Olá, ${nome}!\n\nConfirme seu e-mail para ativar todos os recursos da sua conta:\n${link}\n\nO link vale por 24 horas e só pode ser usado uma vez.\nSe você não criou uma conta, ignore esta mensagem.`,
    html: moldura(
      'Confirme seu e-mail',
      [`Olá, ${escapar(nome)}!`, 'Confirme seu e-mail para ativar todos os recursos da sua conta. O link vale por 24 horas e só pode ser usado uma vez.'],
      { texto: 'Confirmar e-mail', url: link },
    ),
  };
}

export function emailContaExistente(urlEntrar: string, urlRecuperar: string): Conteudo {
  return {
    assunto: 'Você já tem uma conta na Nuvra.AI',
    texto: `Alguém (talvez você) tentou criar uma conta na Nuvra.AI com este e-mail, mas ele já está cadastrado.\n\nSe foi você, entre na sua conta: ${urlEntrar}\nSe esqueceu a senha, redefina aqui: ${urlRecuperar}\n\nSe não foi você, nenhuma ação é necessária: sua conta continua segura.`,
    html: moldura(
      'Você já tem uma conta',
      [`Alguém (talvez você) tentou criar uma conta na ${MARCA} com este e-mail, mas ele já está cadastrado.`, `Se esqueceu a senha, <a href="${escapar(urlRecuperar)}">redefina aqui</a>. Se não foi você, nenhuma ação é necessária: sua conta continua segura.`],
      { texto: 'Entrar na minha conta', url: urlEntrar },
    ),
  };
}

export function emailRecuperacao(nome: string, link: string): Conteudo {
  return {
    assunto: 'Redefinição de senha da Nuvra.AI',
    texto: `Olá, ${nome}!\n\nRecebemos um pedido para redefinir sua senha:\n${link}\n\nO link vale por 1 hora e só pode ser usado uma vez.\nSe não foi você, ignore esta mensagem: sua senha atual continua valendo.`,
    html: moldura(
      'Redefinição de senha',
      [`Olá, ${escapar(nome)}!`, 'Recebemos um pedido para redefinir sua senha. O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore esta mensagem: sua senha atual continua valendo.'],
      { texto: 'Redefinir senha', url: link },
    ),
  };
}

export function emailSenhaAlterada(nome: string, urlRecuperar: string): Conteudo {
  return {
    assunto: 'Sua senha da Nuvra.AI foi alterada',
    texto: `Olá, ${nome}!\n\nA senha da sua conta foi alterada e todos os outros dispositivos foram desconectados.\n\nSe não foi você, redefina a senha imediatamente: ${urlRecuperar}`,
    html: moldura(
      'Sua senha foi alterada',
      [`Olá, ${escapar(nome)}!`, 'A senha da sua conta foi alterada e os outros dispositivos foram desconectados.', 'Se não foi você, redefina a senha imediatamente.'],
      { texto: 'Redefinir minha senha', url: urlRecuperar },
    ),
  };
}
