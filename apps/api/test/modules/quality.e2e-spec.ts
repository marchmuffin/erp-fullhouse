import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Quality Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let passInspectionId: string;
  let failInspectionId: string;
  let ncrId: string;

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

  // ── Inspections ───────────────────────────────────────────────────────────

  describe('Inspections', () => {
    describe('POST /api/v1/quality/inspections', () => {
      it('create incoming inspection → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/quality/inspections')
          .set(headers(accessToken, tenantId))
          .send({
            type: 'incoming',
            itemName: 'Steel Plate Batch A',
            quantity: 500,
            inspector: 'QC Inspector Liu',
            notes: 'Standard incoming inspection',
            checklistItems: [
              { itemNo: 1, checkPoint: 'Visual appearance', criteria: 'No rust or damage' },
              { itemNo: 2, checkPoint: 'Dimensions', criteria: '300x300mm ± 0.5mm' },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.type).toBe('incoming');
        expect(res.body.data.status).toBe('pending');
        passInspectionId = res.body.data.id;
      });

      it('create another inspection for fail test → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/quality/inspections')
          .set(headers(accessToken, tenantId))
          .send({
            type: 'in_process',
            itemName: 'Widget Production Run B',
            quantity: 100,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        failInspectionId = res.body.data.id;
      });

      it('invalid type → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/quality/inspections')
          .set(headers(accessToken, tenantId))
          .send({ type: 'random', quantity: 10 })
          .expect(400);
      });
    });

    describe('GET /api/v1/quality/inspections', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/quality/inspections')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/quality/inspections/:id', () => {
      it('get by id → 200', async () => {
        expect(passInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/quality/inspections/${passInspectionId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(passInspectionId);
      });
    });

    describe('PATCH /api/v1/quality/inspections/:id/start', () => {
      it('start inspection (pending → in_progress) → 200', async () => {
        expect(passInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/inspections/${passInspectionId}/start`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('in_progress');
      });

      it('start fail-test inspection → 200', async () => {
        expect(failInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/inspections/${failInspectionId}/start`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('in_progress');
      });
    });

    describe('PATCH /api/v1/quality/inspections/:id/result', () => {
      it('record result pass → 200', async () => {
        expect(passInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/inspections/${passInspectionId}/result`)
          .set(headers(accessToken, tenantId))
          .send({ result: 'pass', notes: 'All checks passed' })
          .expect(200);

        expect(res.body.data.result).toBe('pass');
        expect(res.body.data.status).toBe('completed');
      });

      it('record result fail → 200 (NCR should be createable)', async () => {
        expect(failInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/inspections/${failInspectionId}/result`)
          .set(headers(accessToken, tenantId))
          .send({ result: 'fail', notes: 'Dimensions out of tolerance' })
          .expect(200);

        expect(res.body.data.result).toBe('fail');
        expect(res.body.data.status).toBe('completed');
      });
    });
  });

  // ── NCRs ──────────────────────────────────────────────────────────────────

  describe('NCRs (Non-Conformance Reports)', () => {
    describe('POST /api/v1/quality/ncrs', () => {
      it('create NCR from failed inspection → 201', async () => {
        expect(failInspectionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/quality/ncrs')
          .set(headers(accessToken, tenantId))
          .send({
            inspectionOrderId: failInspectionId,
            severity: 'major',
            description: 'Widget dimensions are outside tolerance range by 2mm',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.severity).toBe('major');
        expect(res.body.data.status).toBe('open');
        ncrId = res.body.data.id;
      });

      it('invalid severity → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/quality/ncrs')
          .set(headers(accessToken, tenantId))
          .send({ severity: 'catastrophic', description: 'Bad NCR' })
          .expect(400);
      });
    });

    describe('GET /api/v1/quality/ncrs', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/quality/ncrs')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/quality/ncrs/:id', () => {
      it('get by id → 200', async () => {
        expect(ncrId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/quality/ncrs/${ncrId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(ncrId);
      });
    });

    describe('PATCH /api/v1/quality/ncrs/:id/in-review', () => {
      it('mark in_review → 200', async () => {
        expect(ncrId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/ncrs/${ncrId}/in-review`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('in_review');
      });
    });

    describe('PATCH /api/v1/quality/ncrs/:id/resolve', () => {
      it('resolve NCR → 200', async () => {
        expect(ncrId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/ncrs/${ncrId}/resolve`)
          .set(headers(accessToken, tenantId))
          .send({
            rootCause: 'Machine calibration drift',
            correctiveAction: 'Recalibrate machine and tighten QC interval',
          })
          .expect(200);

        expect(res.body.data.status).toBe('resolved');
      });
    });

    describe('PATCH /api/v1/quality/ncrs/:id/close', () => {
      it('close NCR → 200', async () => {
        expect(ncrId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/quality/ncrs/${ncrId}/close`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('closed');
      });
    });
  });
});
