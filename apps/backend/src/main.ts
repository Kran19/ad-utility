import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Global Input Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Utility + Ad Platform API')
    .setDescription('Centralized REST API for Utilities, Ad Delivery Engine, AI Gateway, and Analytics')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Backend server successfully running on port ${port}`);
  logger.log(`API Base URL: http://localhost:${port}/api/v1`);
  logger.log(`API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
