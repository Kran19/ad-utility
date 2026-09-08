import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Validate presence of mandatory configuration in production environment.
 * Strictly adheres to AI constraint: OPENAI_API_KEY is not required and remains deferred.
 */
function validateProductionEnvironment(logger: Logger) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing: string[] = [];

  for (const v of requiredVars) {
    if (!process.env[v] || process.env[v]!.trim().length === 0) {
      missing.push(v);
    }
  }

  if (missing.length > 0) {
    logger.error(`FATAL: Mandatory production environment variables missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  const aiProvider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (aiProvider === 'openai' && !process.env.OPENAI_API_KEY) {
    logger.warn('AI_PROVIDER is set to "openai" but OPENAI_API_KEY is not configured. AI Gateway will fail safely with 503 while non-AI utilities operate normally.');
  } else {
    logger.log(`AI Gateway initialized in mode: ${aiProvider}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  validateProductionEnvironment(logger);

  const app = await NestFactory.create(AppModule, {
    // Base64-encoded file payloads are sent as JSON bodies.
    // A 15MB image → ~20MB base64; a 50MB combined PDF-merge → ~67MB base64.
    // The inner adapters enforce real file-size limits (magic-byte check + byte-count guard).
    // Without this override, NestJS/Express default body-parser limit of 100KB rejects all
    // file-utility requests before they reach the adapter, causing "PayloadTooLargeError".
    bodyParser: true,
  });

  // Raise JSON body size limit to support base64-encoded file payloads.
  // Real per-adapter file-size limits (15MB images / 25MB PDFs / 50MB pdf-merge combined)
  // are enforced inside each adapter — this only allows the request to reach those guards.
  app.getHttpAdapter().getInstance().use(
    require('express').json({ limit: '70mb' }),
  );
  app.getHttpAdapter().getInstance().use(
    require('express').urlencoded({ extended: true, limit: '70mb' }),
  );


  // Enable graceful shutdown hooks for SIGTERM / SIGINT handling
  app.enableShutdownHooks();

  // Disable X-Powered-By header to prevent technology disclosure
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Trust reverse proxy if configured (e.g., Nginx, ALB, Cloudflare)
  if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Request correlation middleware
  app.use(new RequestIdMiddleware().use);

  // Security Headers Middleware
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Cookie Parser Middleware
  app.use(cookieParser());

  // Global REST API Prefix
  app.setGlobalPrefix('api/v1');

  // CORS Policy Configuration
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Request-Id',
  });

  // Global Input Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filter for Sanitized Error Responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Structured Logging Interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger Documentation Setup (Disabled in production unless explicitly enabled via ENABLE_SWAGGER=true)
  const isSwaggerEnabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
  if (isSwaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Utility + Ad Platform API')
      .setDescription('Centralized REST API for Utilities, Ad Delivery Engine, AI Gateway, and Analytics')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Backend server successfully running on port ${port}`);
  logger.log(`API Base URL: http://localhost:${port}/api/v1`);
  if (isSwaggerEnabled) {
    logger.log(`API Documentation: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
