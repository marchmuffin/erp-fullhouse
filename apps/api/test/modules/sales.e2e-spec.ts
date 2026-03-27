import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Sales Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let createdCustomerId: string;
  let createdOrderId: string;

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

  // ── Customers ────────────────────────────────────────────────────────────

  describe('Customers', () => {
    describe('GET /api/v1/sales/customers', () => {
      it('list → 200 with pagination shape', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/sales/customers')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(res.body.data).toHaveProperty('total');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });

      it('no token → 401', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/sales/customers')
          .set('X-Tenant-ID', tenantId)
          .expect(401);
      });
    });

    describe('POST /api/v1/sales/customers', () => {
      it('create valid customer → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/sales/customers')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'CUST-E2E-001',
            name: 'E2E Test Customer',
            contactEmail: 'cust@e2e.local',
            paymentTerms: 30,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('CUST-E2E-001');
        createdCustomerId = res.body.data.id;
      });

      it('duplicate code → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/sales/customers')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'CUST-E2E-001',
            name: 'Duplicate Customer',
          })
          .expect(409);
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/sales/customers')
          .set(headers(accessToken, tenantId))
          .send({ name: 'No Code Customer' })
          .expect(400);
      });
    });

    describe('GET /api/v1/sales/customers/:id', () => {
      it('get by id → 200', async () => {
        expect(createdCustomerId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/sales/customers/${createdCustomerId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(createdCustomerId);
        expect(res.body.data.code).toBe('CUST-E2E-001');
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/sales/customers/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/sales/customers/:id', () => {
      it('update → 200', async () => {
        expect(createdCustomerId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/sales/customers/${createdCustomerId}`)
          .set(headers(accessToken, tenantId))
          .send({
            code: 'CUST-E2E-001',
            name: 'Updated E2E Customer',
            paymentTerms: 45,
          })
          .expect(200);

        expect(res.body.data.name).toBe('Updated E2E Customer');
      });
    });

    describe('DELETE /api/v1/sales/customers/:id', () => {
      it('soft delete → 204', async () => {
        expect(createdCustomerId).toBeDefined();

        await request(app.getHttpServer())
          .delete(`/api/v1/sales/customers/${createdCustomerId}`)
          .set(headers(accessToken, tenantId))
          .expect(204);
      });
    });
  });

  // ── Sales Orders ─────────────────────────────────────────────────────────

  describe('Sales Orders', () => {
    // Create a fresh customer for order tests
    let ordersCustomerId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sales/customers')
        .set(headers(accessToken, tenantId))
        .send({ code: 'CUST-E2E-ORD', name: 'Order Test Customer' })
        .expect(201);
      ordersCustomerId = res.body.data.id;
    });

    describe('POST /api/v1/sales/orders', () => {
      it('create order for customer → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/sales/orders')
          .set(headers(accessToken, tenantId))
          .send({
            orderNo: 'SO-E2E-0001',
            customerId: ordersCustomerId,
            orderDate: '2026-03-27',
            lines: [
              {
                lineNo: 1,
                itemCode: 'ITEM001',
                itemName: 'Widget A',
                unit: 'PCS',
                quantity: 10,
                unitPrice: 100,
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.orderNo).toBe('SO-E2E-0001');
        createdOrderId = res.body.data.id;
      });
    });

    describe('GET /api/v1/sales/orders', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/sales/orders')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/sales/orders/:id', () => {
      it('get → 200', async () => {
        expect(createdOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/sales/orders/${createdOrderId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(createdOrderId);
      });
    });

    describe('PATCH /api/v1/sales/orders/:id/submit', () => {
      it('draft → pending_approval → 200', async () => {
        expect(createdOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/sales/orders/${createdOrderId}/submit`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('pending_approval');
      });
    });

    describe('PATCH /api/v1/sales/orders/:id/approve', () => {
      it('pending → approved → 200', async () => {
        expect(createdOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/sales/orders/${createdOrderId}/approve`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('approved');
      });
    });

    describe('PATCH /api/v1/sales/orders/:id/cancel', () => {
      it('cancel approved order → 200', async () => {
        // Create a fresh order to cancel
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/sales/orders')
          .set(headers(accessToken, tenantId))
          .send({
            orderNo: 'SO-E2E-CANCEL',
            customerId: ordersCustomerId,
            orderDate: '2026-03-27',
            lines: [
              {
                lineNo: 1,
                itemCode: 'ITEM001',
                itemName: 'Widget A',
                unit: 'PCS',
                quantity: 5,
                unitPrice: 50,
              },
            ],
          })
          .expect(201);

        const cancelOrderId = createRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/sales/orders/${cancelOrderId}/cancel`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('cancelled');
      });
    });
  });
});
