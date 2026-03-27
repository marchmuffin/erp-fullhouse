import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Manufacturing Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let finishedItemId: string;
  let componentItemId: string;
  let warehouseId: string;
  let bomId: string;
  let workOrderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    const seeded = await seedTestData();
    tenantId = seeded.tenant.id;
    const tokens = await loginUser(app, 'test@e2e.local', 'Test@123');
    accessToken = tokens.accessToken;

    // Create prerequisite items for BOM and WO tests
    const finishedItemRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/items')
      .set(headers(accessToken, tenantId))
      .send({ code: 'FG-E2E-001', name: 'Finished Product E2E', unit: 'PCS' })
      .expect(201);
    finishedItemId = finishedItemRes.body.data.id;

    const componentItemRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/items')
      .set(headers(accessToken, tenantId))
      .send({ code: 'COMP-E2E-001', name: 'Component Part E2E', unit: 'PCS' })
      .expect(201);
    componentItemId = componentItemRes.body.data.id;

    // Create a warehouse for work orders
    const whRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set(headers(accessToken, tenantId))
      .send({ code: 'WH-MFG-01', name: 'Manufacturing Warehouse' })
      .expect(201);
    warehouseId = whRes.body.data.id;

    // Give component stock for work order material issuance
    await request(app.getHttpServer())
      .post('/api/v1/inventory/transactions/receive')
      .set(headers(accessToken, tenantId))
      .send({ itemId: componentItemId, warehouseId, quantity: 1000 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── BOMs ──────────────────────────────────────────────────────────────────

  describe('Bills of Materials', () => {
    describe('POST /api/v1/manufacturing/boms', () => {
      it('create BOM with lines → 201', async () => {
        expect(finishedItemId).toBeDefined();
        expect(componentItemId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/manufacturing/boms')
          .set(headers(accessToken, tenantId))
          .send({
            itemId: finishedItemId,
            version: '1.0',
            description: 'E2E BOM for finished product',
            isActive: true,
            lines: [
              {
                lineNo: 1,
                componentId: componentItemId,
                quantity: 2,
                unit: 'PCS',
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.version).toBe('1.0');
        bomId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/manufacturing/boms')
          .set(headers(accessToken, tenantId))
          .send({ version: '1.0' })
          .expect(400);
      });
    });

    describe('GET /api/v1/manufacturing/boms', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/manufacturing/boms')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/manufacturing/boms/:id', () => {
      it('get by id → 200', async () => {
        expect(bomId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/manufacturing/boms/${bomId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(bomId);
        expect(Array.isArray(res.body.data.lines)).toBe(true);
        expect(res.body.data.lines.length).toBe(1);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/manufacturing/boms/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/manufacturing/boms/:id', () => {
      it('update BOM lines → 200', async () => {
        expect(bomId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/manufacturing/boms/${bomId}`)
          .set(headers(accessToken, tenantId))
          .send({
            description: 'Updated E2E BOM',
            lines: [
              {
                lineNo: 1,
                componentId: componentItemId,
                quantity: 3,
                unit: 'PCS',
              },
            ],
          })
          .expect(200);

        expect(res.body.data.description).toBe('Updated E2E BOM');
      });
    });
  });

  // ── Work Orders ───────────────────────────────────────────────────────────

  describe('Work Orders', () => {
    describe('POST /api/v1/manufacturing/work-orders', () => {
      it('create work order → 201', async () => {
        expect(finishedItemId).toBeDefined();
        expect(bomId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/manufacturing/work-orders')
          .set(headers(accessToken, tenantId))
          .send({
            woNo: 'WO-E2E-0001',
            itemId: finishedItemId,
            bomId,
            plannedQty: 10,
            warehouseId,
            plannedStart: '2026-04-01T08:00:00Z',
            plannedEnd: '2026-04-05T17:00:00Z',
            operations: [
              { stepNo: 1, name: 'Assembly', plannedHours: 4 },
              { stepNo: 2, name: 'QC Check', plannedHours: 1 },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.woNo).toBe('WO-E2E-0001');
        expect(res.body.data.status).toBe('draft');
        workOrderId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/manufacturing/work-orders')
          .set(headers(accessToken, tenantId))
          .send({ woNo: 'WO-BAD', plannedQty: 5 })
          .expect(400);
      });
    });

    describe('GET /api/v1/manufacturing/work-orders', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/manufacturing/work-orders')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/manufacturing/work-orders/:id', () => {
      it('get by id → 200', async () => {
        expect(workOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/manufacturing/work-orders/${workOrderId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(workOrderId);
      });
    });

    describe('PATCH /api/v1/manufacturing/work-orders/:id/release', () => {
      it('release WO (draft → released) → 200', async () => {
        expect(workOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/manufacturing/work-orders/${workOrderId}/release`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('released');
      });
    });

    describe('PATCH /api/v1/manufacturing/work-orders/:id/start', () => {
      it('start WO (released → in_progress) → 200', async () => {
        expect(workOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/manufacturing/work-orders/${workOrderId}/start`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('in_progress');
      });
    });

    describe('PATCH /api/v1/manufacturing/work-orders/:id/complete', () => {
      it('complete WO (in_progress → completed) → 200', async () => {
        expect(workOrderId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/manufacturing/work-orders/${workOrderId}/complete`)
          .set(headers(accessToken, tenantId))
          .send({ producedQty: 10 })
          .expect(200);

        expect(res.body.data.status).toBe('completed');
      });
    });
  });

  // ── BOM soft delete ───────────────────────────────────────────────────────

  describe('DELETE /api/v1/manufacturing/boms/:id', () => {
    it('deactivate BOM → 200', async () => {
      // Create a throwaway BOM
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/manufacturing/boms')
        .set(headers(accessToken, tenantId))
        .send({
          itemId: finishedItemId,
          version: '2.0',
          lines: [
            { lineNo: 1, componentId: componentItemId, quantity: 1 },
          ],
        })
        .expect(201);

      const deleteId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/manufacturing/boms/${deleteId}`)
        .set(headers(accessToken, tenantId))
        .expect(200);

      expect(res.body.data.isActive).toBe(false);
    });
  });
});
