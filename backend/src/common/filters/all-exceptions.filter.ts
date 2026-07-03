import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../dto/api-error.dto';
import { DomainException } from '../exceptions/domain.exception';

/**
 * Catch-all filter that converts every thrown error into the standard ApiError envelope.
 * Unknown errors are logged with stack and reduced to a 500 without leaking internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, code, message, details } = this.normalize(exception);

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body = new ApiError({
      statusCode,
      code,
      message,
      details,
      path: request.url,
    });

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: string[];
  } {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      let message = exception.message;
      let details: string[] | undefined;

      if (typeof res === 'object' && res !== null) {
        const r = res as { message?: string | string[] };
        if (Array.isArray(r.message)) {
          details = r.message;
          message = 'Validation failed';
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
      }

      return { statusCode: status, code: this.codeFromStatus(status), message, details };
    }

    const mongoMapped = this.normalizeMongoError(exception);
    if (mongoMapped) return mongoMapped;

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  /**
   * Map raw Mongo/Mongoose errors to meaningful HTTP responses instead of 500s.
   * Detected by duck-typing so the filter stays decoupled from the driver.
   */
  private normalizeMongoError(exception: unknown):
    | { statusCode: number; code: string; message: string; details?: string[] }
    | null {
    if (typeof exception !== 'object' || exception === null) return null;
    const err = exception as { name?: string; code?: number; errors?: Record<string, { message?: string }> };

    // Database unreachable (server selection / network / not connected). Surfaces
    // a clear 503 instead of an opaque 500 when Mongo/Atlas can't be reached.
    if (
      err.name === 'MongooseServerSelectionError' ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoNotConnectedError' ||
      err.name === 'MongoTimeoutError'
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is currently unavailable. Please try again shortly.',
      };
    }

    // Duplicate key (unique index violation)
    if (err.code === 11000) {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'DUPLICATE_KEY',
        message: 'A record with the same unique value already exists',
      };
    }

    // Invalid value for a typed path (e.g. malformed ObjectId)
    if (err.name === 'CastError') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'CAST_ERROR',
        message: 'One or more parameters has an invalid format',
      };
    }

    // Schema validation failure
    if (err.name === 'ValidationError') {
      const details = err.errors
        ? Object.values(err.errors).map((e) => e.message ?? 'invalid value')
        : undefined;
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'DB_VALIDATION_ERROR',
        message: 'Database validation failed',
        details,
      };
    }

    return null;
  }

  private codeFromStatus(status: number): string {
    return (HttpStatus[status] ?? 'HTTP_ERROR').toString();
  }
}
