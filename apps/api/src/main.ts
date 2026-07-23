import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(
    helmet({
      // API phục vụ SPA qua proxy/CORS — không dùng CORP same-origin mặc định.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());

  // Ảnh đại diện nằm ngoài prefix /api để nginx/vite proxy được /uploads/*
  const uploadsRoot = resolve(process.cwd(), '../..', 'uploads');
  if (!existsSync(uploadsRoot)) {
    await mkdir(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
    fallthrough: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = config.get<string>('API_CORS_ORIGIN', 'http://localhost:5173');
  const corsOrigins = Array.from(
    new Set([corsOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']),
  );
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
}

bootstrap();
