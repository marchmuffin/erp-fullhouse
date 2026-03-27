import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Procurement Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let supplierId: string;
  let prId: string;
  let poId: string;

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

  // ── Suppliers ─────────────────────────────────────────────────────────────

  describe('Suppliers', () => {
    describe('GET /api/v1/procurement/suppliers', () => {
      it('list → 200 with pagination shape', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/procurement/suppliers')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });

      it('no token → 401', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/procurement/suppliers')
          .set('X-Tenant-ID', tenantId)
          .expect(401);
      });
    });

    describe('POST /api/v1/procurement/suppliers', () => {
      it('create valid supplier → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/procurement/suppliers')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'SUP-E2E-001',
            name: 'E2E Test Supplier Co.',
            contactEmail: 'supplier@e2e.local',
            paymentTerms: 30,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('SUP-E2E-001');
        supplierId = res.body.data.id;
      });

      it('duplicate code → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/procurement/suppliers')
          .set(headers(accessToken, tenantId))
          .send({ code: 'SUP-E2E-001', name: 'Duplicate Supplier' })
          .expect(409);
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/procurement/suppliers')
          .set(headers(accessToken, tenantId))
          .send({ name: 'No Code Supplier' })
          .expect(400);
      });
    });

    describe('GET /api/v1/procurement/suppliers/:id', () => {
      it('get by id → 200', async () => {
        expect(supplierId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/procurement/suppliers/${supplierId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(supplierId);
        expect(res.body.data.code).toBe('SUP-E2E-001');
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/procurement/suppliers/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/procurement/suppliers/:id', () => {
      it('update → 200', async () => {
        expect(supplierId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/procurement/suppliers/${supplierId}`)
          .set(headers(accessToken, tenantId))
          .send({
            code: 'SUP-E2E-001',
            name: 'Updated E2E Supplier',
            paymentTerms: 45,
          })
          .expect(200);

        expect(res.body.data.name).toBe('Updated E2E Supplier');
      });
    });

    describe('DELETE /api/v1/procurement/suppliers/:id', () => {
      it('soft delete → 204', async () => {
        // Create a temporary supplier to delete
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/procurement/suppliers')
          .set(headers(accessToken, tenantId))
          .send({ code: 'SUP-E2E-DEL', name: 'Supplier To Delete' })
          .expect(201);

        const deleteId = createRes.body.data.id;

        await request(app.getHttpServer())
          .delete(`/api/v1/procurement/suppliers/${deleteId}`)
          .set(headers(accessToken, tenantId))
          .expect(204);
      });
    });
  });

  // ── Purchase Requisitions ─────────────────────────────────────────────────

  describe('Purchase Requisitions', () => {
    describe('POST /api/v1/procurement/requisitions', () => {
      it('create PR → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/procurement/requisitions')
          .set(headers(accessToken, tenantId))
          .send({
            prNo: 'PR-E2E-0001',
            requestDate: '2026-03-27',
            requiredDate: '2026-04-10',
            department: 'Production',
            lines: [
              {
                lineNo: 1,
                itemCode: 'RAW-001',
                itemName: 'Steel Plate',
                unit: 'KG',
                quantity: 500,
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.prNo).toBe('PR-E2E-0001');
        prId = res.body.data.id;
      });
    });

    describe('GET /api/v1/procurement/requisitions', () => {
      it('list → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/procurement/requisitions')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/procurement/requisitions/:id', () => {
      it('get by id → 200', async () => {
        expect(prId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/procurement/requisitions/${prId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(prId);
      });
    });

    describe('PATCH /api/v1/procurement/requisitions/:id/submit', () => {
      it('submit PR → 200 with status pending_approval', async () => {
        expect(prId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/procurement/requisitions/${prId}/submit`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('pending_approval');
      });
    });

    describe('PATCH /api/v1/procurement/requisitions/:id/approve', () => {
      it('approve PR → 200 with status approved', async () => {
        expect(prId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/procurement/requisitions/${prId}/approve`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('approved');
      });
    });
  });

  // ── Purchase Orders ───────────────────────────────────────────────────────

  describe('Purchase Orders', () => {
    describe('POST /api/v1/procurement/orders', () => {
      it('create PO → 201', async () => {
        expect(supplierId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/procurement/orders')
          .set(headers(accessToken, tenantId))
          .send({
            poNo: 'PO-E2E-0001',
            supplierId,
            orderDate: '2026-03-27',
            expectedDate: '2026-04-15',
            lines: [
              {
                lineNo: 1,
                itemCode: 'RAW-001',
                itemName: 'Steel Plate',
                unit: 'KG',
                quantity: 500,
                unitPrice: 25,
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.poNo).toBe('PO-E2E-0001');
        poId = res.body.data.id;
      });
    });

    describe('GET /api/v1/procurement/orders', () => {
      it('list → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/procurement/orders')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/procurement/orders/:id', () => {
      it('get by id → 200', async () => {
        expect(poId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/procurement/orders/${poId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(poId);
      });
    });

    describe('PATCH /api/v1/procurement/orders/:id/submit', () => {
      it('submit PO → 200 with status pending_approval', async () => {
        expect(poId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/procurement/orders/${poId}/submit`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('pending_approval');
      });
    });

    describe('PATCH /api/v1/procurement/orders/:id/approve', () => {
      it('approve PO → 200 with status approved', async () => {
        expect(poId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/procurement/orders/${poId}/approve`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('approved');
      });
    });
  });
});
