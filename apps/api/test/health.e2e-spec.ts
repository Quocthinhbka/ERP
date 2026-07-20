import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getHttpServer } from './test-utils';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns status', async () => {
    const res = await request(getHttpServer(app)).get('/api/health').expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
    expect(res.body.services).toHaveProperty('redis');
  });
});
