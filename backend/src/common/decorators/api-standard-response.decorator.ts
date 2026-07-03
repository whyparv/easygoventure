import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse as SwaggerApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponse } from '../dto/api-response.dto';
import { PaginationMeta } from '../dto/paginated-response.dto';

interface StandardResponseOptions {
  /** Document the payload as `{ items, meta }` instead of a single object. */
  paginated?: boolean;
  /** Document the payload as a bare array of the model. */
  array?: boolean;
  status?: number;
  description?: string;
}

/**
 * Documents the standard success envelope `{ success, data, message, timestamp }`
 * with `data` typed as the given model (or `{ items: Model[], meta }` when paginated).
 * This lets frontend tooling generate response types directly from Swagger.
 */
export const ApiStandardResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options: StandardResponseOptions = {},
) => {
  const { paginated = false, array = false, status = HttpStatus.OK, description } = options;

  let dataSchema: Record<string, unknown>;
  if (paginated) {
    dataSchema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: getSchemaPath(model) } },
        meta: { $ref: getSchemaPath(PaginationMeta) },
      },
    };
  } else if (array) {
    dataSchema = { type: 'array', items: { $ref: getSchemaPath(model) } };
  } else {
    dataSchema = { $ref: getSchemaPath(model) };
  }

  return applyDecorators(
    ApiExtraModels(ApiResponse, PaginationMeta, model),
    SwaggerApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponse) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
};
