import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestAdminCredentials } from './test-admin-env';

export const TEST_ADMIN = getTestAdminCredentials();

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await ensureTestAdmin(app);
  return app;
}

export function getHttpServer(app: INestApplication) {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

/** Tạo Super Admin qua bootstrap nếu DB chưa có user; nếu đã có thì bỏ qua. */
export async function ensureTestAdmin(app: INestApplication) {
  const boot = await request(getHttpServer(app))
    .post('/api/auth/bootstrap')
    .send({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      fullName: TEST_ADMIN.fullName,
      phone: TEST_ADMIN.phone,
    });

  if (boot.status === 200 || boot.status === 403) {
    return;
  }

  throw new Error(
    `Failed to ensure test admin (HTTP ${boot.status}): ${JSON.stringify(boot.body)}`,
  );
}

export async function loginAsAdmin(app: INestApplication): Promise<string> {
  const res = await request(getHttpServer(app))
    .post('/api/auth/login')
    .send({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password })
    .expect(200);

  return res.body.accessToken as string;
}
