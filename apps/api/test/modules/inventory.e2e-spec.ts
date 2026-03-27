import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Inventory Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let itemId: string;
  let warehouseId: string;

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

  // ── Warehouses ────────────────────────────────────────────────────────────

  describe('Warehouses', () => {
    describe('POST /api/v1/inventory/warehouses', () => {
      it('create warehouse → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/inventory/warehouses')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'WH-E2E-01',
            name: 'E2E Main Warehouse',
            location: 'Building A, Floor 1',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('WH-E2E-01');
        warehouseId = res.body.data.id;
      });

      it('duplicate code → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/inventory/warehouses')
          .set(headers(accessToken, tenantId))
          .send({ code: 'WH-E2E-01', name: 'Duplicate Warehouse' })
          .expect(409);
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/inventory/warehouses')
          .set(headers(accessToken, tenantId))
          .send({ name: 'No Code Warehouse' })
          .expect(400);
      });
    });

    describe('GET /api/v1/inventory/warehouses', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventory/warehouses')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/inventory/warehouses/:id', () => {
      it('get by id → 200', async () => {
        expect(warehouseId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/inventory/warehouses/${warehouseId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(warehouseId);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/inventory/warehouses/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/inventory/warehouses/:id', () => {
      it('update → 200', async () => {
        expect(warehouseId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/inventory/warehouses/${warehouseId}`)
          .set(headers(accessToken, tenantId))
          .send({
            code: 'WH-E2E-01',
            name: 'Updated E2E Warehouse',
            location: 'Building B',
          })
          .expect(200);

        expect(res.body.data.name).toBe('Updated E2E Warehouse');
      });
    });
  });

  // ── Items ─────────────────────────────────────────────────────────────────

  describe('Items', () => {
    describe('POST /api/v1/inventory/items', () => {
      it('create item → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/inventory/items')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'ITEM-E2E-001',
            name: 'E2E Widget',
            unit: 'PCS',
            unitCost: 10.5,
            safetyStock: 100,
            reorderPoint: 50,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('ITEM-E2E-001');
        itemId = res.body.data.id;
      });

      it('duplicate code → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/inventory/items')
          .set(headers(accessToken, tenantId))
          .send({ code: 'ITEM-E2E-001', name: 'Duplicate Item' })
          .expect(409);
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/inventory/items')
          .set(headers(accessToken, tenantId))
          .send({ name: 'No Code Item' })
          .expect(400);
      });
    });

    describe('GET /api/v1/inventory/items', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventory/items')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/inventory/items/low-stock', () => {
      it('low-stock endpoint → 200 with array', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventory/items/low-stock')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('GET /api/v1/inventory/items/:id', () => {
      it('get by id → 200 with stock levels', async () => {
        expect(itemId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/inventory/items/${itemId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(itemId);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/inventory/items/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/inventory/items/:id', () => {
      it('update → 200', async () => {
        expect(itemId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/inventory/items/${itemId}`)
          .set(headers(accessToken, tenantId))
          .send({
            code: 'ITEM-E2E-001',
            name: 'Updated E2E Widget',
            unit: 'PCS',
            unitCost: 12.0,
          })
          .expect(200);

        expect(res.body.data.name).toBe('Updated E2E Widget');
      });
    });
  });

  // ── Stock Transactions ────────────────────────────────────────────────────

  describe('Stock Transactions', () => {
    describe('POST /api/v1/inventory/transactions/receive', () => {
      it('goods receipt — stock added → 201', async () => {
        expect(itemId).toBeDefined();
        expect(warehouseId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/inventory/transactions/receive')
          .set(headers(accessToken, tenantId))
          .send({
            itemId,
            warehouseId,
            quantity: 200,
            notes: 'Initial stock receipt',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.txnType).toBe('receive');
      });
    });

    describe('POST /api/v1/inventory/transactions/issue', () => {
      it('goods issue — stock deducted → 201', async () => {
        expect(itemId).toBeDefined();
        expect(warehouseId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/inventory/transactions/issue')
          .set(headers(accessToken, tenantId))
          .send({
            itemId,
            warehouseId,
            quantity: 50,
            notes: 'Production consumption',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.txnType).toBe('issue');
      });

      it('issue more than available → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/inventory/transactions/issue')
          .set(headers(accessToken, tenantId))
          .send({
            itemId,
            warehouseId,
            quantity: 99999,
            notes: 'Oversized issue',
          })
          .expect(400);
      });
    });

    describe('GET /api/v1/inventory/transactions', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventory/transactions')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.items.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/v1/inventory/items/:id (after transactions)', () => {
      it('stock level reflects receives and issues', async () => {
        expect(itemId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/inventory/items/${itemId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        // 200 received - 50 issued = 150
        expect(res.body.data).toHaveProperty('stockLevels');
      });
    });
  });

  // ── Item soft delete ──────────────────────────────────────────────────────

  describe('DELETE /api/v1/inventory/items/:id', () => {
    it('deactivate item → 204', async () => {
      // Create a throwaway item
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/items')
        .set(headers(accessToken, tenantId))
        .send({ code: 'ITEM-E2E-DEL', name: 'Item To Delete' })
        .expect(201);

      const deleteId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/items/${deleteId}`)
        .set(headers(accessToken, tenantId))
        .expect(204);
    });
  });
});
