import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { ApiKeyGuard } from './guards/api-key.guard';

/**
 * Registers cross-cutting concerns once: global exception filter, response
 * envelope, and the API-key gate.
 */
@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class CommonModule {}
