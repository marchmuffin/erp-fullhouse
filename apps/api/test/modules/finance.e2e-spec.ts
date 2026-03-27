import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('Finance Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let debitAccountId: string;
  let creditAccountId: string;
  let journalEntryId: string;
  let invoiceId: string;

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

  // ── Chart of Accounts ─────────────────────────────────────────────────────

  describe('Accounts', () => {
    describe('POST /api/v1/finance/accounts', () => {
      it('create asset account → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/finance/accounts')
          .set(headers(accessToken, tenantId))
          .send({
            code: '1001',
            name: 'Cash and Equivalents',
            type: 'asset',
            category: 'Current Assets',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.type).toBe('asset');
        debitAccountId = res.body.data.id;
      });

      it('create revenue account → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/finance/accounts')
          .set(headers(accessToken, tenantId))
          .send({
            code: '4001',
            name: 'Sales Revenue',
            type: 'revenue',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        creditAccountId = res.body.data.id;
      });

      it('duplicate code → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/finance/accounts')
          .set(headers(accessToken, tenantId))
          .send({ code: '1001', name: 'Duplicate Account', type: 'asset' })
          .expect(409);
      });

      it('invalid type → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/finance/accounts')
          .set(headers(accessToken, tenantId))
          .send({ code: '9999', name: 'Bad Type Account', type: 'invalid_type' })
          .expect(400);
      });
    });

    describe('GET /api/v1/finance/accounts', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/finance/accounts')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });

      it('filter by type → 200 with filtered results', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/finance/accounts?type=asset')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(Array.isArray(res.body.data.items)).toBe(true);
        res.body.data.items.forEach((acc: any) => {
          expect(acc.type).toBe('asset');
        });
      });
    });

    describe('GET /api/v1/finance/accounts/:id', () => {
      it('get by id → 200', async () => {
        expect(debitAccountId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/finance/accounts/${debitAccountId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(debitAccountId);
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/finance/accounts/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/finance/accounts/:id', () => {
      it('update → 200', async () => {
        expect(debitAccountId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/finance/accounts/${debitAccountId}`)
          .set(headers(accessToken, tenantId))
          .send({
            code: '1001',
            name: 'Cash and Cash Equivalents',
            type: 'asset',
          })
          .expect(200);

        expect(res.body.data.name).toBe('Cash and Cash Equivalents');
      });
    });
  });

  // ── Journal Entries ───────────────────────────────────────────────────────

  describe('Journal Entries', () => {
    describe('POST /api/v1/finance/journal-entries', () => {
      it('create balanced entry → 201', async () => {
        expect(debitAccountId).toBeDefined();
        expect(creditAccountId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/finance/journal-entries')
          .set(headers(accessToken, tenantId))
          .send({
            jeDate: '2026-03-27T00:00:00.000Z',
            description: 'E2E test journal entry',
            lines: [
              {
                lineNo: 1,
                debitAccountId,
                amount: 1000.0,
                description: 'Cash received',
              },
              {
                lineNo: 2,
                creditAccountId,
                amount: 1000.0,
                description: 'Revenue recognized',
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.status).toBe('draft');
        journalEntryId = res.body.data.id;
      });

      it('create unbalanced entry → 400', async () => {
        expect(debitAccountId).toBeDefined();
        expect(creditAccountId).toBeDefined();

        await request(app.getHttpServer())
          .post('/api/v1/finance/journal-entries')
          .set(headers(accessToken, tenantId))
          .send({
            jeDate: '2026-03-27T00:00:00.000Z',
            description: 'Unbalanced entry',
            lines: [
              {
                lineNo: 1,
                debitAccountId,
                amount: 1000.0,
              },
              {
                lineNo: 2,
                creditAccountId,
                amount: 500.0,
              },
            ],
          })
          .expect(400);
      });
    });

    describe('GET /api/v1/finance/journal-entries', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/finance/journal-entries')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/finance/journal-entries/:id', () => {
      it('get by id → 200', async () => {
        expect(journalEntryId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/finance/journal-entries/${journalEntryId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(journalEntryId);
      });
    });

    describe('PATCH /api/v1/finance/journal-entries/:id/post', () => {
      it('post journal entry → 200 with status posted', async () => {
        expect(journalEntryId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/finance/journal-entries/${journalEntryId}/post`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('posted');
      });
    });

    describe('PATCH /api/v1/finance/journal-entries/:id/reverse', () => {
      it('reverse posted entry → 201 with reversal entry', async () => {
        expect(journalEntryId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/finance/journal-entries/${journalEntryId}/reverse`)
          .set(headers(accessToken, tenantId))
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        // The reversal entry should be a new JE
        expect(res.body.data.id).not.toBe(journalEntryId);
      });
    });
  });

  // ── Invoices ──────────────────────────────────────────────────────────────

  describe('Invoices', () => {
    describe('POST /api/v1/finance/invoices', () => {
      it('create AR invoice → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/finance/invoices')
          .set(headers(accessToken, tenantId))
          .send({
            type: 'ar',
            partyId: 'party-e2e-001',
            partyName: 'E2E Test Customer',
            invoiceDate: '2026-03-27T00:00:00.000Z',
            dueDate: '2026-04-26T00:00:00.000Z',
            lines: [
              {
                lineNo: 1,
                description: 'Professional services',
                quantity: 10,
                unitPrice: 500.0,
              },
            ],
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.type).toBe('ar');
        expect(res.body.data.status).toBe('draft');
        invoiceId = res.body.data.id;
      });
    });

    describe('GET /api/v1/finance/invoices', () => {
      it('list → 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/finance/invoices')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/finance/invoices/:id', () => {
      it('get by id → 200', async () => {
        expect(invoiceId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/finance/invoices/${invoiceId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(invoiceId);
      });
    });

    describe('PATCH /api/v1/finance/invoices/:id/issue', () => {
      it('draft → issued → 200', async () => {
        expect(invoiceId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/finance/invoices/${invoiceId}/issue`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('issued');
      });
    });

    describe('POST /api/v1/finance/invoices/:id/payments', () => {
      it('record full payment → invoice status = paid', async () => {
        expect(invoiceId).toBeDefined();

        // Invoice total = 10 * 500 * 1.05 (5% tax) = 5250
        await request(app.getHttpServer())
          .post(`/api/v1/finance/invoices/${invoiceId}/payments`)
          .set(headers(accessToken, tenantId))
          .send({
            paymentDate: '2026-03-28T00:00:00.000Z',
            amount: 5250.0,
            method: 'bank_transfer',
            reference: 'TRF-E2E-001',
          })
          .expect(201);

        // Verify status is now paid
        const res = await request(app.getHttpServer())
          .get(`/api/v1/finance/invoices/${invoiceId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('paid');
      });
    });
  });

  // ── Account soft delete ───────────────────────────────────────────────────

  describe('DELETE /api/v1/finance/accounts/:id', () => {
    it('deactivate account → 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/finance/accounts')
        .set(headers(accessToken, tenantId))
        .send({ code: '9001', name: 'Account To Delete', type: 'expense' })
        .expect(201);

      const deleteId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/finance/accounts/${deleteId}`)
        .set(headers(accessToken, tenantId))
        .expect(204);
    });
  });
});
