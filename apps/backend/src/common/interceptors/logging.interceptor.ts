import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req as any).id ||
      'unknown_req';
    const method = req.method;
    const url = req.originalUrl || req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode;
          // Structured non-sensitive logging
          this.logger.log(
            `[${requestId}] ${method} ${url} ${statusCode} - ${durationMs}ms`,
          );
        },
        error: (err: any) => {
          const durationMs = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logger.warn(
            `[${requestId}] ${method} ${url} ${statusCode} - ${durationMs}ms - Error: ${err.message || 'Unknown'}`,
          );
        },
      }),
    );
  }
}
