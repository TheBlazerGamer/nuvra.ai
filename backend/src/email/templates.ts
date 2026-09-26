import type { MensagemEmail } from './email.transport.js';

type Conteudo = Omit<MensagemEmail, 'para'>;

const escapar = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function moldura(titulo: string, paragrafos: string[], botao?: { texto: string; url: string }): string {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`).join('');
  const acao = botao
    ? `<p style="margin:22px 0"><a href="${escapar(botao.url)}" style="background:#1747E9;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapar(botao.texto)}</a></p>`
    : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#E5E5E5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#010C28">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
<div style="background:#010C28;color:#ffffff;padding:18px 24px;font-weight:700;letter-spacing:.5px">NUVRA.AI</div>
<div style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${escapar(titulo)}</h1>${corpo}${acao}</div>
<div style="padding:14px 24px;font-size:12px;color:#666E82;border-top:1px solid #E5E5E5">Se você não reconhece esta mensagem, pode ignorá-la com segurança.</div>
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
      ['Alguém (talvez você) tentou criar uma conta na Nuvra.AI com este e-mail, mas ele já está cadastrado.', `Se esqueceu a senha, <a href="${escapar(urlRecuperar)}">redefina aqui</a>. Se não foi você, nenhuma ação é necessária: sua conta continua segura.`],
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
