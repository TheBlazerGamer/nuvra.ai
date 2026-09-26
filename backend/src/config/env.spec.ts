import { validarAmbiente } from './env.js';

const base = {
  DB_APP_URL: 'postgresql://nuvra_app:senha@127.0.0.1:5432/nuvra',
  DB_SYSTEM_URL: 'postgresql://nuvra_system:senha@127.0.0.1:5432/nuvra',
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('validarAmbiente', () => {
  it('aceita a configuração correta', () => {
    expect(() => validarAmbiente(base)).not.toThrow();
  });

  it('recusa subir com o papel dono do banco no lugar de nuvra_app (desligaria o RLS)', () => {
    expect(() =>
      validarAmbiente({ ...base, DB_APP_URL: 'postgresql://nuvra_owner:senha@127.0.0.1:5432/nuvra' }),
    ).toThrow(/nuvra_app/);
  });

  it('recusa variáveis ausentes', () => {
    expect(() => validarAmbiente({ DB_APP_URL: base.DB_APP_URL, WEB_ORIGIN: base.WEB_ORIGIN })).toThrow(
      /DB_SYSTEM_URL/,
    );
  });

  it('exige WEB_ORIGIN (sem ela a checagem anti-CSRF ficaria aberta)', () => {
    expect(() => validarAmbiente({ ...base, WEB_ORIGIN: undefined })).toThrow(/WEB_ORIGIN/);
  });

  const producao = {
    ...base,
    NODE_ENV: 'production',
    WEB_ORIGIN: 'https://app.exemplo.com',
    EMAIL_TRANSPORT: 'smtp',
    SMTP_HOST: 'smtp.exemplo.com',
    SMTP_USER: 'usuario',
    SMTP_PASS: 'senha',
    EMAIL_FROM: 'Nuvra.AI <nao-responda@exemplo.com>',
  };

  it('em produção exige WEB_ORIGIN em https', () => {
    expect(() => validarAmbiente({ ...producao, WEB_ORIGIN: 'http://app.exemplo.com' })).toThrow(/https/);
    expect(() => validarAmbiente(producao)).not.toThrow();
  });

  it('em produção exige e-mail real por SMTP (o transporte de arquivo é só de desenvolvimento)', () => {
    expect(() => validarAmbiente({ ...producao, EMAIL_TRANSPORT: 'arquivo' })).toThrow(/smtp/);
    expect(() => validarAmbiente({ ...producao, SMTP_PASS: undefined })).toThrow(/SMTP_PASS/);
  });

  it('em produção não deixa desligar a checagem de senhas vazadas', () => {
    expect(() => validarAmbiente({ ...producao, SENHAS_VAZADAS: 'desligado' })).toThrow(/SENHAS_VAZADAS/);
  });
});
