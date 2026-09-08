import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('SecurityExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as any).id ||
      'unknown_req';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      // Securely log unexpected runtime/database errors with correlation ID
      this.logger.error(
        `[${requestId}] [${request.method}] ${request.url} - Unhandled Error: ${exception.message}`,
        exception.stack,
      );
      // Explicitly mask internal error details in public HTTP response
      message = 'An unexpected internal error occurred';
      error = 'InternalServerError';
    } else {
      this.logger.error(
        `[${requestId}] [${request.method}] ${request.url} - Unhandled non-error exception`,
      );
      message = 'An unexpected internal error occurred';
      error = 'InternalServerError';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
