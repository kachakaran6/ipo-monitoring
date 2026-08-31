export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly isOperational: boolean = true;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidPANError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'INVALID_PAN';

  constructor(message: string = 'The provided PAN number is invalid') {
    super(message);
  }
}

export class ProviderUnavailableError extends AppError {
  public readonly statusCode = 503;
  public readonly errorCode = 'PROVIDER_UNAVAILABLE';

  constructor(public readonly providerName: string, message?: string) {
    super(message || `Provider '${providerName}' is currently unavailable`);
  }
}

export class ProviderRateLimitError extends AppError {
  public readonly statusCode = 429;
  public readonly errorCode = 'PROVIDER_RATE_LIMIT';

  constructor(public readonly providerName: string, public readonly retryAfterSeconds: number = 60) {
    super(`Rate limit exceeded for provider '${providerName}'. Retry after ${retryAfterSeconds}s`);
  }
}

export class ProviderCaptchaRequiredError extends AppError {
  public readonly statusCode = 503;
  public readonly errorCode = 'PROVIDER_CAPTCHA_REQUIRED';

  constructor(public readonly providerName: string, public readonly verificationUrl?: string) {
    super(`Provider '${providerName}' requires manual CAPTCHA verification`);
  }
}

export class ProviderAuthError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'PROVIDER_AUTH_ERROR';

  constructor(public readonly providerName: string, message?: string) {
    super(message || `Authentication failed for provider '${providerName}'`);
  }
}

export class IPOUnavailableError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'IPO_UNAVAILABLE';

  constructor(public readonly ipoId: string) {
    super(`IPO with identifier '${ipoId}' was not found or is inactive`);
  }
}

export class AllotmentNotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'ALLOTMENT_NOT_FOUND';

  constructor(message: string = 'No allotment or application record found for this PAN') {
    super(message);
  }
}

export class DataSourceError extends AppError {
  public readonly statusCode = 502;
  public readonly errorCode = 'DATA_SOURCE_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class NotificationError extends AppError {
  public readonly statusCode = 502;
  public readonly errorCode = 'NOTIFICATION_ERROR';

  constructor(public readonly channel: string, message: string) {
    super(`Failed to send notification via ${channel}: ${message}`);
  }
}

export class JobTimeoutError extends AppError {
  public readonly statusCode = 504;
  public readonly errorCode = 'JOB_TIMEOUT';

  constructor(public readonly jobId: string) {
    super(`Job '${jobId}' timed out before completion`);
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized request') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN';

  constructor(message: string = 'Access forbidden') {
    super(message);
  }
}
