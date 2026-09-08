import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    let requestId: string;

    if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
      // Sanitize incoming correlation ID: alphanumeric, dash, underscore, max 64 chars
      const sanitized = rawHeader.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
      requestId = sanitized.length > 0 ? sanitized : randomUUID();
    } else {
      requestId = randomUUID();
    }

    req.headers['x-request-id'] = requestId;
    (req as any).id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
