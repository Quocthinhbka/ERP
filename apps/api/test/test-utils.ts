import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

export function getHttpServer(app: INestApplication) {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

export async function loginAsAdmin(app: INestApplication): Promise<string> {
  const res = await request(getHttpServer(app))
    .post('/api/auth/login')
    .send({ identifier: 'admin@hyperlabs.vn', password: 'Admin@123' })
    .expect(200);

  return res.body.accessToken as string;
}
