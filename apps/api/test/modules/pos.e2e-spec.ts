import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('POS Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let sessionId: string;
  let orderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    const seeded = await seedTestData();
    tenantId = seeded.tenant.id;
    const tokens = await loginUser(app, 'test@e2e.local', 'Test@123');
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POS Sessions ──────────────────────────────────────────────────────────

  describe('POS Sessions', () => {
    describe('POST /api/v1/pos/sessions/open', () => {
      it('open new POS session → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/pos/sessions/open')
          .set(headers(accessToken, tenantId))
          .send({
            cashierName: 'E2E Cashier',
            openingCash: 5000,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.status).toBe('open');
        expect(res.body.data.cashierName).toBe('E2E Cashier');
        sessionId = res.body.data.id;
      });

      it('missing cashierName → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/pos/sessions/open')
          .set(headers(accessToken, tenantId))
          .send({ openingCash: 1000 })
          .expect(400);
      });
    });

    describe('GET /api/v1/pos/sessions', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/pos/sessions')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.items.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/v1/pos/sessions/active', () => {
      it("get active session for current user → 200", async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/pos/sessions/active')
          .set(headers(accessToken, tenantId))
          .expect(200);

        // May return null if no session for this user, or the session object
        expect(res.body).toBeDefined();
      });
    });

    describe('GET /api/v1/pos/sessions/:id', () => {
      it('get by id → 200', async () => {
        expect(sessionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/pos/sessions/${sessionId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(sessionId);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/pos/sessions/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });
  });

  // ── POS Orders ────────────────────────────────────────────────────────────

  describe('POS Orders', () => {
    describe('POST /api/v1/pos/orders', () => {
      it('create order in session → 201', async () => {
        expect(sessionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/pos/orders')
          .set(headers(accessToken, tenantId))
          .send({
            sessionId,
            paymentMethod: 'cash',
            paidAmount: 500,
            lines: [
              {
                itemCode: 'ITEM001',
                itemName: 'Widget A',
                quantity: 2,
                unitPrice: 150,
              },
              {
                itemCode: 'ITEM002',
                itemName: 'Widget B',
                quantity: 1,
                unitPrice: 200,
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.status).toBe('completed');
        orderId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/pos/orders')
          .set(headers(accessToken, tenantId))
          .send({ sessionId, paidAmount: 100 })
          .expect(400);
      });
    });

    describe('GET /api/v1/pos/orders', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/pos/orders')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });

      it('filter by sessionId → 200', async () => {
        expect(sessionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/pos/orders?sessionId=${sessionId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/pos/orders/:id', () => {
      it('get by id → 200', async () => {
        expect(orderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/pos/orders/${orderId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(orderId);
        expect(Array.isArray(res.body.data.lines)).toBe(true);
      });
    });

    describe('PATCH /api/v1/pos/orders/:id/void', () => {
      it('void order → 200', async () => {
        // Create a fresh order to void
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/pos/orders')
          .set(headers(accessToken, tenantId))
          .send({
            sessionId,
            paymentMethod: 'card',
            paidAmount: 300,
            lines: [
              {
                itemCode: 'ITEM003',
                itemName: 'Widget C',
                quantity: 1,
                unitPrice: 300,
              },
            ],
          })
          .expect(201);

        const voidOrderId = createRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/pos/orders/${voidOrderId}/void`)
          .set(headers(accessToken, tenantId))
          .send({ reason: 'Customer changed mind' })
          .expect(200);

        expect(res.body.data.status).toBe('voided');
      });
    });
  });

  // ── Close Session ─────────────────────────────────────────────────────────

  describe('PATCH /api/v1/pos/sessions/:id/close', () => {
    it('close POS session → 200', async () => {
      expect(sessionId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/pos/sessions/${sessionId}/close`)
        .set(headers(accessToken, tenantId))
        .send({ closingCash: 5200, notes: 'End of shift' })
        .expect(200);

      expect(res.body.data.status).toBe('closed');
    });
  });
});
