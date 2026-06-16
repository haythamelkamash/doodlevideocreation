import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);
  const isDev = config.get('NODE_ENV') !== 'production';

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', '*.amazonaws.com', '*.cloudfront.net'],
        mediaSrc: ["'self'", '*.amazonaws.com', '*.cloudfront.net'],
        connectSrc: ["'self'", 'wss:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.enableCors({
    origin: config.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Global pipes / filters / interceptors ─────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new AuditInterceptor());

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', { exclude: ['/health', '/graphql'] });

  // ── Swagger (dev only) ────────────────────────────────────────────────────
  if (isDev) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Doodle Video Creator API')
      .setDescription('Enterprise doodle video creation platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & authorization')
      .addTag('projects', 'Project management')
      .addTag('scenes', 'Scene & element management')
      .addTag('assets', 'Asset library')
      .addTag('export', 'Video export jobs')
      .addTag('audio', 'Audio & TTS')
      .addTag('ai', 'AI features')
      .addTag('billing', 'Subscriptions & billing')
      .addTag('templates', 'Template marketplace')
      .addTag('teams', 'Team collaboration')
      .addTag('oil-gas', 'Oil & Gas training module')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  // ── Health check ──────────────────────────────────────────────────────────
  const { default: express } = await import('express');
  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: process.env.npm_package_version });
  });

  await app.listen(port);
  logger.log(`API running on http://localhost:${port}`);
  logger.log(`Environment: ${config.get('NODE_ENV', 'development')}`);
}

bootstrap();
