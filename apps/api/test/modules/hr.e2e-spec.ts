import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedTestData, cleanDatabase } from '../helpers/db.helper';
import { loginUser, headers } from '../helpers/auth.helper';

describe('HR Module (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let employeeId: string;
  let leaveRequestId: string;
  let payrollRunId: string;

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

  // ── Employees ─────────────────────────────────────────────────────────────

  describe('Employees', () => {
    describe('POST /api/v1/hr/employees', () => {
      it('create employee → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/hr/employees')
          .set(headers(accessToken, tenantId))
          .send({
            empNo: 'EMP-E2E-001',
            firstName: 'Alice',
            lastName: 'Tester',
            email: 'alice@e2e.local',
            department: 'Engineering',
            position: 'Senior Engineer',
            hireDate: '2024-01-15',
            salary: 80000,
            salaryType: 'monthly',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.empNo).toBe('EMP-E2E-001');
        employeeId = res.body.data.id;
      });

      it('duplicate empNo → 409', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/hr/employees')
          .set(headers(accessToken, tenantId))
          .send({
            empNo: 'EMP-E2E-001',
            firstName: 'Bob',
            lastName: 'Duplicate',
            hireDate: '2024-01-15',
          })
          .expect(409);
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/hr/employees')
          .set(headers(accessToken, tenantId))
          .send({ firstName: 'No EmpNo' })
          .expect(400);
      });
    });

    describe('GET /api/v1/hr/employees', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/hr/employees')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/hr/employees/:id', () => {
      it('get by id → 200', async () => {
        expect(employeeId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/hr/employees/${employeeId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(employeeId);
        expect(res.body.data.empNo).toBe('EMP-E2E-001');
      });

      it('not found → 404', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/hr/employees/00000000-0000-0000-0000-000000000000')
          .set(headers(accessToken, tenantId))
          .expect(404);
      });
    });

    describe('PUT /api/v1/hr/employees/:id', () => {
      it('update → 200', async () => {
        expect(employeeId).toBeDefined();

        const res = await request(app.getHttpServer())
          .put(`/api/v1/hr/employees/${employeeId}`)
          .set(headers(accessToken, tenantId))
          .send({
            empNo: 'EMP-E2E-001',
            firstName: 'Alice',
            lastName: 'Updated',
            hireDate: '2024-01-15',
            department: 'Engineering',
            position: 'Principal Engineer',
            salary: 90000,
            salaryType: 'monthly',
          })
          .expect(200);

        expect(res.body.data.position).toBe('Principal Engineer');
      });
    });

    describe('DELETE /api/v1/hr/employees/:id', () => {
      it('terminate employee → 204', async () => {
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/hr/employees')
          .set(headers(accessToken, tenantId))
          .send({
            empNo: 'EMP-E2E-DEL',
            firstName: 'To',
            lastName: 'Delete',
            hireDate: '2024-01-01',
          })
          .expect(201);

        const deleteId = createRes.body.data.id;

        await request(app.getHttpServer())
          .delete(`/api/v1/hr/employees/${deleteId}`)
          .set(headers(accessToken, tenantId))
          .expect(204);
      });
    });
  });

  // ── Leave Requests ────────────────────────────────────────────────────────

  describe('Leave Requests', () => {
    describe('POST /api/v1/hr/leave-requests', () => {
      it('create leave request → 201', async () => {
        expect(employeeId).toBeDefined();

        const res = await request(app.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set(headers(accessToken, tenantId))
          .send({
            employeeId,
            leaveType: 'annual',
            startDate: '2026-04-01',
            endDate: '2026-04-03',
            days: 3,
            reason: 'Family vacation',
          })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.status).toBe('pending');
        leaveRequestId = res.body.data.id;
      });

      it('missing required fields → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set(headers(accessToken, tenantId))
          .send({ employeeId, leaveType: 'annual' })
          .expect(400);
      });
    });

    describe('GET /api/v1/hr/leave-requests', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/hr/leave-requests')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('PATCH /api/v1/hr/leave-requests/:id/approve', () => {
      it('approve leave request → 200', async () => {
        expect(leaveRequestId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/hr/leave-requests/${leaveRequestId}/approve`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('approved');
      });
    });

    describe('PATCH /api/v1/hr/leave-requests/:id/reject', () => {
      it('reject a pending leave request → 200', async () => {
        // Create another leave request to reject
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set(headers(accessToken, tenantId))
          .send({
            employeeId,
            leaveType: 'sick',
            startDate: '2026-05-01',
            endDate: '2026-05-02',
            days: 2,
          })
          .expect(201);

        const rejectId = createRes.body.data.id;

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/hr/leave-requests/${rejectId}/reject`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('rejected');
      });
    });
  });

  // ── Payroll Runs ──────────────────────────────────────────────────────────

  describe('Payroll Runs', () => {
    describe('POST /api/v1/hr/payroll-runs', () => {
      it('create payroll run → 201', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/hr/payroll-runs')
          .set(headers(accessToken, tenantId))
          .send({ period: '2026-03' })
          .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.period).toBe('2026-03');
        expect(res.body.data.status).toBe('draft');
        payrollRunId = res.body.data.id;
      });

      it('invalid period format → 400', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/hr/payroll-runs')
          .set(headers(accessToken, tenantId))
          .send({ period: '2026/03' })
          .expect(400);
      });
    });

    describe('GET /api/v1/hr/payroll-runs', () => {
      it('list → 200 with pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/hr/payroll-runs')
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data).toHaveProperty('items');
        expect(Array.isArray(res.body.data.items)).toBe(true);
      });
    });

    describe('GET /api/v1/hr/payroll-runs/:id', () => {
      it('get by id → 200', async () => {
        expect(payrollRunId).toBeDefined();

        const res = await request(app.getHttpServer())
          .get(`/api/v1/hr/payroll-runs/${payrollRunId}`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.id).toBe(payrollRunId);
      });
    });

    describe('PATCH /api/v1/hr/payroll-runs/:id/approve', () => {
      it('approve payroll run → 200', async () => {
        expect(payrollRunId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/hr/payroll-runs/${payrollRunId}/approve`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('approved');
      });
    });

    describe('PATCH /api/v1/hr/payroll-runs/:id/mark-paid', () => {
      it('mark paid → 200 with status paid', async () => {
        expect(payrollRunId).toBeDefined();

        const res = await request(app.getHttpServer())
          .patch(`/api/v1/hr/payroll-runs/${payrollRunId}/mark-paid`)
          .set(headers(accessToken, tenantId))
          .expect(200);

        expect(res.body.data.status).toBe('paid');
      });
    });
  });
});
