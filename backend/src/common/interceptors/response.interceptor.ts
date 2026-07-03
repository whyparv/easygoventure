import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';
import { PaginatedResponse } from '../dto/paginated-response.dto';

/**
 * Wraps every controller return value in the single standard envelope:
 *   { success, data, message, timestamp }
 *
 * Paginated results are normalised to `data: { items, meta }` so the frontend
 * consumes one response shape across all endpoints. Values already wrapped in
 * ApiResponse (e.g. controllers that set a custom message) pass through.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof ApiResponse) {
          return data;
        }
        if (data instanceof PaginatedResponse) {
          return new ApiResponse({ items: data.data, meta: data.meta });
        }
        return new ApiResponse(data);
      }),
    );
  }
}
