import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { configurations } from './configuration';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      // Local untracked `.env` (real secrets) takes precedence; the committed
      // `.env.<NODE_ENV>` provides non-secret defaults / placeholders only.
      envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`],
      validate: validateEnv,
      load: configurations,
    }),
  ],
})
export class AppConfigModule {}
