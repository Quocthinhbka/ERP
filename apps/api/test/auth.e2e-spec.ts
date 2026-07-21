import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getHttpServer, TEST_ADMIN } from './test-utils';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/login with valid email identifier', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(Array.isArray(res.body.user.permissions)).toBe(true);
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('erp_access='),
        expect.stringContaining('erp_refresh='),
      ]),
    );

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /api/auth/login with valid account code identifier', async () => {
    const usersRes = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const admin = usersRes.body.items.find(
      (u: { email: string }) => u.email === TEST_ADMIN.email,
    );
    expect(admin?.accountCode).toMatch(/^TK-\d{5}$/);

    const res = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: admin.accountCode, password: TEST_ADMIN.password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
  });

  it('POST /api/auth/login with valid phone identifier', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: TEST_ADMIN.phone, password: TEST_ADMIN.password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
  });

  it('POST /api/auth/login with invalid credentials returns 401', async () => {
    await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: TEST_ADMIN.email, password: 'wrong' })
      .expect(401);
  });

  it('GET /api/auth/me returns current user', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(TEST_ADMIN.email);
    expect(res.body.permissions.length).toBeGreaterThan(0);
  });

  it('POST /api/auth/refresh rejects access token', async () => {
    await request(getHttpServer(app))
      .post('/api/auth/refresh')
      .send({ refreshToken: accessToken })
      .expect(401);
  });

  it('POST /api/auth/refresh returns new tokens and rotates', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);

    await request(getHttpServer(app))
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    refreshToken = res.body.refreshToken;
    accessToken = res.body.accessToken;
  });

  it('POST /api/auth/logout revokes refresh token', async () => {
    await request(getHttpServer(app))
      .post('/api/auth/logout')
      .send({ refreshToken })
      .expect(200);

    await request(getHttpServer(app))
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
