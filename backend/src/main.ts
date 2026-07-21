import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Structured logging (pino) as the app logger
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appCfg = config.get('app') as {
    port: number;
    apiPrefix: string;
    allowedOrigins: string[];
    swaggerEnabled: boolean;
    env: string;
  };

  // Security & performance middleware
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: appCfg.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Routing
  app.setGlobalPrefix(appCfg.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global validation - strip unknown props, transform payloads to DTO instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  if (appCfg.swaggerEnabled) {
    setupSwagger(app, appCfg.apiPrefix);
  }

  // Serve React frontend when public/ exists (populated by Docker build)
  const publicPath = join(__dirname, '..', 'public');
  if (existsSync(publicPath)) {
    app.useStaticAssets(publicPath);
    // SPA fallback: non-API routes serve index.html so React Router works
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith(`/${appCfg.apiPrefix}`)) return next();
      res.sendFile('index.html', { root: publicPath });
    });
  }

  const server = await app.listen(appCfg.port);
  // Keep-alive must exceed the longest AI request (Groq timeout = 30s).
  // Express defaults to 5s which causes "socket hang up" on slow AI calls.
  server.keepAliveTimeout = 35_000;
  server.headersTimeout = 36_000;

  const logger = app.get(Logger);
  logger.log(
    `🚀 DMC CRM API [${appCfg.env}] listening on http://localhost:${appCfg.port}/${appCfg.apiPrefix}`,
  );
}

void bootstrap();
