const PAPEL_ESPERADO: Record<string, string> = {
  DB_APP_URL: 'nuvra_app',
  DB_SYSTEM_URL: 'nuvra_system',
};

// Falha na subida (e não em produção, às 3h da manhã) se o ambiente estiver mal configurado.
// Em especial: impede que o servidor rode com o papel errado (ex.: dono do banco no lugar de nuvra_app),
// o que desligaria silenciosamente a proteção por cliente.
export function validarAmbiente(config: Record<string, unknown>): Record<string, unknown> {
  const erros: string[] = [];

  for (const [variavel, papel] of Object.entries(PAPEL_ESPERADO)) {
    const valor = config[variavel];
    if (typeof valor !== 'string' || valor.length === 0) {
      erros.push(`${variavel} não está definida.`);
      continue;
    }

    let usuario: string;
    try {
      usuario = decodeURIComponent(new URL(valor).username);
    } catch {
      erros.push(`${variavel} não é uma URL de conexão válida.`);
      continue;
    }

    if (usuario !== papel) {
      erros.push(`${variavel} deve usar o papel "${papel}" (encontrado: "${usuario}").`);
    }
  }

  const origem = config.WEB_ORIGIN;
  if (typeof origem !== 'string' || origem.length === 0) {
    erros.push('WEB_ORIGIN não está definida (origem do site, usada em CORS e na checagem anti-CSRF).');
  } else if (config.NODE_ENV === 'production' && !origem.startsWith('https://')) {
    erros.push('WEB_ORIGIN deve ser uma origem https:// em produção.');
  }

  if (config.NODE_ENV === 'production') {
    if (config.EMAIL_TRANSPORT !== 'smtp') {
      erros.push('EMAIL_TRANSPORT deve ser "smtp" em produção (o transporte de arquivo é só para desenvolvimento).');
    }
    for (const variavel of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']) {
      if (typeof config[variavel] !== 'string' || config[variavel] === '') {
        erros.push(`${variavel} não está definida.`);
      }
    }
    if (config.SENHAS_VAZADAS === 'desligado') {
      erros.push('SENHAS_VAZADAS não pode estar desligado em produção.');
    }
    for (const variavel of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET']) {
      if (typeof config[variavel] !== 'string' || config[variavel] === '') {
        erros.push(`${variavel} não está definida.`);
      }
    }
    for (const variavel of ['META_APP_ID', 'META_APP_SECRET', 'META_TOKEN_ENCRYPTION_KEY', 'API_ORIGIN']) {
      if (typeof config[variavel] !== 'string' || config[variavel] === '') {
        erros.push(`${variavel} não está definida.`);
      }
    }
  }

  const chaveMeta = config.META_TOKEN_ENCRYPTION_KEY;
  if (typeof chaveMeta === 'string' && chaveMeta.length > 0 && Buffer.from(chaveMeta, 'base64').length !== 32) {
    erros.push('META_TOKEN_ENCRYPTION_KEY deve ser uma chave de 32 bytes em base64.');
  }

  if (erros.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n- ${erros.join('\n- ')}`);
  }

  return config;
}
