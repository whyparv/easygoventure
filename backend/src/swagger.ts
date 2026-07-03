import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts interactive API docs at `/<apiPrefix>/docs`.
 */
export function setupSwagger(app: INestApplication, apiPrefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('DMC CRM API')
    .setDescription(
      'B2B Travel Operations CRM — REST API.\n\n' +
        `All endpoints are served under \`/${apiPrefix}/v1\`. ` +
        'Every response uses the envelope `{ success, data, message, timestamp }`; ' +
        'paginated endpoints return `data: { items, meta }`.',
    )
    .setVersion('1.0.0')
    // Controller paths are documented relative to this server prefix (global prefix + URI version).
    .addServer(`/${apiPrefix}/v1`)
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Apply the API-key requirement to every documented operation.
  document.security = [{ 'api-key': [] }];
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
