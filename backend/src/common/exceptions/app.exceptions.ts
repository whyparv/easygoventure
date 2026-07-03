import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * MVP-facing exceptions. All extend DomainException so the global
 * AllExceptionsFilter renders them in the standard ApiError envelope with a
 * stable machine `code`.
 */

/** A business rule was violated (request understood but cannot proceed). */
export class BusinessException extends DomainException {
  constructor(message: string, code = 'BUSINESS_ERROR') {
    super(message, code, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/** A referenced resource does not exist. */
export class NotFoundException extends DomainException {
  constructor(message: string, code = 'NOT_FOUND') {
    super(message, code, HttpStatus.NOT_FOUND);
  }
}

/** Input failed a domain-level validation check (beyond DTO validation). */
export class ValidationException extends DomainException {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, code, HttpStatus.BAD_REQUEST);
  }
}
