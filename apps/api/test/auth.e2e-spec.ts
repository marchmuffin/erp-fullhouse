import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app.helper';
import { seedTestData, cleanDatabase } from './helpers/db.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    const seeded = await seedTestData();
    tenantId = seeded.tenant.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('valid credentials → 200 with tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@e2e.local', password: 'Test@123' })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('wrong password → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@e2e.local', password: 'WrongPassword' })
        .expect(401);
    });

    it('non-existent email → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@e2e.local', password: 'Test@123' })
        .expect(401);
    });

    it('missing fields → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@e2e.local' })
        .expect(400);
    });

    it('empty body → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('valid refresh token → 200 with new access token', async () => {
      // Ensure we have a refreshToken from the login test
      expect(refreshToken).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('invalid token → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });

    it('missing refresh token → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('with valid token → 200 with user info', async () => {
      expect(accessToken).toBeDefined();

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // The /me endpoint returns the JWT payload directly
      expect(res.body).toBeDefined();
    });

    it('without token → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('with invalid token → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('valid token → 204 no content', async () => {
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);
    });

    it('without token → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });
});
