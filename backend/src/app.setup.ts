import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

// Configuração comum da API (usada no main.ts e nos testes, para testar exatamente o que roda em produção).
export function configurarApp(app: NestExpressApplication) {
  // Atrás do proxy reverso (Traefik/Nginx) o IP real vem do cabeçalho; sem isso, todos pareceriam ter o mesmo IP.
  const proxies = Number(process.env.TRUST_PROXY ?? 0);
  if (proxies > 0) app.set('trust proxy', proxies);

  app.disable('x-powered-by');
  app.use(helmet());

  // Respostas de autenticação (perfil, sessões...) nunca podem ficar em cache do navegador ou de proxies.
  app.use('/auth', (_req: Request, res: Response, proximo: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    proximo();
  });

  // Corpo pequeno: nenhuma rota atual precisa de mais que isso, e limita abuso de memória.
  app.useBodyParser('json', { limit: '20kb' });
  app.useBodyParser('urlencoded', { limit: '20kb', extended: false });

  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
