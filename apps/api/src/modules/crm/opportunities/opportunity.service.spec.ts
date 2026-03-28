import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { OpportunityService } from './opportunity.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  opportunity: {
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

function makeOpportunity(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'opp-1',
    title: 'ACME Corp 大單商機',
    leadId: 'lead-1',
    customerId: null,
    stage: 'qualification',
    probability: 20,
    value: 120000,
    expectedClose: new Date('2026-06-30'),
    assignedTo: USER_ID,
    notes: null,
    createdAt: new Date('2026-03-01'),
    lead: { id: 'lead-1', name: 'Alice Wang', company: 'ACME Corp' },
    activities: [],
    ...overrides,
  };
}

const createDto = {
  title: 'Beta Ltd 商機',
  leadId: 'lead-2',
  stage: 'prospecting',
  probability: 10,
  value: 80000,
  expectedClose: '2026-09-30',
  notes: null,
} as any;

describe('OpportunityService', () => {
  let service: OpportunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OpportunityService>(OpportunityService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated opportunities with metadata', async () => {
      const opps = [makeOpportunity(), makeOpportunity({ id: 'opp-2', title: 'Second Deal' })];
      mockTx.opportunity.findMany.mockResolvedValue(opps);
      mockTx.opportunity.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass stage filter to the query', async () => {
      mockTx.opportunity.findMany.mockResolvedValue([]);
      mockTx.opportunity.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { stage: 'proposal' });

      const findManyCall = mockTx.opportunity.findMany.mock.calls[0][0];
      expect(findManyCall.where.stage).toBe('proposal');
    });

    it('should apply search OR filter when search term is provided', async () => {
      mockTx.opportunity.findMany.mockResolvedValue([]);
      mockTx.opportunity.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'ACME' });

      const findManyCall = mockTx.opportunity.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });

    it('should return empty data with correct meta when no opportunities exist', async () => {
      mockTx.opportunity.findMany.mockResolvedValue([]);
      mockTx.opportunity.count.mockResolvedValue(0);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findById()', () => {
    it('should return an opportunity with lead and activities', async () => {
      const opp = makeOpportunity({
        activities: [{ id: 'act-1', type: 'call', subject: 'Discovery call' }],
      });
      mockTx.opportunity.findFirst.mockResolvedValue(opp);

      const result = await service.findById(SCHEMA, 'opp-1');

      expect(result.id).toBe('opp-1');
      expect(result.activities).toHaveLength(1);
      expect(result.lead!.name).toBe('Alice Wang');
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      mockTx.opportunity.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a new opportunity with the caller as assignedTo by default', async () => {
      const created = makeOpportunity({ id: 'opp-3', title: 'Beta Ltd 商機', assignedTo: USER_ID });
      mockTx.opportunity.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Beta Ltd 商機',
            assignedTo: USER_ID,
          }),
        }),
      );
      expect(result.title).toBe('Beta Ltd 商機');
    });

    it('should use dto.assignedTo when explicitly provided', async () => {
      const created = makeOpportunity({ assignedTo: 'user-99' });
      mockTx.opportunity.create.mockResolvedValue(created);

      await service.create(SCHEMA, { ...createDto, assignedTo: 'user-99' }, USER_ID);

      expect(mockTx.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedTo: 'user-99' }),
        }),
      );
    });
  });

  describe('update()', () => {
    it('should update and return the opportunity', async () => {
      const existing = makeOpportunity();
      const updated = makeOpportunity({ stage: 'proposal', probability: 50 });
      mockTx.opportunity.findFirst.mockResolvedValue(existing);
      mockTx.opportunity.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'opp-1', { stage: 'proposal', probability: 50 });

      expect(mockTx.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'opp-1' } }),
      );
      expect(result.stage).toBe('proposal');
      expect(result.probability).toBe(50);
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      mockTx.opportunity.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', {})).rejects.toThrow(NotFoundException);
      expect(mockTx.opportunity.update).not.toHaveBeenCalled();
    });
  });

  describe('closeWon()', () => {
    it('should set stage to closed_won and probability to 100', async () => {
      const existing = makeOpportunity({ stage: 'negotiation', probability: 70 });
      const closed = makeOpportunity({ stage: 'closed_won', probability: 100 });
      mockTx.opportunity.findFirst.mockResolvedValue(existing);
      mockTx.opportunity.update.mockResolvedValue(closed);

      const result = await service.closeWon(SCHEMA, 'opp-1');

      expect(mockTx.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'opp-1' },
          data: { stage: 'closed_won', probability: 100 },
        }),
      );
      expect(result.stage).toBe('closed_won');
      expect(result.probability).toBe(100);
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      mockTx.opportunity.findFirst.mockResolvedValue(null);

      await expect(service.closeWon(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.opportunity.update).not.toHaveBeenCalled();
    });
  });

  describe('closeLost()', () => {
    it('should set stage to closed_lost, probability to 0, and prepend reason to notes', async () => {
      const existing = makeOpportunity({ notes: 'Previous note' });
      const closed = makeOpportunity({
        stage: 'closed_lost',
        probability: 0,
        notes: '[失敗原因] Budget cut\nPrevious note',
      });
      mockTx.opportunity.findFirst.mockResolvedValue(existing);
      mockTx.opportunity.update.mockResolvedValue(closed);

      const result = await service.closeLost(SCHEMA, 'opp-1', 'Budget cut');

      expect(mockTx.opportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'opp-1' },
          data: expect.objectContaining({
            stage: 'closed_lost',
            probability: 0,
          }),
        }),
      );
      expect(result.stage).toBe('closed_lost');
      expect(result.notes).toContain('Budget cut');
    });

    it('should set stage to closed_lost even when no reason is provided', async () => {
      const existing = makeOpportunity({ notes: null });
      const closed = makeOpportunity({ stage: 'closed_lost', probability: 0, notes: null });
      mockTx.opportunity.findFirst.mockResolvedValue(existing);
      mockTx.opportunity.update.mockResolvedValue(closed);

      const result = await service.closeLost(SCHEMA, 'opp-1');

      expect(result.stage).toBe('closed_lost');
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      mockTx.opportunity.findFirst.mockResolvedValue(null);

      await expect(service.closeLost(SCHEMA, 'nonexistent', 'No budget')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.opportunity.update).not.toHaveBeenCalled();
    });
  });
});
