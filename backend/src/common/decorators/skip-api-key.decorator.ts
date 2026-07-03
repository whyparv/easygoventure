import { SetMetadata } from '@nestjs/common';

export const SKIP_API_KEY = 'skipApiKey';

/**
 * Exempts a route/controller from the API-key gate (e.g. health checks).
 */
export const SkipApiKey = () => SetMetadata(SKIP_API_KEY, true);
