import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for all business/domain errors.
 *
 * Domain modules throw subclasses of this instead of leaking raw HttpExceptions,
 * keeping HTTP concerns at the edge and giving every error a stable machine code.
 */
export class DomainException extends HttpException {
  readonly code: string;

  constructor(
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ message, code }, status);
    this.code = code;
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} with id "${id}" was not found` : `${entity} was not found`,
      'ENTITY_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class EntityConflictException extends DomainException {
  constructor(message: string) {
    super(message, 'ENTITY_CONFLICT', HttpStatus.CONFLICT);
  }
}

export class BusinessRuleViolationException extends DomainException {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super(message, code, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
