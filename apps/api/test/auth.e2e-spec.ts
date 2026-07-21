import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getHttpServer } from './test-utils';

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
      .send({ identifier: 'admin@hyperlabs.vn', password: 'Admin@123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('admin@hyperlabs.vn');
    expect(Array.isArray(res.body.user.permissions)).toBe(true);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /api/auth/login with valid employee code identifier', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: 'NV001', password: 'Admin@123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('admin@hyperlabs.vn');
  });

  it('POST /api/auth/login with valid phone identifier', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: '0900000001', password: 'Admin@123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('admin@hyperlabs.vn');
  });

  it('POST /api/auth/login with invalid credentials returns 401', async () => {
    await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: 'admin@hyperlabs.vn', password: 'wrong' })
      .expect(401);
  });

  it('GET /api/auth/me returns current user', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe('admin@hyperlabs.vn');
    expect(res.body.permissions.length).toBeGreaterThan(0);
  });

  it('POST /api/auth/refresh returns new tokens', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });
});
