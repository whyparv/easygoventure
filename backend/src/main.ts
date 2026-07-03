import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

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

  // Global validation — strip unknown props, transform payloads to DTO instances
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

  await app.listen(appCfg.port);

  const logger = app.get(Logger);
  logger.log(
    `🚀 DMC CRM API [${appCfg.env}] listening on http://localhost:${appCfg.port}/${appCfg.apiPrefix}`,
  );
}

void bootstrap();
