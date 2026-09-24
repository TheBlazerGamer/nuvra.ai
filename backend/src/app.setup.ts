import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Configuração comum da API (usada no main.ts e nos testes, para testar exatamente o que roda em produção).
export function configurarApp(app: NestExpressApplication) {
  // Atrás do proxy reverso (Traefik/Nginx) o IP real vem do cabeçalho; sem isso, todos pareceriam ter o mesmo IP.
  const proxies = Number(process.env.TRUST_PROXY ?? 0);
  if (proxies > 0) app.set('trust proxy', proxies);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
