import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import { ApiError } from '../dto/api-error.dto';

/**
 * Documents the standard error envelope (ApiError) for the common failure codes,
 * so every endpoint advertises its error shape to frontend tooling.
 */
export const ApiStandardErrors = () =>
  applyDecorators(
    ApiExtraModels(ApiError),
    SwaggerApiResponse({ status: 400, description: 'Validation / bad request', type: ApiError }),
    SwaggerApiResponse({ status: 401, description: 'Missing or invalid API key', type: ApiError }),
    SwaggerApiResponse({ status: 404, description: 'Resource not found', type: ApiError }),
    SwaggerApiResponse({ status: 409, description: 'Conflict / duplicate key', type: ApiError }),
    SwaggerApiResponse({ status: 422, description: 'Business rule violation', type: ApiError }),
  );
