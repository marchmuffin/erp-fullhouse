import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('CRM Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let leadId: string;
  let opportunityId: string;
  let activityId: string;

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

  // ── Leads ──────────────────────────────────────────────────────────────────

  describe('Leads', () => {
    describe('POST /api/v1/crm/leads', () => {
      it('create lead → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/crm/leads')
          .set(headers(accessToken, tenantId))
          .send({
            name: 'Wang Daming',
            company: 'ABC Corp',
            email: 'wang@abc.local',
            phone: '+886-2-12345678',
            source: 'website',
            estimatedValue: 500000,
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toBe('Wang Daming');
        expect(res.body.data.status).toBe('new');
        leadId = res.body.data.id;
      });

      it('missing required field (name) → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/crm/leads')
          .set(headers(accessToken, tenantId))
          .send({ company: 'No Name Corp' })
          .expect(400);
      });
    });

    describe('GET /api/v1/crm/leads', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/crm/leads')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/crm/leads/:id', () => {
      it('get by id → 200', async () => {
        expect(leadId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/crm/leads/${leadId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(leadId);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/crm/leads/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/crm/leads/:id', () => {
      it('update → 200', async () => {
        expect(leadId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/crm/leads/${leadId}`)
          .set(headers(accessToken, tenantId))
          .send({
            name: 'Wang Daming Updated',
            estimatedValue: 750000,
          })
          .expect(200);

        expect(res.body.data.estimatedValue).toBe(750000);
      });
    });

    describe('PATCH /api/v1/crm/leads/:id/qualify', () => {
      it('qualify lead → 200 with opportunity created', async () => {
        expect(leadId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/crm/leads/${leadId}/qualify`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('qualified');
      });
    });

    describe('PATCH /api/v1/crm/leads/:id/disqualify', () => {
      it('disqualify a new lead → 200', async () => {
        // Create a fresh lead to disqualify
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/crm/leads')
          .set(headers(accessToken, tenantId))
          .send({ name: 'Lead To Disqualify', source: 'cold_call' })
          .expect(201);

        const disqualifyLeadId = createRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/crm/leads/${disqualifyLeadId}/disqualify`)
          .set(headers(accessToken, tenantId))
          .send({ reason: 'No budget' })
          .expect(200);

        expect(res.body.data.status).toBe('disqualified');
      });
    });
  });

  // ── Opportunities ─────────────────────────────────────────────────────────

  describe('Opportunities', () => {
    describe('POST /api/v1/crm/opportunities', () => {
      it('create opportunity → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/crm/opportunities')
          .set(headers(accessToken, tenantId))
          .send({
            title: 'ERP Implementation for ABC Corp',
            stage: 'prospecting',
            probability: 30,
            value: 800000,
            expectedClose: '2026-06-30',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.stage).toBe('prospecting');
        opportunityId = res.body.data.id;
      });

      it('missing required field (title) → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/crm/opportunities')
          .set(headers(accessToken, tenantId))
          .send({ stage: 'prospecting' })
          .expect(400);
      });
    });

    describe('GET /api/v1/crm/opportunities', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/crm/opportunities')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/crm/opportunities/:id', () => {
      it('get by id → 200', async () => {
        expect(opportunityId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/crm/opportunities/${opportunityId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(opportunityId);
      });
    });

    describe('PUT /api/v1/crm/opportunities/:id', () => {
      it('update → 200', async () => {
        expect(opportunityId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/crm/opportunities/${opportunityId}`)
          .set(headers(accessToken, tenantId))
          .send({
            title: 'ERP Implementation for ABC Corp - Updated',
            stage: 'qualification',
            probability: 50,
          })
          .expect(200);

        expect(res.body.data.stage).toBe('qualification');
      });
    });

    describe('PATCH /api/v1/crm/opportunities/:id/close-won', () => {
      it('close won → 200', async () => {
        expect(opportunityId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/crm/opportunities/${opportunityId}/close-won`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.stage).toBe('closed_won');
      });
    });

    describe('PATCH /api/v1/crm/opportunities/:id/close-lost', () => {
      it('close lost → 200', async () => {
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/crm/opportunities')
          .set(headers(accessToken, tenantId))
          .send({
            title: 'Opportunity To Lose',
            stage: 'proposal',
            probability: 20,
          })
          .expect(201);

        const loseId = createRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/crm/opportunities/${loseId}/close-lost`)
          .set(headers(accessToken, tenantId))
          .send({ reason: 'Budget constraints' })
          .expect(200);

        expect(res.body.data.stage).toBe('closed_lost');
      });
    });
  });

  // ── Activities ────────────────────────────────────────────────────────────

  describe('Activities', () => {
    describe('POST /api/v1/crm/activities', () => {
      it('create activity → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/crm/activities')
          .set(headers(accessToken, tenantId))
          .send({
            type: 'call',
            subject: 'Initial discovery call',
            description: 'First contact with prospect',
            scheduledAt: '2026-04-01T10:00:00Z',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.type).toBe('call');
        activityId = res.body.data.id;
      });

      it('invalid type → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/crm/activities')
          .set(headers(accessToken, tenantId))
          .send({ type: 'invalid_type', subject: 'Bad activity' })
          .expect(400);
      });
    });

    describe('GET /api/v1/crm/activities', () => {
      it('list → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/crm/activities')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('PATCH /api/v1/crm/activities/:id/complete', () => {
      it('complete activity → 200', async () => {
        expect(activityId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/crm/activities/${activityId}/complete`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('completed');
      });
    });
  });
});
