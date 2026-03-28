import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { InspectionService } from './inspection.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  inspectionOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ioChecklistItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeInspectionOrder(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'io-1',
    ioNo: 'IO-202603-1234',
    type: 'incoming',
    refDocType: 'purchase_order',
    refDocId: 'po-1',
    refDocNo: 'PO-2026-0001',
    itemId: 'item-1',
    itemName: 'Widget A',
    quantity: 100,
    status: 'pending',
    result: null,
    inspector: 'John Inspector',
    inspectedAt: null,
    notes: null,
    createdAt: new Date('2026-03-20'),
    checklistItems: [],
    ncrs: [],
    _count: { checklistItems: 0, ncrs: 0 },
    ...overrides,
  };
}

const createDto = {
  type: 'incoming',
  refDocType: 'purchase_order',
  refDocId: 'po-1',
  refDocNo: 'PO-2026-0001',
  itemId: 'item-1',
  itemName: 'Widget A',
  quantity: 100,
  inspector: 'John Inspector',
  notes: null,
  checklistItems: [
    { itemNo: 1, checkPoint: 'Dimensions', criteria: 'Within ±0.5mm' },
  ],
} as any;

const resultDto = {
  result: 'pass',
  notes: 'All checks passed',
} as any;

describe('InspectionService', () => {
  let service: InspectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InspectionService>(InspectionService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated inspection orders with metadata', async () => {
      const orders = [makeInspectionOrder(), makeInspectionOrder({ id: 'io-2', ioNo: 'IO-202603-5678' })];
      mockTx.inspectionOrder.findMany.mockResolvedValue(orders);
      mockTx.inspectionOrder.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass type and status filters to the query', async () => {
      mockTx.inspectionOrder.findMany.mockResolvedValue([]);
      mockTx.inspectionOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { type: 'incoming', status: 'pending' });

      const findManyCall = mockTx.inspectionOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.type).toBe('incoming');
      expect(findManyCall.where.status).toBe('pending');
    });

    it('should apply search OR filter when search term is provided', async () => {
      mockTx.inspectionOrder.findMany.mockResolvedValue([]);
      mockTx.inspectionOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'IO-2026' });

      const findManyCall = mockTx.inspectionOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('should return an inspection order with checklist items and NCRs', async () => {
      const io = makeInspectionOrder({
        checklistItems: [{ id: 'ci-1', itemNo: 1, checkPoint: 'Dimensions', result: null }],
        ncrs: [],
      });
      mockTx.inspectionOrder.findUnique.mockResolvedValue(io);

      const result = await service.findById(SCHEMA, 'io-1');

      expect(result.id).toBe('io-1');
      expect(result.checklistItems).toHaveLength(1);
    });

    it('should throw NotFoundException when inspection order does not exist', async () => {
      mockTx.inspectionOrder.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create an inspection order with a generated ioNo and checklist items', async () => {
      const created = makeInspectionOrder({
        checklistItems: [{ id: 'ci-1', itemNo: 1, checkPoint: 'Dimensions', criteria: 'Within ±0.5mm' }],
      });
      mockTx.inspectionOrder.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.inspectionOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ioNo: expect.stringMatching(/^IO-\d{6}-\d{4}$/),
            type: 'incoming',
            itemName: 'Widget A',
            quantity: 100,
          }),
        }),
      );
      expect(result.itemName).toBe('Widget A');
      expect(result.checklistItems).toHaveLength(1);
    });

    it('should create without checklist items when none are provided', async () => {
      const dtoWithoutChecklist = { ...createDto, checklistItems: undefined };
      const created = makeInspectionOrder({ checklistItems: [] });
      mockTx.inspectionOrder.create.mockResolvedValue(created);

      await service.create(SCHEMA, dtoWithoutChecklist, USER_ID);

      const createCall = mockTx.inspectionOrder.create.mock.calls[0][0];
      expect(createCall.data.checklistItems).toBeUndefined();
    });
  });

  describe('recordResult()', () => {
    it('should record a pass result and set status to passed', async () => {
      const inProgress = makeInspectionOrder({ status: 'in_progress' });
      const passed = makeInspectionOrder({
        status: 'passed',
        result: 'pass',
        inspectedAt: new Date(),
      });
      mockTx.inspectionOrder.findUnique.mockResolvedValue(inProgress);
      mockTx.inspectionOrder.update.mockResolvedValue(passed);

      const result = await service.recordResult(SCHEMA, 'io-1', resultDto, USER_ID);

      expect(mockTx.inspectionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'io-1' },
          data: expect.objectContaining({
            result: 'pass',
            status: 'passed',
            inspectedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.result).toBe('pass');
      expect(result.status).toBe('passed');
    });

    it('should record a fail result and set status to failed', async () => {
      const inProgress = makeInspectionOrder({ status: 'in_progress' });
      const failed = makeInspectionOrder({ status: 'failed', result: 'fail', inspectedAt: new Date() });
      mockTx.inspectionOrder.findUnique.mockResolvedValue(inProgress);
      mockTx.inspectionOrder.update.mockResolvedValue(failed);

      const result = await service.recordResult(SCHEMA, 'io-1', { result: 'fail' } as any, USER_ID);

      expect(mockTx.inspectionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: 'fail', status: 'failed' }),
        }),
      );
      expect(result.status).toBe('failed');
    });

    it('should throw BadRequestException when inspection is not in_progress', async () => {
      const pending = makeInspectionOrder({ status: 'pending' });
      mockTx.inspectionOrder.findUnique.mockResolvedValue(pending);

      await expect(service.recordResult(SCHEMA, 'io-1', resultDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.inspectionOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when inspection order does not exist', async () => {
      mockTx.inspectionOrder.findUnique.mockResolvedValue(null);

      await expect(service.recordResult(SCHEMA, 'nonexistent', resultDto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
