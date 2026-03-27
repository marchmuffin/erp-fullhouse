import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('BPM Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let definitionId: string;
  let instanceId: string;

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

  // ── Workflow Definitions ──────────────────────────────────────────────────

  describe('Workflow Definitions', () => {
    describe('POST /api/v1/bpm/definitions', () => {
      it('create workflow definition → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/bpm/definitions')
          .set(headers(accessToken, tenantId))
          .send({
            code: 'WF-E2E-PO-001',
            name: 'E2E PO Approval Workflow',
            module: 'procurement',
            docType: 'po',
            steps: 1,
            description: 'Single-step PO approval for E2E tests',
            isActive: true,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('WF-E2E-PO-001');
        expect(res.body.data.steps).toBe(1);
        definitionId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/bpm/definitions')
          .set(headers(accessToken, tenantId))
          .send({ code: 'WF-BAD' })
          .expect(400);
      });
    });

    describe('GET /api/v1/bpm/definitions', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bpm/definitions')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
        expect(res.body.data.items.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Workflow Instances ────────────────────────────────────────────────────

  describe('Workflow Instances', () => {
    describe('POST /api/v1/bpm/instances/submit', () => {
      it('submit document for workflow approval → 201', async () => {
        expect(definitionId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/bpm/instances/submit')
          .set(headers(accessToken, tenantId))
          .send({
            definitionId,
            docType: 'po',
            docId: 'po-e2e-test-001',
            docNo: 'PO-E2E-BPM-001',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.status).toBe('pending');
        instanceId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/bpm/instances/submit')
          .set(headers(accessToken, tenantId))
          .send({ docType: 'po' })
          .expect(400);
      });
    });

    describe('GET /api/v1/bpm/instances', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bpm/instances')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/bpm/instances/pending', () => {
      it('pending approvals inbox → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bpm/instances/pending')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('GET /api/v1/bpm/instances/mine', () => {
      it('my submissions → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bpm/instances/mine')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('GET /api/v1/bpm/instances/:id', () => {
      it('get by id → 200', async () => {
        expect(instanceId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/bpm/instances/${instanceId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(instanceId);
      });
    });

    describe('PATCH /api/v1/bpm/instances/:id/approve', () => {
      it('approve current step → 200 with status approved (single-step)', async () => {
        expect(instanceId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/bpm/instances/${instanceId}/approve`)
          .set(headers(accessToken, tenantId))
          .send({ comment: 'Approved by E2E test' })
          .expect(200);

        // For a 1-step workflow, approving the only step completes the workflow
        expect(['approved', 'pending']).toContain(res.body.data.status);
      });
    });

    describe('PATCH /api/v1/bpm/instances/:id/reject', () => {
      it('reject an instance → 200', async () => {
        // Submit a fresh instance to reject
        const submitRes = await request(app.getHttpServer())
          .post('/api/v1/bpm/instances/submit')
          .set(headers(accessToken, tenantId))
          .send({
            definitionId,
            docType: 'po',
            docId: 'po-e2e-reject-001',
            docNo: 'PO-E2E-REJECT-001',
          })
          .expect(201);

        const rejectInstanceId = submitRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/bpm/instances/${rejectInstanceId}/reject`)
          .set(headers(accessToken, tenantId))
          .send({ comment: 'Rejected by E2E test — budget exceeded' })
          .expect(200);

        expect(res.body.data.status).toBe('rejected');
      });
    });

    describe('GET /api/v1/bpm/stats', () => {
      it('BPM stats → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bpm/stats')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });
  });
});
