import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = config.get<string>('API_CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({ origin: corsOrigin, credentials: true });

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
}

bootstrap();
