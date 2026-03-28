import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  crmActivity: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeActivity(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'act-1',
    type: 'call',
    subject: 'Discovery call with Alice',
    description: 'Discussed product fit and pricing',
    leadId: 'lead-1',
    opportunityId: null,
    status: 'pending',
    scheduledAt: new Date('2026-04-01T10:00:00Z'),
    completedAt: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-15'),
    lead: { id: 'lead-1', name: 'Alice Wang', company: 'ACME Corp' },
    opportunity: null,
    ...overrides,
  };
}

const createDto = {
  type: 'email',
  subject: 'Follow-up on proposal',
  description: 'Sent revised pricing sheet',
  opportunityId: 'opp-1',
  scheduledAt: '2026-04-05T09:00:00Z',
} as any;

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated activities with metadata', async () => {
      const activities = [makeActivity(), makeActivity({ id: 'act-2', subject: 'Second call' })];
      mockTx.crmActivity.findMany.mockResolvedValue(activities);
      mockTx.crmActivity.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass leadId filter to the query', async () => {
      mockTx.crmActivity.findMany.mockResolvedValue([]);
      mockTx.crmActivity.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { leadId: 'lead-1' });

      const findManyCall = mockTx.crmActivity.findMany.mock.calls[0][0];
      expect(findManyCall.where.leadId).toBe('lead-1');
    });

    it('should pass opportunityId filter to the query', async () => {
      mockTx.crmActivity.findMany.mockResolvedValue([]);
      mockTx.crmActivity.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { opportunityId: 'opp-1' });

      const findManyCall = mockTx.crmActivity.findMany.mock.calls[0][0];
      expect(findManyCall.where.opportunityId).toBe('opp-1');
    });

    it('should pass type filter to the query', async () => {
      mockTx.crmActivity.findMany.mockResolvedValue([]);
      mockTx.crmActivity.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { type: 'meeting' });

      const findManyCall = mockTx.crmActivity.findMany.mock.calls[0][0];
      expect(findManyCall.where.type).toBe('meeting');
    });
  });

  describe('create()', () => {
    it('should create and return a new activity with createdBy set to caller', async () => {
      const created = makeActivity({
        id: 'act-5',
        type: 'email',
        subject: 'Follow-up on proposal',
        opportunityId: 'opp-1',
        createdBy: USER_ID,
      });
      mockTx.crmActivity.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.crmActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'email',
            subject: 'Follow-up on proposal',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.subject).toBe('Follow-up on proposal');
      expect(result.createdBy).toBe(USER_ID);
    });

    it('should convert scheduledAt string to a Date object', async () => {
      const created = makeActivity({ scheduledAt: new Date('2026-04-05T09:00:00Z') });
      mockTx.crmActivity.create.mockResolvedValue(created);

      await service.create(SCHEMA, createDto, USER_ID);

      const createCall = mockTx.crmActivity.create.mock.calls[0][0];
      expect(createCall.data.scheduledAt).toBeInstanceOf(Date);
    });
  });

  describe('complete()', () => {
    it('should set status to completed and record completedAt timestamp', async () => {
      const existing = makeActivity({ status: 'pending' });
      const completed = makeActivity({ status: 'completed', completedAt: new Date() });
      mockTx.crmActivity.findFirst.mockResolvedValue(existing);
      mockTx.crmActivity.update.mockResolvedValue(completed);

      const result = await service.complete(SCHEMA, 'act-1', USER_ID);

      expect(mockTx.crmActivity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1' },
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('completed');
      expect(result.completedAt).not.toBeNull();
    });

    it('should throw NotFoundException when activity does not exist', async () => {
      mockTx.crmActivity.findFirst.mockResolvedValue(null);

      await expect(service.complete(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.crmActivity.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('should set status to cancelled', async () => {
      const existing = makeActivity({ status: 'pending' });
      const cancelled = makeActivity({ status: 'cancelled' });
      mockTx.crmActivity.findFirst.mockResolvedValue(existing);
      mockTx.crmActivity.update.mockResolvedValue(cancelled);

      const result = await service.cancel(SCHEMA, 'act-1');

      expect(mockTx.crmActivity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1' },
          data: { status: 'cancelled' },
        }),
      );
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundException when activity does not exist', async () => {
      mockTx.crmActivity.findFirst.mockResolvedValue(null);

      await expect(service.cancel(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.crmActivity.update).not.toHaveBeenCalled();
    });
  });
});
