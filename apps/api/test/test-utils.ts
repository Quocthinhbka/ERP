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

/** Đảm bảo có ít nhất 1 nhóm quyền để gán khi tạo tài khoản e2e. */
export async function ensureTestPermissionGroup(
  app: INestApplication,
  accessToken: string,
): Promise<string> {
  const list = await request(getHttpServer(app))
    .get('/api/permission-groups')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  if (Array.isArray(list.body) && list.body.length > 0) {
    return list.body[0].id as string;
  }

  const perms = await request(getHttpServer(app))
    .get('/api/permissions')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const setupView = (perms.body.items ?? []).find(
    (p: { code: string }) => p.code === 'setup:view',
  );

  const created = await request(getHttpServer(app))
    .post('/api/permission-groups')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      code: `e2e_basic_${Date.now()}`,
      name: 'E2E Basic',
      permissionIds: setupView ? [setupView.id] : [],
    })
    .expect(201);

  return created.body.id as string;
}

/** Đảm bảo có công ty ACTIVE để gán làm chủ quản hồ sơ e2e. */
export async function ensureTestManagingCompany(
  app: INestApplication,
  accessToken: string,
  namePrefix = 'E2E Managing Co',
): Promise<{ id: string; name: string }> {
  const list = await request(getHttpServer(app))
    .get('/api/organization/companies')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const active = (list.body as Array<{ id: string; name: string; status: string }>).find(
    (c) => c.status === 'ACTIVE',
  );
  if (active) {
    return { id: active.id, name: active.name };
  }

  const created = await request(getHttpServer(app))
    .post('/api/organization/companies')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: `${namePrefix} ${Date.now()}`, status: 'ACTIVE' })
    .expect(201);

  return { id: created.body.id as string, name: created.body.name as string };
}

