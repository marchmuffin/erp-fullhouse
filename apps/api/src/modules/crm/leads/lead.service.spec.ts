import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { LeadService } from './lead.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  lead: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  opportunity: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeLead(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'lead-1',
    name: 'Alice Wang',
    company: 'ACME Corp',
    email: 'alice@acme.com',
    phone: '0912111222',
    source: 'website',
    status: 'new',
    estimatedValue: 50000,
    assignedTo: USER_ID,
    notes: null,
    createdAt: new Date('2026-03-01'),
    activities: [],
    opportunities: [],
    ...overrides,
  };
}

const createDto = {
  name: 'Bob Lee',
  company: 'Beta Ltd',
  email: 'bob@beta.com',
  phone: '0987111222',
  source: 'referral',
  estimatedValue: 80000,
  notes: null,
} as any;

describe('LeadService', () => {
  let service: LeadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeadService>(LeadService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated leads with metadata', async () => {
      const leads = [makeLead(), makeLead({ id: 'lead-2', name: 'Carol Chen' })];
      mockTx.lead.findMany.mockResolvedValue(leads);
      mockTx.lead.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass status and source filters to the query', async () => {
      mockTx.lead.findMany.mockResolvedValue([]);
      mockTx.lead.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'new', source: 'website' });

      const findManyCall = mockTx.lead.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('new');
      expect(findManyCall.where.source).toBe('website');
    });

    it('should apply search OR filter when search term is provided', async () => {
      mockTx.lead.findMany.mockResolvedValue([]);
      mockTx.lead.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'alice' });

      const findManyCall = mockTx.lead.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('should return a lead with activities and opportunities', async () => {
      const lead = makeLead({
        activities: [{ id: 'act-1', type: 'call', note: 'Introductory call' }],
        opportunities: [],
      });
      mockTx.lead.findFirst.mockResolvedValue(lead);

      const result = await service.findById(SCHEMA, 'lead-1');

      expect(result.id).toBe('lead-1');
      expect(result.activities).toHaveLength(1);
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      mockTx.lead.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a new lead with the creator as assignedTo by default', async () => {
      const created = makeLead({ id: 'lead-2', name: 'Bob Lee', assignedTo: USER_ID });
      mockTx.lead.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Bob Lee',
            assignedTo: USER_ID,
          }),
        }),
      );
      expect(result.name).toBe('Bob Lee');
    });
  });

  describe('update()', () => {
    it('should update and return the lead', async () => {
      const existing = makeLead();
      const updated = makeLead({ status: 'contacted' });
      mockTx.lead.findFirst.mockResolvedValue(existing);
      mockTx.lead.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'lead-1', { status: 'contacted' });

      expect(mockTx.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'lead-1' } }),
      );
      expect(result.status).toBe('contacted');
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      mockTx.lead.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', {})).rejects.toThrow(NotFoundException);
      expect(mockTx.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('qualify()', () => {
    it('should set lead status to qualified and create an opportunity', async () => {
      const existing = makeLead({ status: 'contacted', estimatedValue: 50000 });
      const updatedLead = makeLead({ status: 'qualified' });
      const opportunity = {
        id: 'opp-1',
        leadId: 'lead-1',
        title: 'Alice Wang - ACME Corp 商機',
        stage: 'qualification',
        probability: 20,
        value: 50000,
        assignedTo: USER_ID,
      };
      mockTx.lead.findFirst.mockResolvedValue(existing);
      mockTx.lead.update.mockResolvedValue(updatedLead);
      mockTx.opportunity.create.mockResolvedValue(opportunity);

      const result = await service.qualify(SCHEMA, 'lead-1');

      expect(mockTx.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: { status: 'qualified' },
        }),
      );
      expect(mockTx.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadId: 'lead-1',
            stage: 'qualification',
            probability: 20,
          }),
        }),
      );
      expect(result.lead.status).toBe('qualified');
      expect(result.opportunity.id).toBe('opp-1');
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      mockTx.lead.findFirst.mockResolvedValue(null);

      await expect(service.qualify(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.opportunity.create).not.toHaveBeenCalled();
    });
  });

  describe('disqualify()', () => {
    it('should set lead status to disqualified and prepend reason to notes', async () => {
      const existing = makeLead({ notes: 'Previous note' });
      const updated = makeLead({ status: 'disqualified', notes: '[取消資格] Budget too low\nPrevious note' });
      mockTx.lead.findFirst.mockResolvedValue(existing);
      mockTx.lead.update.mockResolvedValue(updated);

      const result = await service.disqualify(SCHEMA, 'lead-1', 'Budget too low');

      expect(mockTx.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({ status: 'disqualified' }),
        }),
      );
      expect(result.status).toBe('disqualified');
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      mockTx.lead.findFirst.mockResolvedValue(null);

      await expect(service.disqualify(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.lead.update).not.toHaveBeenCalled();
    });
  });
});
