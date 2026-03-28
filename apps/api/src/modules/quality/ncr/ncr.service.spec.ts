import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { NcrService } from './ncr.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  nonConformance: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  inspectionOrder: {
    findUnique: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeNcr(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'ncr-1',
    ncrNo: 'NCR-202603-1234',
    inspectionOrderId: 'io-1',
    severity: 'major',
    description: 'Dimensional deviation on part A',
    status: 'open',
    rootCause: null,
    correctiveAction: null,
    resolvedAt: null,
    resolvedBy: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-10'),
    inspectionOrder: { id: 'io-1', ioNo: 'IO-000001', type: 'incoming' },
    ...overrides,
  };
}

const createDto = {
  inspectionOrderId: 'io-1',
  severity: 'minor',
  description: 'Surface scratch on batch #55',
} as any;

const resolveDto = {
  rootCause: 'Incorrect tooling setup',
  correctiveAction: 'Retrain operators and update work instruction',
} as any;

describe('NcrService', () => {
  let service: NcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NcrService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NcrService>(NcrService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated NCRs with metadata', async () => {
      const ncrs = [makeNcr(), makeNcr({ id: 'ncr-2', ncrNo: 'NCR-202603-5678' })];
      mockTx.nonConformance.findMany.mockResolvedValue(ncrs);
      mockTx.nonConformance.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass status and severity filters to the query', async () => {
      mockTx.nonConformance.findMany.mockResolvedValue([]);
      mockTx.nonConformance.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'open', severity: 'major' });

      const findManyCall = mockTx.nonConformance.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('open');
      expect(findManyCall.where.severity).toBe('major');
    });

    it('should apply search OR filter when search term is provided', async () => {
      mockTx.nonConformance.findMany.mockResolvedValue([]);
      mockTx.nonConformance.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'NCR-2026' });

      const findManyCall = mockTx.nonConformance.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('should return the NCR when found', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(makeNcr());

      const result = await service.findById(SCHEMA, 'ncr-1');

      expect(result.id).toBe('ncr-1');
      expect(result.ncrNo).toMatch(/^NCR-/);
      expect(result.inspectionOrder!.ioNo).toBe('IO-000001');
    });

    it('should throw NotFoundException when NCR does not exist', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should auto-generate an NCR number and create the record', async () => {
      const io = { id: 'io-1', ioNo: 'IO-000001', type: 'incoming' };
      mockTx.inspectionOrder.findUnique.mockResolvedValue(io);
      const created = makeNcr({ id: 'ncr-3', severity: 'minor', description: 'Surface scratch on batch #55' });
      mockTx.nonConformance.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.nonConformance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ncrNo: expect.stringMatching(/^NCR-\d{6}-\d{4}$/),
            severity: 'minor',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.severity).toBe('minor');
    });

    it('should throw NotFoundException when inspectionOrderId references a non-existent order', async () => {
      mockTx.inspectionOrder.findUnique.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.nonConformance.create).not.toHaveBeenCalled();
    });

    it('should create NCR without an inspectionOrderId', async () => {
      const created = makeNcr({ id: 'ncr-4', inspectionOrderId: null });
      mockTx.nonConformance.create.mockResolvedValue(created);

      await service.create(SCHEMA, { severity: 'minor', description: 'Stand-alone NCR' }, USER_ID);

      // inspectionOrder lookup should be skipped
      expect(mockTx.inspectionOrder.findUnique).not.toHaveBeenCalled();
      expect(mockTx.nonConformance.create).toHaveBeenCalled();
    });
  });

  describe('resolve()', () => {
    it('should set status to resolved and record rootCause, correctiveAction, resolvedAt, resolvedBy', async () => {
      const existing = makeNcr({ status: 'open' });
      const resolved = makeNcr({
        status: 'resolved',
        rootCause: resolveDto.rootCause,
        correctiveAction: resolveDto.correctiveAction,
        resolvedAt: new Date(),
        resolvedBy: USER_ID,
      });
      mockTx.nonConformance.findUnique.mockResolvedValue(existing);
      mockTx.nonConformance.update.mockResolvedValue(resolved);

      const result = await service.resolve(SCHEMA, 'ncr-1', resolveDto, USER_ID);

      expect(mockTx.nonConformance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ncr-1' },
          data: expect.objectContaining({
            status: 'resolved',
            rootCause: resolveDto.rootCause,
            resolvedAt: expect.any(Date),
            resolvedBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('resolved');
    });

    it('should throw BadRequestException when NCR is already closed', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(makeNcr({ status: 'closed' }));

      await expect(service.resolve(SCHEMA, 'ncr-1', resolveDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when NCR does not exist', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(null);

      await expect(service.resolve(SCHEMA, 'nonexistent', resolveDto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('close()', () => {
    it('should set status to closed when NCR is resolved', async () => {
      const existing = makeNcr({ status: 'resolved', resolvedAt: new Date('2026-03-20') });
      const closed = makeNcr({ status: 'closed' });
      mockTx.nonConformance.findUnique.mockResolvedValue(existing);
      mockTx.nonConformance.update.mockResolvedValue(closed);

      const result = await service.close(SCHEMA, 'ncr-1');

      expect(mockTx.nonConformance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ncr-1' },
          data: { status: 'closed' },
        }),
      );
      expect(result.status).toBe('closed');
    });

    it('should throw BadRequestException when NCR is not yet resolved', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(makeNcr({ status: 'open' }));

      await expect(service.close(SCHEMA, 'ncr-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.nonConformance.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when NCR does not exist', async () => {
      mockTx.nonConformance.findUnique.mockResolvedValue(null);

      await expect(service.close(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
